'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Building2 } from 'lucide-react'

export default function NewBuilding() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    address: '',
    total_flat_count: '',
    non_residential_floor_area_pct: '',
    freeholder_name: '',
    freeholder_address: '',
    valuation_date: new Date().toISOString().split('T')[0]
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          total_flat_count: parseInt(formData.total_flat_count) || 0,
          non_residential_floor_area_pct: parseFloat(formData.non_residential_floor_area_pct) || 0
        })
      })

      if (response.ok) {
        const building = await response.json()
        router.push(`/buildings/${building.building_id}`)
      } else {
        alert('Failed to create building')
      }
    } catch (error) {
      console.error('Error creating building:', error)
      alert('Failed to create building')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="mb-6 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-800 text-white">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8" />
              <div>
                <CardTitle className="text-2xl">Add New Building</CardTitle>
                <CardDescription className="text-blue-100">
                  Enter building details for valuation
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="address" className="text-slate-900 font-medium">
                  Property Address *
                </Label>
                <Textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  rows={3}
                  className="border-slate-300"
                  placeholder="e.g., 123 High Street, London, SW1A 1AA"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="total_flat_count" className="text-slate-900 font-medium">
                    Total Number of Flats *
                  </Label>
                  <Input
                    id="total_flat_count"
                    name="total_flat_count"
                    type="number"
                    min="0"
                    value={formData.total_flat_count}
                    onChange={handleChange}
                    required
                    className="border-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="non_residential_floor_area_pct" className="text-slate-900 font-medium">
                    Non-Residential Floor Area (%)
                  </Label>
                  <Input
                    id="non_residential_floor_area_pct"
                    name="non_residential_floor_area_pct"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.non_residential_floor_area_pct}
                    onChange={handleChange}
                    className="border-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valuation_date" className="text-slate-900 font-medium">
                  Valuation Date
                </Label>
                <Input
                  id="valuation_date"
                  name="valuation_date"
                  type="date"
                  value={formData.valuation_date}
                  onChange={handleChange}
                  className="border-slate-300"
                />
              </div>

              <div className="border-t border-slate-200 pt-6 mt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Freeholder Details</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="freeholder_name" className="text-slate-900 font-medium">
                      Freeholder Name
                    </Label>
                    <Input
                      id="freeholder_name"
                      name="freeholder_name"
                      value={formData.freeholder_name}
                      onChange={handleChange}
                      className="border-slate-300"
                      placeholder="e.g., Property Investments Ltd"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="freeholder_address" className="text-slate-900 font-medium">
                      Freeholder Address
                    </Label>
                    <Textarea
                      id="freeholder_address"
                      name="freeholder_address"
                      value={formData.freeholder_address}
                      onChange={handleChange}
                      rows={2}
                      className="border-slate-300"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/')}
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-900 hover:bg-blue-800"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Building'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
