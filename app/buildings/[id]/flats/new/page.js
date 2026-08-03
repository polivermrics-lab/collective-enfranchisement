'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Plus } from 'lucide-react'

export default function NewFlat() {
  const router = useRouter()
  const params = useParams()
  const buildingId = params?.id
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    unit_identifier: '',
    leaseholder_name: '',
    lease_start_date: '',
    lease_end_date: '',
    participating: true
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/buildings/${buildingId}/flats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        router.push(`/buildings/${buildingId}`)
      } else {
        alert('Failed to add flat')
      }
    } catch (error) {
      console.error('Error adding flat:', error)
      alert('Failed to add flat')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setFormData({
      ...formData,
      [e.target.name]: value
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => router.push(`/buildings/${buildingId}`)}
          className="mb-6 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Building
        </Button>

        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-800 text-white">
            <div className="flex items-center gap-3">
              <Plus className="h-8 w-8" />
              <div>
                <CardTitle className="text-2xl">Add New Flat</CardTitle>
                <CardDescription className="text-blue-100">
                  Enter leaseholder and lease details
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="unit_identifier" className="text-slate-900 font-medium">
                    Unit Identifier *
                  </Label>
                  <Input
                    id="unit_identifier"
                    name="unit_identifier"
                    value={formData.unit_identifier}
                    onChange={handleChange}
                    required
                    className="border-slate-300"
                    placeholder="e.g., Flat 1, Ground Floor"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="leaseholder_name" className="text-slate-900 font-medium">
                    Leaseholder Name
                  </Label>
                  <Input
                    id="leaseholder_name"
                    name="leaseholder_name"
                    value={formData.leaseholder_name}
                    onChange={handleChange}
                    className="border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="lease_start_date" className="text-slate-900 font-medium">
                    Lease Start Date
                  </Label>
                  <Input
                    id="lease_start_date"
                    name="lease_start_date"
                    type="date"
                    value={formData.lease_start_date}
                    onChange={handleChange}
                    className="border-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lease_end_date" className="text-slate-900 font-medium">
                    Lease End Date *
                  </Label>
                  <Input
                    id="lease_end_date"
                    name="lease_end_date"
                    type="date"
                    value={formData.lease_end_date}
                    onChange={handleChange}
                    required
                    className="border-slate-300"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 py-2">
                <input
                  type="checkbox"
                  id="participating"
                  name="participating"
                  checked={formData.participating}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-blue-900 focus:ring-blue-900"
                />
                <Label htmlFor="participating" className="text-slate-900 font-medium">
                  Participating in Enfranchisement
                </Label>
              </div>

              <div className="flex gap-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/buildings/${buildingId}`)}
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
                  {loading ? 'Adding...' : 'Add Flat'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
