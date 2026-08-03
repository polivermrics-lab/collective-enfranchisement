import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'

// ============ STATUTORY THRESHOLDS & CONSTANTS ============

// Qualifying tenant fraction for collective enfranchisement
const QUALIFYING_TENANT_FRACTION = 2 / 3

// Participation fraction (minimum participating tenants)
const PARTICIPATION_FRACTION = 1 / 2

// Non-residential floor area limit
// LFRA 2024 raises this to 50% for collective enfranchisement but commencement is 
// disputed/unconfirmed as of 2026-07-30. Do not change without explicit surveyor 
// confirmation of commencement.
const NON_RESIDENTIAL_FLOOR_AREA_LIMIT = 25

// Marriage value disclosure note
const MARRIAGE_VALUE_DISCLOSURE = 'Marriage value remains payable under current law as of 2026-07-30. LFRA 2024 provides for its future abolition; commencement is not yet confirmed and is subject to ongoing legal challenge.'

// ============ DATABASE CONNECTION ============

let client
let clientPromise

async function connectToMongo() {
  const uri = process.env.MONGO_URL || 'mongodb://localhost:27017'
  const dbName = process.env.DB_NAME || 'collective_enfranchisement'
  
  if (!clientPromise) {
    client = new MongoClient(uri)
    clientPromise = client.connect()
  }
  
  await clientPromise
  return client.db(dbName)
}

// Helper function to handle CORS with per-request origin validation
function handleCORS(request, response) {
  const allowedOrigins = (process.env.CORS_ORIGINS || '*').split(',').map(o => o.trim());
  const requestOrigin = request ? request.headers.get('origin') : null;
  
  if (allowedOrigins.includes('*')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    response.headers.set('Access-Control-Allow-Origin', requestOrigin);
    response.headers.set('Vary', 'Origin');
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

// ============ ELIGIBILITY LOGIC ============

function calculateEligibility(building, flats) {
  const totalFlats = building.total_flat_count || 0
  const qualifyingTenants = flats.filter(f => f.participating).length
  const nonResPct = building.non_residential_floor_area_pct || 0
  const selfContained = building.self_contained
  
  const reasons = []
  
  // 1. Qualifying tenant fraction (2/3 rule)
  const reqQualifying = Math.ceil(totalFlats * QUALIFYING_TENANT_FRACTION)
  const qualifyingPassed = qualifyingTenants >= reqQualifying
  reasons.push({
    test: 'qualifying_tenant_fraction',
    passed: qualifyingPassed,
    message: qualifyingPassed ? 'Two-thirds qualifying tenant test passed' : 'Less than two-thirds of units are held by qualifying tenants',
    required: `>= ${reqQualifying} units`,
    actual: `${qualifyingTenants} units`
  })
  
  // 2. Non-residential floor area (25% rule)
  const nonResPassed = nonResPct <= NON_RESIDENTIAL_FLOOR_AREA_LIMIT
  reasons.push({
    test: 'non_residential_floor_area',
    passed: nonResPassed,
    message: nonResPassed ? 'Non-residential floor area test passed' : 'Non-residential floor area exceeds statutory limit',
    required: `<= ${NON_RESIDENTIAL_FLOOR_AREA_LIMIT}%`,
    actual: `${nonResPct}%`
  })
  
  // 3. Self-contained building flag
  reasons.push({
    test: 'self_contained_building',
    passed: selfContained === null ? null : selfContained,
    message: selfContained === true ? 'Building is self-contained' : selfContained === false ? 'Building is not self-contained' : 'Self-contained status not yet confirmed by surveyor',
    required: 'true',
    actual: selfContained === null ? 'null' : selfContained.toString()
  })
  
  const eligible = qualifyingPassed && nonResPassed && selfContained === true
  const status = selfContained === null ? 'pending' : (eligible ? 'eligible' : 'ineligible')
  
  return {
    eligible,
    status,
    reasons,
    threshold_basis: {
      non_residential_limit_used: NON_RESIDENTIAL_FLOOR_AREA_LIMIT,
      date_assessed: new Date().toISOString().split('T')[0],
      lfra_2024_status: 'not commenced',
      lfra_2024_note: 'LFRA 2024 raises this limit to 50% but commencement is unconfirmed.'
    },
    marriage_value_disclosure: MARRIAGE_VALUE_DISCLOSURE,
    assessment_date: new Date().toISOString().split('T')[0]
  }
}

// ============ ELEMENT C LOGIC ============

function calculateElementC(building) {
  const mode = building.element_c_override || 'AUTO'
  const valueBefore = building.retained_property_value_before
  const valueAfter = building.retained_property_value_after
  const overrideValue = building.element_c_override_value
  
  let value = 0
  let surveyorReviewRequired = false
  let calculationDetails = {}
  
  if (mode === 'FORCE_ZERO') {
    // Surveyor explicitly confirms nil Element C
    value = 0
    calculationDetails = {
      mode: 'FORCE_ZERO',
      justification: building.element_c_override_justification
    }
  } else if (mode === 'FORCE_VALUE') {
    // Surveyor enters specific figure directly
    value = overrideValue || 0
    calculationDetails = {
      mode: 'FORCE_VALUE',
      justification: building.element_c_override_justification
    }
  } else {
    // AUTO mode: formula-based
    if (valueBefore === null || valueAfter === null || valueBefore === undefined || valueAfter === undefined) {
      value = 0
    } else {
      const rawDifference = valueBefore - valueAfter
      value = Math.max(0, rawDifference)
      
      if (rawDifference < 0) {
        // Retained property increased in value - flag for review
        surveyorReviewRequired = true
      }
    }
    calculationDetails = {
      mode: 'AUTO',
      formula: 'value_before - value_after',
      value_before: valueBefore,
      value_after: valueAfter
    }
  }
  
  return {
    value,
    mode,
    surveyorReviewRequired,
    details: calculationDetails
  }
}

// ============ NOTICE STATE TRANSITIONS ============

const NOTICE_STAGES = [
  'Draft',
  'Notice Served (s.13)',
  'Landlord Counter-Notice Received (s.21)',
  'Terms Agreed',
  'Tribunal Referral',
  'Completion'
]

const EXPECTED_NEXT_STAGES = {
  'Draft': ['Notice Served (s.13)'],
  'Notice Served (s.13)': ['Landlord Counter-Notice Received (s.21)', 'Terms Agreed'],
  'Landlord Counter-Notice Received (s.21)': ['Terms Agreed', 'Tribunal Referral'],
  'Terms Agreed': ['Completion'],
  'Tribunal Referral': ['Terms Agreed', 'Completion']
}

function validateStageTransition(currentStage, newStage) {
  const warnings = []
  
  if (!NOTICE_STAGES.includes(newStage)) {
    return {
      valid: false,
      warnings: [{
        type: 'invalid_stage', 
        severity: 'error', 
        message: `Stage '${newStage}' is not a valid notice stage.`
      }]
    }
  }
  
  if (currentStage) {
    const expected = EXPECTED_NEXT_STAGES[currentStage] || []
    
    // Out-of-sequence
    if (!expected.includes(newStage)) {
      const currentIndex = NOTICE_STAGES.indexOf(currentStage)
      const newIndex = NOTICE_STAGES.indexOf(newStage)
      
      if (newIndex < currentIndex) {
        warnings.push({
          type: 'backwards_transition',
          severity: 'warning', 
          message: `Transitioning backwards from '${currentStage}' to '${newStage}'.`
        })
      } else {
        warnings.push({
          type: 'out_of_sequence',
          severity: 'warning',
          message: `Transition from '${currentStage}' to '${newStage}' is out of expected sequence. Expected: ${expected.join(' or ')}`
        })
      }
    }
  }
  
  return {
    valid: true, 
    warnings
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(request) {
  return handleCORS(request, new NextResponse(null, { status: 204 }));
}

// Route handler function
async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const method = request.method
  const route = '/' + path.join('/')

  try {
    const db = await connectToMongo()

    // Root endpoint
    if (route === '/' && method === 'GET') {
      return handleCORS(request, NextResponse.json({ message: "Collective Enfranchisement API" }))
    }

    // ============ BUILDINGS ENDPOINTS ============ 
    
    // GET /api/buildings - List all buildings
    if (route === '/buildings' && method === 'GET') {
      const buildings = await db.collection('buildings')
        .find({})
        .sort({ valuation_date: -1 })
        .toArray()
      
      const cleanedBuildings = buildings.map(({ _id, ...rest }) => rest)
      return handleCORS(request, NextResponse.json(cleanedBuildings))
    }

    // POST /api/buildings - Create building
    if (route === '/buildings' && method === 'POST') {
      const body = await request.json()
      
      const building = {
        building_id: uuidv4(),
        address: body.address || '',
        total_flat_count: body.total_flat_count || 0,
        non_residential_floor_area_pct: body.non_residential_floor_area_pct || 0, 
        freeholder_name: body.freeholder_name || '',
        freeholder_address: body.freeholder_address || '',
        valuation_date: body.valuation_date || new Date().toISOString().split('T')[0],
        self_contained: body.self_contained !== undefined ? body.self_contained : null, 
        retained_property_description: body.retained_property_description || '',
        retained_property_value_before: body.retained_property_value_before || null,
        retained_property_value_after: body.retained_property_value_after || null,
        element_c_override: body.element_c_override || 'AUTO',
        element_c_override_value: body.element_c_override_value || null,
        element_c_override_justification: body.element_c_override_justification || '',
        created_at: new Date().toISOString()
      }
      
      // Calculate initial eligibility (likely pending/ineligible with 0 flats)
      building.eligibility_status = 'pending'
      const eligibilityResult = calculateEligibility(building, [])
      building.eligibility_result = eligibilityResult
      
      // Calculate Element C
      const elementCResult = calculateElementC(building)
      building.element_c_result = elementCResult
      
      await db.collection('buildings').insertOne(building)
      const { _id, ...cleanBuilding } = building
      return handleCORS(request, NextResponse.json(cleanBuilding, { status: 201 }))
    }

    // GET /api/buildings/[id] - Get single building
    if (route.match(/^\/buildings\/[a-f0-9-]+$/) && method === 'GET') {
      const buildingId = path[1]
      const building = await db.collection('buildings').findOne({ building_id: buildingId })
      
      if (!building) {
        return handleCORS(request, NextResponse.json({ error: 'Building not found' }, { status: 404 }))
      }
      
      const { _id, ...cleanBuilding } = building
      return handleCORS(request, NextResponse.json(cleanBuilding))
    }

    // PUT /api/buildings/[id] - Update building
    if (route.match(/^\/buildings\/[a-f0-9-]+$/) && method === 'PUT') {
      const buildingId = path[1]
      const body = await request.json()
      
      const updates = { ...body }
      delete updates.building_id
      delete updates._id
      
      // If updating threshold fields, recalculate eligibility
      const flats = await db.collection('flats').find({ building_id: buildingId }).toArray()
      const building = await db.collection('buildings').findOne({ building_id: buildingId })
      
      if (!building) {
        return handleCORS(request, NextResponse.json({ error: 'Building not found' }, { status: 404 }))
      }
      
      const mergedBuilding = { ...building, ...updates }
      const eligibilityResult = calculateEligibility(mergedBuilding, flats)
      updates.eligibility_status = eligibilityResult.status
      updates.eligibility_result = eligibilityResult
      
      // Recalculate Element C
      const elementCResult = calculateElementC(mergedBuilding)
      updates.element_c_result = elementCResult
      
      const result = await db.collection('buildings').findOneAndUpdate(
        { building_id: buildingId },
        { $set: updates },
        { returnDocument: 'after' }
      )
      
      if (!result) {
        return handleCORS(request, NextResponse.json({ error: 'Building not found' }, { status: 404 }))
      }
      
      const { _id, ...cleanBuilding } = result
      return handleCORS(request, NextResponse.json(cleanBuilding))
    }

    // DELETE /api/buildings/[id] - Delete building
    if (route.match(/^\/buildings\/[a-f0-9-]+$/) && method === 'DELETE') {
      const buildingId = path[1]
      
      // Cascade delete
      await db.collection('flats').deleteMany({ building_id: buildingId })
      await db.collection('notices').deleteMany({ building_id: buildingId })
      await db.collection('nominees').deleteMany({ building_id: buildingId })
      
      const result = await db.collection('buildings').deleteOne({ building_id: buildingId })
      
      if (result.deletedCount === 0) {
        return handleCORS(request, NextResponse.json({ error: 'Building not found' }, { status: 404 }))
      }
      
      return handleCORS(request, NextResponse.json({ success: true }))
    }

    // ============ FLATS ENDPOINTS ============ 
    
    // GET /api/buildings/[id]/flats - List flats for building
    if (route.match(/^\/buildings\/[a-f0-9-]+\/flats$/) && method === 'GET') {
      const buildingId = path[1]
      const flats = await db.collection('flats')
        .find({ building_id: buildingId })
        .sort({ unit_identifier: 1 })
        .toArray()
      
      const cleanedFlats = flats.map(({ _id, ...rest }) => rest)
      return handleCORS(request, NextResponse.json(cleanedFlats))
    }

    // POST /api/buildings/[id]/flats - Create flat
    if (route.match(/^\/buildings\/[a-f0-9-]+\/flats$/) && method === 'POST') {
      const buildingId = path[1]
      const body = await request.json()
      
      // Verify building exists
      const building = await db.collection('buildings').findOne({ building_id: buildingId })
      if (!building) {
        return handleCORS(request, NextResponse.json({ error: 'Building not found' }, { status: 404 }))
      }
      
      const flat = {
        flat_id: uuidv4(),
        building_id: buildingId,
        unit_identifier: body.unit_identifier || '',
        leaseholder_name: body.leaseholder_name || '',
        lease_start_date: body.lease_start_date || '',
        lease_end_date: body.lease_end_date || '',
        participating: body.participating !== undefined ? body.participating : true, 
        individual_premium: body.individual_premium || null,
        created_at: new Date().toISOString()
      }
      
      await db.collection('flats').insertOne(flat)
      
      // Recalculate building eligibility
      const flats = await db.collection('flats').find({ building_id: buildingId }).toArray()
      const eligibilityResult = calculateEligibility(building, flats)
      await db.collection('buildings').updateOne(
        { building_id: buildingId },
        { $set: { 
          eligibility_status: eligibilityResult.status,
          eligibility_result: eligibilityResult
        }}
      )
      
      const { _id, ...cleanFlat } = flat
      return handleCORS(request, NextResponse.json(cleanFlat, { status: 201 }))
    }

    // GET /api/flats/[id] - Get single flat
    if (route.match(/^\/flats\/[a-f0-9-]+$/) && method === 'GET') {
      const flatId = path[1]
      const flat = await db.collection('flats').findOne({ flat_id: flatId })
      
      if (!flat) {
        return handleCORS(request, NextResponse.json({ error: 'Flat not found' }, { status: 404 }))
      }
      
      const { _id, ...cleanFlat } = flat
      return handleCORS(request, NextResponse.json(cleanFlat))
    }

    // PUT /api/flats/[id] - Update flat
    if (route.match(/^\/flats\/[a-f0-9-]+$/) && method === 'PUT') {
      const flatId = path[1]
      const body = await request.json()
      
      const updates = { ...body }
      delete updates.flat_id
      delete updates.building_id
      delete updates._id
      
      const result = await db.collection('flats').findOneAndUpdate(
        { flat_id: flatId },
        { $set: updates },
        { returnDocument: 'after' }
      )
      
      if (!result) {
        return handleCORS(request, NextResponse.json({ error: 'Flat not found' }, { status: 404 }))
      }
      
      // Recalculate building eligibility
      const building = await db.collection('buildings').findOne({ building_id: result.building_id })
      if (building) {
        const flats = await db.collection('flats').find({ building_id: result.building_id }).toArray()
        const eligibilityResult = calculateEligibility(building, flats)
        await db.collection('buildings').updateOne(
          { building_id: result.building_id },
          { $set: { 
            eligibility_status: eligibilityResult.status,
            eligibility_result: eligibilityResult
          }}
        )
      }
      
      const { _id, ...cleanFlat } = result
      return handleCORS(request, NextResponse.json(cleanFlat))
    }

    // DELETE /api/flats/[id] - Delete flat
    if (route.match(/^\/flats\/[a-f0-9-]+$/) && method === 'DELETE') {
      const flatId = path[1]
      const flat = await db.collection('flats').findOne({ flat_id: flatId })
      
      if (!flat) {
        return handleCORS(request, NextResponse.json({ error: 'Flat not found' }, { status: 404 }))
      }
      
      const buildingId = flat.building_id
      const result = await db.collection('flats').deleteOne({ flat_id: flatId })
      
      if (result.deletedCount === 0) {
        return handleCORS(request, NextResponse.json({ error: 'Flat not found' }, { status: 404 }))
      }
      
      // Recalculate building eligibility
      const building = await db.collection('buildings').findOne({ building_id: buildingId })
      if (building) {
        const flats = await db.collection('flats').find({ building_id: buildingId }).toArray()
        const eligibilityResult = calculateEligibility(building, flats)
        await db.collection('buildings').updateOne(
          { building_id: buildingId },
          { $set: { 
            eligibility_status: eligibilityResult.status,
            eligibility_result: eligibilityResult
          }}
        )
      }
      
      return handleCORS(request, NextResponse.json({ success: true }))
    }

    // ============ NOMINEE PURCHASER ENDPOINTS ============ 
    
    // GET /api/buildings/[id]/nominee - Get nominee for building
    if (route.match(/^\/buildings\/[a-f0-9-]+\/nominee$/) && method === 'GET') {
      const buildingId = path[1]
      const nominee = await db.collection('nominees').findOne({ building_id: buildingId })
      
      if (!nominee) {
        return handleCORS(request, NextResponse.json(null))
      }
      
      const { _id, ...cleanNominee } = nominee
      return handleCORS(request, NextResponse.json(cleanNominee))
    }

    // POST /api/buildings/[id]/nominee - Create/update nominee
    if (route.match(/^\/buildings\/[a-f0-9-]+\/nominee$/) && method === 'POST') {
      const buildingId = path[1]
      const body = await request.json()
      
      // Verify building exists
      const building = await db.collection('buildings').findOne({ building_id: buildingId })
      if (!building) {
        return handleCORS(request, NextResponse.json({ error: 'Building not found' }, { status: 404 }))
      }
      
      // Check if nominee already exists
      const existingNominee = await db.collection('nominees').findOne({ building_id: buildingId })
      
      if (existingNominee) {
        // Update existing
        const updates = {
          entity_name: body.entity_name || existingNominee.entity_name,
          formation_date: body.formation_date || existingNominee.formation_date
        }
        
        const result = await db.collection('nominees').findOneAndUpdate(
          { building_id: buildingId },
          { $set: updates },
          { returnDocument: 'after' }
        )
        
        const { _id, ...cleanNominee } = result
        return handleCORS(request, NextResponse.json(cleanNominee))
      } else {
        // Create new
        const nominee = {
          nominee_id: uuidv4(),
          building_id: buildingId, 
          entity_name: body.entity_name || '',
          formation_date: body.formation_date || '',
          created_at: new Date().toISOString()
        }
        
        await db.collection('nominees').insertOne(nominee)
        const { _id, ...cleanNominee } = nominee
        return handleCORS(request, NextResponse.json(cleanNominee, { status: 201 }))
      }
    }

    // ============ APPORTIONMENT ENDPOINT (Phase 3) ============ 
    
    // GET /api/buildings/[id]/apportionment - Get aggregate total and apportionment
    if (route.match(/^\/buildings\/[a-f0-9-]+\/apportionment$/) && method === 'GET') {
      const buildingId = path[1]
      
      // Fetch building
      const building = await db.collection('buildings').findOne({ building_id: buildingId })
      if (!building) {
        return handleCORS(request, NextResponse.json({ error: 'Building not found' }, { status: 404 }))
      }
      
      // Fetch all flats for the building
      const flats = await db.collection('flats')
        .find({ building_id: buildingId })
        .toArray()
      
      // Filter participating flats
      const participatingFlats = flats.filter(f => f.participating && f.individual_premium !== null)
      
      // Totals
      const allFlatsPremiumTotal = flats.reduce((sum, f) => sum + (f.individual_premium || 0), 0)
      const participatingPremiumTotal = participatingFlats.reduce((sum, f) => sum + f.individual_premium, 0)
      
      const elementCResult = calculateElementC(building)
      const aggregateTotal = allFlatsPremiumTotal + elementCResult.value
      
      // Apportionment calculation
      const apportionmentResult = participatingFlats.map(flat => {
        const sharePercentage = (flat.individual_premium / participatingPremiumTotal)
        const apportionedAmount = sharePercentage * aggregateTotal
        const elementCShare = sharePercentage * elementCResult.value
        
        return {
          unit_identifier: flat.unit_identifier, 
          leaseholder_name: flat.leaseholder_name, 
          share_percentage: sharePercentage * 100,
          apportioned_amount: Math.round(apportionedAmount * 100) / 100,
          element_c_share: Math.round(elementCShare * 100) / 100
        }
      })
      
      const result = {
        totals: {
          all_flats_premium: Math.round(allFlatsPremiumTotal * 100) / 100,
          participating_premium_sum: Math.round(participatingPremiumTotal * 100) / 100,
          element_c: elementCResult.value,
          aggregate_total: Math.round(aggregateTotal * 100) / 100
        },
        element_c: elementCResult,
        apportionment: apportionmentResult,
        calculation_date: new Date().toISOString()
      }
      
      return handleCORS(request, NextResponse.json(result))
    }

    // ============ NOTICE RECORD ENDPOINTS (Phase 4) ============ 
    
    // POST /api/buildings/[id]/notice - Create notice record for building
    if (route.match(/^\/buildings\/[a-f0-9-]+\/notice$/) && method === 'POST') {
      const buildingId = path[1]
      const body = await request.json()
      
      // Verify building exists
      const building = await db.collection('buildings').findOne({ building_id: buildingId })
      if (!building) {
        return handleCORS(request, NextResponse.json({ error: 'Building not found' }, { status: 404 }))
      }
      
      // Check if notice already exists for this building
      const existingNotice = await db.collection('notices').findOne({ building_id: buildingId })
      if (existingNotice) {
        return handleCORS(request, NextResponse.json({ 
          error: 'Notice record already exists for this building', 
          notice_id: existingNotice.notice_id
        }, { status: 409 }))
      }
      
      const initialStage = body.stage || 'Draft'
      const validation = validateStageTransition(null, initialStage)
      
      if (!validation.valid) {
        return handleCORS(request, NextResponse.json({ 
          error: 'Invalid initial stage', 
          warnings: validation.warnings
        }, { status: 400 }))
      }
      
      const notice = {
        notice_id: uuidv4(),
        building_id: buildingId, 
        stage: initialStage,
        notice_served_date: body.notice_served_date || null,
        counter_notice_received_date: body.counter_notice_received_date || null,
        terms_agreed_date: body.terms_agreed_date || null,
        tribunal_referral_date: body.tribunal_referral_date || null,
        completion_date: body.completion_date || null,
        document_references: body.document_references || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        stage_history: [
          {
            stage: initialStage,
            date: new Date().toISOString(),
            user: body.user || 'system', 
            notes: body.notes || 'Notice initialized',
            warnings: validation.warnings
          }
        ]
      }
      
      await db.collection('notices').insertOne(notice)
      const { _id, ...cleanNotice } = notice
      
      return handleCORS(request, NextResponse.json({
        ...cleanNotice,
        validation_warnings: validation.warnings
      }, { status: 201 }))
    }
    
    // GET /api/buildings/[id]/notice - Get notice record for building
    if (route.match(/^\/buildings\/[a-f0-9-]+\/notice$/) && method === 'GET') {
      const buildingId = path[1]
      
      const notice = await db.collection('notices').findOne({ building_id: buildingId })
      
      if (!notice) {
        return handleCORS(request, NextResponse.json({ error: 'Notice record not found' }, { status: 404 }))
      }
      
      const { _id, ...cleanNotice } = notice
      return handleCORS(request, NextResponse.json(cleanNotice))
    }
    
    // GET /api/notices/[id] - Get single notice by notice_id
    if (route.match(/^\/notices\/[a-f0-9-]+$/) && method === 'GET') {
      const noticeId = path[1]
      
      const notice = await db.collection('notices').findOne({ notice_id: noticeId })
      
      if (!notice) {
        return handleCORS(request, NextResponse.json({ error: 'Notice record not found' }, { status: 404 }))
      }
      
      const { _id, ...cleanNotice } = notice
      return handleCORS(request, NextResponse.json(cleanNotice))
    }
    
    // PUT /api/notices/[id] - Update notice record (stage transitions)
    if (route.match(/^\/notices\/[a-f0-9-]+$/) && method === 'PUT') {
      const noticeId = path[1]
      const body = await request.json()
      
      // Fetch existing notice
      const existingNotice = await db.collection('notices').findOne({ notice_id: noticeId })
      
      if (!existingNotice) {
        return handleCORS(request, NextResponse.json({ error: 'Notice record not found' }, { status: 404 }))
      }
      
      const updates = {
        notice_served_date: body.notice_served_date !== undefined ? body.notice_served_date : existingNotice.notice_served_date,
        counter_notice_received_date: body.counter_notice_received_date !== undefined ? body.counter_notice_received_date : existingNotice.counter_notice_received_date,
        terms_agreed_date: body.terms_agreed_date !== undefined ? body.terms_agreed_date : existingNotice.terms_agreed_date,
        tribunal_referral_date: body.tribunal_referral_date !== undefined ? body.tribunal_referral_date : existingNotice.tribunal_referral_date, 
        completion_date: body.completion_date !== undefined ? body.completion_date : existingNotice.completion_date,
        document_references: body.document_references !== undefined ? body.document_references : existingNotice.document_references, 
        updated_at: new Date().toISOString()
      }
      
      let validationWarnings = []
      
      if (body.stage && body.stage !== existingNotice.stage) {
        const validation = validateStageTransition(existingNotice.stage, body.stage)
        validationWarnings = validation.warnings
        
        if (!validation.valid) {
          return handleCORS(request, NextResponse.json({ 
            error: 'Invalid stage transition', 
            warnings: validation.warnings
          }, { status: 400 }))
        }
        
        updates.stage = body.stage
        
        // Append to history
        const historyEntry = {
          stage: body.stage,
          date: new Date().toISOString(),
          user: body.user || 'system', 
          notes: body.notes || `Transitioned from ${existingNotice.stage} to ${body.stage}`, 
          warnings: validationWarnings
        }
        
        await db.collection('notices').updateOne(
          { notice_id: noticeId },
          { $push: { stage_history: historyEntry } }
        )
      }
      
      const result = await db.collection('notices').findOneAndUpdate(
        { notice_id: noticeId },
        { $set: updates },
        { returnDocument: 'after' }
      )
      
      if (!result) {
        return handleCORS(request, NextResponse.json({ error: 'Failed to update notice' }, { status: 500 }))
      }
      
      const { _id, ...cleanNotice } = result
      
      return handleCORS(request, NextResponse.json({
        ...cleanNotice,
        validation_warnings: validationWarnings
      }))
    }
    
    // DELETE /api/notices/[id] - Delete notice record
    if (route.match(/^\/notices\/[a-f0-9-]+$/) && method === 'DELETE') {
      const noticeId = path[1]
      
      const result = await db.collection('notices').deleteOne({ notice_id: noticeId })
      
      if (result.deletedCount === 0) {
        return handleCORS(request, NextResponse.json({ error: 'Notice record not found' }, { status: 404 }))
      }
      
      return handleCORS(request, NextResponse.json({ success: true }))
    }

    // ============ ENGINE ENDPOINT ============ 
    
    // POST /api/engine/compute-flat-premium - Compute premium via extension-valuer
    if (route === '/engine/compute-flat-premium' && method === 'POST') {
      const body = await request.json()
      
      if (!body.flat_id) {
        return handleCORS(request, NextResponse.json({ error: 'flat_id is required' }, { status: 400 }))
      }
      
      try {
        // AUTHENTICATION with extension-valuer
        // For security, credentials should be in environment variables
        const username = process.env.EXTENSION_VALUER_USER || 'admin@test.com'
        const password = process.env.EXTENSION_VALUER_PASSWORD || 'admin123'
        const extensionValuerBase = process.env.EXTENSION_VALUER_BASE_URL || 'https://extension-valuer.preview.emergentagent.com'
        
        // Step 1: Login to get session
        const loginResponse = await fetch(`${extensionValuerBase}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: username, password })
        })
        
        if (!loginResponse.ok) {
          throw new Error(`Authentication failed: ${loginResponse.status}`)
        }
        
        const cookie = loginResponse.headers.get('set-cookie')
        if (!cookie) {
          throw new Error('No session cookie received from authentication')
        }
        
        // Step 2: Call the compute-headlease-premium endpoint
        const engineRequest = {
          fhvp: body.fhvp || 0,
          unexpired_years: body.unexpired_years || 0,
          deferment_rate: body.deferment_rate || 0.05,
          cap_rate: body.cap_rate || 0.07,
          relativity: body.relativity || 0.885,
          freeholder_ground_rent: body.freeholder_ground_rent || 0,
          il_rent_receivable: body.il_rent_receivable || 0,
          il_cap_rate: body.il_cap_rate || 0.07,
          il_def_rate: body.il_def_rate || 0.05
        }
        
        const engineResponse = await fetch(`${extensionValuerBase}/api/engine/compute-headlease-premium`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': cookie
          },
          body: JSON.stringify(engineRequest)
        })
        
        if (!engineResponse.ok) {
          const errData = await engineResponse.json()
          throw new Error(errData.details || errData.error || `Engine call failed: ${engineResponse.status}`)
        }
        
        const engineResult = await engineResponse.json()
        const totalPremium = engineResult.total_premium || 0
        
        // Step 3: Update flat record with result
        await db.collection('flats').updateOne(
          { flat_id: body.flat_id },
          { $set: { individual_premium: totalPremium } }
        )
        
        const result = {
          flat_id: body.flat_id,
          premium: totalPremium, 
          computation_date: new Date().toISOString(),
          engine_response: engineResult
        }
        
        return handleCORS(request, NextResponse.json(result))
        
      } catch (engineError) {
        console.error('Engine integration error:', engineError)
        return handleCORS(request, NextResponse.json(
          { 
            error: 'Failed to compute premium via engine', 
            details: engineError.message, 
            flat_id: body.flat_id
          }, 
          { status: 500 }
        ))
      }
    }

    // Route not found
    return handleCORS(request, NextResponse.json(
      { error: `Route ${route} not found` }, 
      { status: 404 }
    ))

  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(request, NextResponse.json(
      { error: "Internal server error", details: error.message }, 
      { status: 500 }
    ))
  }
}

export async function GET(request, context) { return handleRoute(request, context) }
export async function POST(request, context) { return handleRoute(request, context) }
export async function PUT(request, context) { return handleRoute(request, context) }
export async function DELETE(request, context) { return handleRoute(request, context) }
