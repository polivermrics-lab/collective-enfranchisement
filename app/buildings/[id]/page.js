'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ArrowLeft, Plus, Calculator, Building2, Users, Calendar, Trash2, AlertTriangle, CheckCircle2, XCircle, Clock, FileText, AlertCircle } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export default function BuildingDetail() {
  const router = useRouter()
  const params = useParams()
  const buildingId = params?.id

  const [building, setBuilding] = useState(null)
  const [flats, setFlats] = useState([])
  const [nominee, setNominee] = useState(null)
  const [apportionment, setApportionment] = useState(null)
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [computingPremium, setComputingPremium] = useState(null)
  const [nomineeDialogOpen, setNomineeDialogOpen] = useState(false)
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false)
  const [elementCDialogOpen, setElementCDialogOpen] = useState(false)
  
  const [nomineeForm, setNomineeForm] = useState({
    entity_name: '',
    formation_date: new Date().toISOString().split('T')[0]
  })
  
  const [elementCForm, setElementCForm] = useState({
    retained_property_description: '',
    retained_property_value_before: '',
    retained_property_value_after: '',
    element_c_override: 'AUTO',
    element_c_override_value: '',
    element_c_override_justification: ''
  })
  
  const [noticeForm, setNoticeForm] = useState({
    stage: 'Draft',
    user: 'surveyor@example.com',
    notes: ''
  })

  useEffect(() => {
    if (buildingId) {
      fetchAllData()
    }
  }, [buildingId])

  const fetchAllData = async () => {
    try {
      const [buildingRes, flatsRes, nomineeRes, apportionmentRes, noticeRes] = await Promise.all([
        fetch(`/api/buildings/${buildingId}`),
        fetch(`/api/buildings/${buildingId}/flats`),
        fetch(`/api/buildings/${buildingId}/nominee`),
        fetch(`/api/buildings/${buildingId}/apportionment`),
        fetch(`/api/buildings/${buildingId}/notice`)
      ])

      if (buildingRes.ok) {
        const buildingData = await buildingRes.json()
        setBuilding(buildingData)
        
        if (buildingData) {
          setElementCForm({
            retained_property_description: buildingData.retained_property_description || '',
            retained_property_value_before: buildingData.retained_property_value_before || '',
            retained_property_value_after: buildingData.retained_property_value_after || '',
            element_c_override: buildingData.element_c_override || 'AUTO',
            element_c_override_value: buildingData.element_c_override_value || '',
            element_c_override_justification: buildingData.element_c_override_justification || ''
          })
        }
      }

      if (flatsRes.ok) {
        const flatsData = await flatsRes.json()
        setFlats(flatsData)
      }

      if (nomineeRes.ok) {
        const nomineeData = await nomineeRes.json()
        setNominee(nomineeData)
        if (nomineeData) {
          setNomineeForm({
            entity_name: nomineeData.entity_name,
            formation_date: nomineeData.formation_date
          })
        }
      }
      
      if (apportionmentRes.ok) {
        const apportionmentData = await apportionmentRes.json()
        setApportionment(apportionmentData)
      }
      
      if (noticeRes.ok) {
        const noticeData = await noticeRes.json()
        setNotice(noticeData)
      }
    } catch (error) {
      console.error('Failed to fetch building data:', error)
    } finally {
      setLoading(false)
    }
  }

  const computePremium = async (flat) => {
    setComputingPremium(flat.flat_id)
    try {
      const leaseEndDate = new Date(flat.lease_end_date)
      const valuationDate = new Date(building.valuation_date)
      const unexpiredYears = (leaseEndDate - valuationDate) / (1000 * 60 * 60 * 24 * 365.25)
      
      const response = await fetch('/api/engine/compute-flat-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flat_id: flat.flat_id,
          fhvp: 450000,
          unexpired_years: unexpiredYears,
          deferment_rate: 0.05,
          cap_rate: 0.07,
          relativity: 0.92,
          freeholder_ground_rent: 250,
          il_rent_receivable: 0,
          il_cap_rate: 0.07,
          il_def_rate: 0.05
        })
      })

      if (response.ok) {
        const result = await response.json()
        setFlats(flats.map(f => 
          f.flat_id === flat.flat_id 
            ? { ...f, individual_premium: result.premium }
            : f
        ))
        fetchAllData()
      } else {
        alert('Failed to compute premium')
      }
    } catch (error) {
      console.error('Error computing premium:', error)
      alert('Failed to compute premium')
    } finally {
      setComputingPremium(null)
    }
  }

  const saveNominee = async () => {
    try {
      const response = await fetch(`/api/buildings/${buildingId}/nominee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nomineeForm)
      })

      if (response.ok) {
        const nomineeData = await response.json()
        setNominee(nomineeData)
        setNomineeDialogOpen(false)
      } else {
        alert('Failed to save nominee')
      }
    } catch (error) {
      console.error('Error saving nominee:', error)
      alert('Failed to save nominee')
    }
  }
  
  const saveElementC = async () => {
    try {
      const response = await fetch(`/api/buildings/${buildingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...building,
          ...elementCForm,
          retained_property_value_before: elementCForm.retained_property_value_before ? parseFloat(elementCForm.retained_property_value_before) : null,
          retained_property_value_after: elementCForm.retained_property_value_after ? parseFloat(elementCForm.retained_property_value_after) : null,
          element_c_override_value: elementCForm.element_c_override_value ? parseFloat(elementCForm.element_c_override_value) : null
        })
      })

      if (response.ok) {
        fetchAllData()
        setElementCDialogOpen(false)
      } else {
        alert('Failed to save Element C')
      }
    } catch (error) {
      console.error('Error saving Element C:', error)
      alert('Failed to save Element C')
    }
  }
  
  const createNotice = async () => {
    try {
      const response = await fetch(`/api/buildings/${buildingId}/notice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noticeForm)
      })

      if (response.ok) {
        const noticeData = await response.json()
        setNotice(noticeData)
        setNoticeDialogOpen(false)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create notice')
      }
    } catch (error) {
      console.error('Error creating notice:', error)
      alert('Failed to create notice')
    }
  }

  const deleteFlat = async (flatId) => {
    if (!confirm('Are you sure you want to delete this flat?')) return

    try {
      const response = await fetch(`/api/flats/${flatId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setFlats(flats.filter(f => f.flat_id !== flatId))
        fetchAllData()
      } else {
        alert('Failed to delete flat')
      }
    } catch (error) {
      console.error('Error deleting flat:', error)
      alert('Failed to delete flat')
    }
  }

  const getEligibilityBadge = (status) => {
    const variants = {
      eligible: { color: 'bg-green-100 text-green-800 border-green-300', label: 'Eligible', icon: CheckCircle2 },
      ineligible: { color: 'bg-red-100 text-red-800 border-red-300', label: 'Ineligible', icon: XCircle },
      pending: { color: 'bg-amber-100 text-amber-800 border-amber-300', label: 'Pending', icon: Clock }
    }
    const variant = variants[status] || variants.pending
    const Icon = variant.icon
    return (
      <Badge className={`${variant.color} border font-medium flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {variant.label}
      </Badge>
    )
  }
  
  const getStageIndex = (stage) => {
    const stages = ['Draft', 'Notice Served (s.13)', 'Landlord Counter-Notice Received (s.21)', 'Terms Agreed', 'Tribunal Referral', 'Completion']
    return stages.indexOf(stage)
  }

  const totalPremium = flats
    .filter(f => f.participating && f.individual_premium)
    .reduce((sum, f) => sum + f.individual_premium, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-900 border-r-transparent"></div>
          <p className="mt-4 text-slate-600">Loading building...</p>
        </div>
      </div>
    )
  }

  if (!building) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-600 mb-4">Building not found</p>
            <Button onClick={() => router.push('/')} className="bg-blue-900 hover:bg-blue-800">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="mb-6 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        {/* Building Header */}
        <Card className="mb-6 border-slate-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-800 text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="h-10 w-10" />
                <div>
                  <CardTitle className="text-3xl mb-2">{building.address}</CardTitle>
                  <CardDescription className="text-blue-100 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Valuation Date: {building.valuation_date}
                  </CardDescription>
                </div>
              </div>
              {getEligibilityBadge(building.eligibility_status)}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Flats</p>
                <p className="text-3xl font-bold text-slate-900">{building.total_flat_count}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Qualifying Tenants</p>
                <p className="text-3xl font-bold text-slate-900">{building.qualifying_tenant_count || 0}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Non-Residential %</p>
                <p className="text-3xl font-bold text-slate-900">{building.non_residential_floor_area_pct}%</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Premium</p>
                <p className="text-3xl font-bold text-blue-900">
                  £{totalPremium.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Tabs defaultValue="eligibility" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
            <TabsTrigger value="flats">Flats</TabsTrigger>
            <TabsTrigger value="apportionment">Apportionment</TabsTrigger>
            <TabsTrigger value="element-c">Element C</TabsTrigger>
            <TabsTrigger value="notice">Notice Tracker</TabsTrigger>
          </TabsList>
          
          {/* Eligibility Tab */}
          <TabsContent value="eligibility">
            <Card>
              <CardHeader>
                <CardTitle>Eligibility Assessment</CardTitle>
                <CardDescription>Statutory tests for collective enfranchisement</CardDescription>
              </CardHeader>
              <CardContent>
                {building.eligibility_result && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      {building.eligibility_result.reasons?.map((reason, idx) => (
                        <Alert key={idx} className={
                          reason.passed === true ? 'border-green-300 bg-green-50' :
                          reason.passed === false ? 'border-red-300 bg-red-50' :
                          'border-amber-300 bg-amber-50'
                        }>
                          <div className="flex items-start gap-3">
                            {reason.passed === true && <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />}
                            {reason.passed === false && <XCircle className="h-5 w-5 text-red-600 mt-0.5" />}
                            {reason.passed === null && <Clock className="h-5 w-5 text-amber-600 mt-0.5" />}
                            <div className="flex-1">
                              <AlertTitle className="font-semibold mb-1">
                                {reason.test.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </AlertTitle>
                              <AlertDescription>{reason.message}</AlertDescription>
                              <div className="mt-2 text-sm text-slate-600">
                                <span className="font-medium">Required:</span> {reason.required} | 
                                <span className="font-medium"> Actual:</span> {reason.actual}
                              </div>
                            </div>
                          </div>
                        </Alert>
                      ))}
                    </div>
                    
                    <Separator />
                    
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h3 className="font-semibold text-blue-900 mb-2">Threshold Basis</h3>
                      <div className="space-y-1 text-sm text-slate-700">
                        <p><span className="font-medium">Non-Residential Limit Used:</span> {building.eligibility_result.threshold_basis?.non_residential_limit_used}%</p>
                        <p><span className="font-medium">Assessment Date:</span> {building.eligibility_result.threshold_basis?.date_assessed}</p>
                        <p><span className="font-medium">LFRA 2024 Status:</span> {building.eligibility_result.threshold_basis?.lfra_2024_status}</p>
                        <p className="text-xs text-slate-600 mt-2 italic">{building.eligibility_result.threshold_basis?.lfra_2024_note}</p>
                      </div>
                    </div>
                    
                    <Alert className="border-amber-300 bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertTitle>Marriage Value Notice</AlertTitle>
                      <AlertDescription className="text-sm">
                        {building.eligibility_result.marriage_value_disclosure}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Flats Tab */}
          <TabsContent value="flats">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Flats</CardTitle>
                    <CardDescription>Participating leaseholders and premium calculations</CardDescription>
                  </div>
                  <Button
                    onClick={() => router.push(`/buildings/${buildingId}/flats/new`)}
                    className="bg-blue-900 hover:bg-blue-800"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Flat
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {flats.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <p>No flats added yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Unit</TableHead>
                          <TableHead>Leaseholder</TableHead>
                          <TableHead>Lease Start</TableHead>
                          <TableHead>Lease End</TableHead>
                          <TableHead>Participating</TableHead>
                          <TableHead className="text-right">Premium</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {flats.map((flat) => (
                          <TableRow key={flat.flat_id}>
                            <TableCell className="font-medium">{flat.unit_identifier}</TableCell>
                            <TableCell>{flat.leaseholder_name}</TableCell>
                            <TableCell>{flat.lease_start_date}</TableCell>
                            <TableCell>{flat.lease_end_date}</TableCell>
                            <TableCell>
                              <Badge variant={flat.participating ? 'default' : 'secondary'}>
                                {flat.participating ? 'Yes' : 'No'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {flat.individual_premium 
                                ? `£${flat.individual_premium.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
                                : '-'
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => computePremium(flat)}
                                  disabled={computingPremium === flat.flat_id}
                                  className="bg-blue-900 hover:bg-blue-800"
                                >
                                  <Calculator className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteFlat(flat.flat_id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Nominee Purchaser */}
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-900" />
                    <CardTitle>Nominee Purchaser</CardTitle>
                  </div>
                  <Dialog open={nomineeDialogOpen} onOpenChange={setNomineeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-blue-900 hover:bg-blue-800">
                        {nominee ? 'Edit' : 'Set'} Nominee
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nominee Purchaser Details</DialogTitle>
                        <DialogDescription>
                          Enter the details for the nominee purchaser entity
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="entity_name">Entity Name</Label>
                          <Input
                            id="entity_name"
                            value={nomineeForm.entity_name}
                            onChange={(e) => setNomineeForm({ ...nomineeForm, entity_name: e.target.value })}
                            placeholder="e.g., 123 High Street Nominee Ltd"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="formation_date">Formation Date</Label>
                          <Input
                            id="formation_date"
                            type="date"
                            value={nomineeForm.formation_date}
                            onChange={(e) => setNomineeForm({ ...nomineeForm, formation_date: e.target.value })}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setNomineeDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={saveNominee} className="bg-blue-900 hover:bg-blue-800">
                          Save
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {nominee ? (
                  <div>
                    <p className="font-semibold text-slate-900 text-lg">{nominee.entity_name}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Formed: {nominee.formation_date}
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500 italic">No nominee purchaser set</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Apportionment Tab */}
          <TabsContent value="apportionment">
            <Card>
              <CardHeader>
                <CardTitle>Aggregate Premium & Apportionment</CardTitle>
                <CardDescription>Breakdown of costs across participating leaseholders</CardDescription>
              </CardHeader>
              <CardContent>
                {apportionment ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-slate-50">
                        <CardContent className="pt-6">
                          <p className="text-sm text-slate-600 mb-1">All Flats Premium Total</p>
                          <p className="text-2xl font-bold text-slate-900">
                            £{apportionment.apportionment.all_flats_premium_total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-slate-50">
                        <CardContent className="pt-6">
                          <p className="text-sm text-slate-600 mb-1">Element C</p>
                          <p className="text-2xl font-bold text-slate-900">
                            £{apportionment.apportionment.element_c.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="bg-blue-50 border-blue-300">
                        <CardContent className="pt-6">
                          <p className="text-sm text-blue-700 mb-1">Aggregate Total</p>
                          <p className="text-2xl font-bold text-blue-900">
                            £{apportionment.apportionment.aggregate_total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Per-Flat Apportionment</h3>
                      <div className="space-y-3">
                        {apportionment.apportionment.apportionments.map((item) => (
                          <Card key={item.flat_id} className="border-slate-300">
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-slate-900">{item.unit_identifier}</p>
                                  <p className="text-sm text-slate-600">{item.leaseholder_name}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-blue-900">
                                    £{item.apportioned_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                                  </p>
                                  <p className="text-sm text-slate-600">{item.share_percentage}% share</p>
                                </div>
                              </div>
                              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-slate-600">Individual Premium</p>
                                  <p className="font-semibold">£{item.individual_premium.toLocaleString('en-GB')}</p>
                                </div>
                                <div>
                                  <p className="text-slate-600">Element C Share</p>
                                  <p className="font-semibold">£{item.element_c_share.toLocaleString('en-GB')}</p>
                                </div>
                                <div>
                                  <p className="text-slate-600">Total Payable</p>
                                  <p className="font-semibold text-blue-900">£{item.apportioned_amount.toLocaleString('en-GB')}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                    
                    <Alert className={apportionment.apportionment.sum_check.passes ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Sum Check Validation</AlertTitle>
                      <AlertDescription>
                        <div className="space-y-1 text-sm">
                          <p>Sum of apportioned amounts: £{apportionment.apportionment.sum_check.apportioned_sum.toLocaleString('en-GB')}</p>
                          <p>Expected aggregate total: £{apportionment.apportionment.sum_check.expected_aggregate.toLocaleString('en-GB')}</p>
                          <p>Difference: £{Math.abs(apportionment.apportionment.sum_check.difference).toLocaleString('en-GB')}</p>
                          <p className="font-semibold">{apportionment.apportionment.sum_check.passes ? '✓ Validation Passed' : '✗ Validation Failed'}</p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <p className="text-slate-500 italic text-center py-8">No apportionment data available. Add flats and compute premiums first.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Element C Tab */}
          <TabsContent value="element-c">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Element C (Severance/Injurious Affection)</CardTitle>
                    <CardDescription>Diminution in value of retained property</CardDescription>
                  </div>
                  <Dialog open={elementCDialogOpen} onOpenChange={setElementCDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-blue-900 hover:bg-blue-800">
                        Edit Element C
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Element C Configuration</DialogTitle>
                        <DialogDescription>
                          Enter retained property values or set surveyor override
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Retained Property Description</Label>
                          <Textarea
                            value={elementCForm.retained_property_description}
                            onChange={(e) => setElementCForm({ ...elementCForm, retained_property_description: e.target.value })}
                            placeholder="e.g., Ground floor commercial unit"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Value Before (£)</Label>
                            <Input
                              type="number"
                              value={elementCForm.retained_property_value_before}
                              onChange={(e) => setElementCForm({ ...elementCForm, retained_property_value_before: e.target.value })}
                              placeholder="150000"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Value After (£)</Label>
                            <Input
                              type="number"
                              value={elementCForm.retained_property_value_after}
                              onChange={(e) => setElementCForm({ ...elementCForm, retained_property_value_after: e.target.value })}
                              placeholder="130000"
                            />
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-2">
                          <Label>Override Mode</Label>
                          <Select
                            value={elementCForm.element_c_override}
                            onValueChange={(value) => setElementCForm({ ...elementCForm, element_c_override: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AUTO">AUTO (Formula-Based)</SelectItem>
                              <SelectItem value="FORCE_VALUE">FORCE VALUE (Surveyor Override)</SelectItem>
                              <SelectItem value="FORCE_ZERO">FORCE ZERO (Nil Confirmed)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {elementCForm.element_c_override === 'FORCE_VALUE' && (
                          <div className="space-y-2">
                            <Label>Override Value (£)</Label>
                            <Input
                              type="number"
                              value={elementCForm.element_c_override_value}
                              onChange={(e) => setElementCForm({ ...elementCForm, element_c_override_value: e.target.value })}
                              placeholder="25000"
                            />
                          </div>
                        )}
                        
                        {elementCForm.element_c_override !== 'AUTO' && (
                          <div className="space-y-2">
                            <Label>Justification (Required)</Label>
                            <Textarea
                              value={elementCForm.element_c_override_justification}
                              onChange={(e) => setElementCForm({ ...elementCForm, element_c_override_justification: e.target.value })}
                              placeholder="Surveyor justification for override"
                              required
                            />
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setElementCDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={saveElementC} className="bg-blue-900 hover:bg-blue-800">
                          Save
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {building.element_c_result ? (
                  <div className="space-y-6">
                    <Card className="bg-blue-50 border-blue-300">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-blue-700 mb-1">Element C Value</p>
                            <p className="text-3xl font-bold text-blue-900">
                              £{building.element_c_result.value.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          {building.element_c_result.requiresDisclosure && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                              Surveyor Override
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Alert className="border-slate-300">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Calculation Details</AlertTitle>
                      <AlertDescription>
                        <div className="space-y-2 text-sm mt-2">
                          <p><span className="font-medium">Mode:</span> {building.element_c_result.calculationDetails.mode}</p>
                          <p><span className="font-medium">Message:</span> {building.element_c_result.calculationDetails.message}</p>
                          
                          {building.element_c_result.calculationDetails.mode === 'AUTO' && building.element_c_result.calculationDetails.valueBefore && (
                            <>
                              <p><span className="font-medium">Value Before:</span> £{building.element_c_result.calculationDetails.valueBefore.toLocaleString('en-GB')}</p>
                              <p><span className="font-medium">Value After:</span> £{building.element_c_result.calculationDetails.valueAfter.toLocaleString('en-GB')}</p>
                              <p><span className="font-medium">Formula:</span> {building.element_c_result.calculationDetails.formula}</p>
                            </>
                          )}
                          
                          {building.element_c_result.calculationDetails.justification && (
                            <p><span className="font-medium">Justification:</span> {building.element_c_result.calculationDetails.justification}</p>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                    
                    {building.element_c_result.retainedPropertyDescription && (
                      <div>
                        <p className="text-sm text-slate-600 mb-1">Retained Property Description</p>
                        <p className="text-slate-900">{building.element_c_result.retainedPropertyDescription}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 italic text-center py-8">No Element C data configured</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Notice Tracker Tab */}
          <TabsContent value="notice">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Section 13 Notice Tracker</CardTitle>
                    <CardDescription>Notice stage progression and audit trail</CardDescription>
                  </div>
                  {!notice && (
                    <Dialog open={noticeDialogOpen} onOpenChange={setNoticeDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="bg-blue-900 hover:bg-blue-800">
                          <Plus className="mr-2 h-4 w-4" />
                          Create Notice Record
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create Notice Record</DialogTitle>
                          <DialogDescription>
                            Initialize Section 13 notice tracking
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Initial Stage</Label>
                            <Select
                              value={noticeForm.stage}
                              onValueChange={(value) => setNoticeForm({ ...noticeForm, stage: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Draft">Draft</SelectItem>
                                <SelectItem value="Notice Served (s.13)">Notice Served (s.13)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Notes</Label>
                            <Textarea
                              value={noticeForm.notes}
                              onChange={(e) => setNoticeForm({ ...noticeForm, notes: e.target.value })}
                              placeholder="Initial notes"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setNoticeDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={createNotice} className="bg-blue-900 hover:bg-blue-800">
                            Create
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {notice ? (
                  <div className="space-y-6">
                    <Card className="bg-blue-50 border-blue-300">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-blue-700 mb-1">Current Stage</p>
                            <p className="text-2xl font-bold text-blue-900">{notice.stage}</p>
                          </div>
                          <FileText className="h-10 w-10 text-blue-900" />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Stage History</h3>
                      <div className="space-y-3">
                        {notice.stage_history?.map((entry, idx) => (
                          <Card key={idx} className="border-slate-300">
                            <CardContent className="pt-4">
                              <div className="flex items-start gap-3">
                                <div className="mt-1">
                                  <div className="h-8 w-8 rounded-full bg-blue-900 flex items-center justify-center text-white font-bold">
                                    {idx + 1}
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold text-slate-900">{entry.stage}</p>
                                  <p className="text-sm text-slate-600">{new Date(entry.date).toLocaleString()}</p>
                                  <p className="text-sm text-slate-600 mt-1">{entry.notes}</p>
                                  <p className="text-xs text-slate-500 mt-1">User: {entry.user}</p>
                                  {entry.warnings && entry.warnings.length > 0 && (
                                    <Alert className="mt-2 border-amber-300 bg-amber-50">
                                      <AlertTriangle className="h-3 w-3" />
                                      <AlertDescription className="text-xs">
                                        {entry.warnings.map((w, widx) => (
                                          <p key={widx}>{w.message}</p>
                                        ))}
                                      </AlertDescription>
                                    </Alert>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Key Dates</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {notice.notice_served_date && (
                          <div className="bg-slate-50 p-3 rounded-lg">
                            <p className="text-xs text-slate-600">Notice Served</p>
                            <p className="font-semibold text-slate-900">{notice.notice_served_date}</p>
                          </div>
                        )}
                        {notice.counter_notice_received_date && (
                          <div className="bg-slate-50 p-3 rounded-lg">
                            <p className="text-xs text-slate-600">Counter-Notice Received</p>
                            <p className="font-semibold text-slate-900">{notice.counter_notice_received_date}</p>
                          </div>
                        )}
                        {notice.terms_agreed_date && (
                          <div className="bg-slate-50 p-3 rounded-lg">
                            <p className="text-xs text-slate-600">Terms Agreed</p>
                            <p className="font-semibold text-slate-900">{notice.terms_agreed_date}</p>
                          </div>
                        )}
                        {notice.tribunal_referral_date && (
                          <div className="bg-slate-50 p-3 rounded-lg">
                            <p className="text-xs text-slate-600">Tribunal Referral</p>
                            <p className="font-semibold text-slate-900">{notice.tribunal_referral_date}</p>
                          </div>
                        )}
                        {notice.completion_date && (
                          <div className="bg-slate-50 p-3 rounded-lg">
                            <p className="text-xs text-slate-600">Completion</p>
                            <p className="font-semibold text-slate-900">{notice.completion_date}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {notice.document_references && notice.document_references.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Documents</h3>
                        <div className="space-y-2">
                          {notice.document_references.map((doc, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                              <FileText className="h-4 w-4 text-slate-600" />
                              <span className="text-sm text-slate-700">{doc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-4">No notice record created yet</p>
                    <p className="text-sm text-slate-400">Create a notice record to start tracking the Section 13 process</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
