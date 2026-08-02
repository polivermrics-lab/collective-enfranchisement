'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Plus, Calendar, MapPin } from 'lucide-react'

const Dashboard = () => {
  const router = useRouter()
  const [buildings, setBuildings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBuildings()
  }, [])

  const fetchBuildings = async () => {
    try {
      const response = await fetch('/api/buildings')
      const data = await response.json()
      setBuildings(data)
    } catch (error) {
      console.error('Failed to fetch buildings:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEligibilityBadge = (status) => {
    const variants = {
      eligible: { color: 'bg-green-100 text-green-800 border-green-300', label: 'Eligible' },
      ineligible: { color: 'bg-red-100 text-red-800 border-red-300', label: 'Ineligible' },
      pending: { color: 'bg-amber-100 text-amber-800 border-amber-300', label: 'Pending' }
    }
    const variant = variants[status] || variants.pending
    return (
      <Badge className={`${variant.color} border font-medium`}>
        {variant.label}
      </Badge>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">
                Collective Enfranchisement
              </h1>
              <p className="text-slate-600 text-lg">
                UK Leasehold Property Valuation Tool
              </p>
            </div>
            <Button
              onClick={() => router.push('/buildings/new')}
              className="bg-blue-900 hover:bg-blue-800 text-white"
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              New Building
            </Button>
          </div>
        </div>

        {/* Buildings Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-900 border-r-transparent"></div>
            <p className="mt-4 text-slate-600">Loading buildings...</p>
          </div>
        ) : buildings.length === 0 ? (
          <Card className="border-2 border-dashed border-slate-300">
            <CardContent className="py-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No buildings yet
              </h3>
              <p className="text-slate-600 mb-6">
                Get started by adding your first building
              </p>
              <Button
                onClick={() => router.push('/buildings/new')}
                className="bg-blue-900 hover:bg-blue-800"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Building
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {buildings.map((building) => (
              <Card
                key={building.building_id}
                className="hover:shadow-lg transition-shadow cursor-pointer border-slate-200 bg-white"
                onClick={() => router.push(`/buildings/${building.building_id}`)}
              >
                <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-800 text-white">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1">
                        {building.address || 'Unnamed Building'}
                      </CardTitle>
                      <CardDescription className="text-blue-100">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span className="text-sm">
                            {building.valuation_date || 'No date set'}
                          </span>
                        </div>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Eligibility</span>
                      {getEligibilityBadge(building.eligibility_status)}
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                      <div>
                        <p className="text-sm text-slate-600">Total Flats</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {building.total_flat_count || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Non-Res %</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {building.non_residential_floor_area_pct || 0}%
                        </p>
                      </div>
                    </div>
                    {building.freeholder_name && (
                      <div className="pt-4 border-t border-slate-200">
                        <p className="text-xs text-slate-500">Freeholder</p>
                        <p className="text-sm font-medium text-slate-900">
                          {building.freeholder_name}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  return <Dashboard />
}

export default App
