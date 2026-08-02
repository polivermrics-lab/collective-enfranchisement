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