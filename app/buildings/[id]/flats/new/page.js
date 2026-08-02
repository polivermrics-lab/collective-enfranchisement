'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Home } from 'lucide-react'

export default function NewFlat() {
  const router = useRouter()
  const params = useParams()
  const buildingId = params?.id

  const [loading, setLoading] = useState(false)
  const [building, setBuilding] = useState(null)
  const [formData, setFormData] = useState({
    unit_identifier: '',
    leaseholder_name: '',
    lease_start_date: '',
    lease_end_date: '',
    participating: true
  })

  useEffect(() => {
    if (buildingId) {
      fetchBuilding()
    }
  }, [buildingId])

  const fetchBuilding = async () => {
    try {
      const response = await fetch(`/api/buildings/${buildingId}`)
      if (response.ok) {
        const data = await response.json()
        setBuilding(data)
      }
    } catch (error) {
      console.error('Failed to fetch building:', error)
    }
  }

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
        alert('Failed to create flat')
      }
    } catch (error) {
      console.error('Error creating flat:', error)
      alert('Failed to create flat')
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
              <Home className="h-8 w-8" />
              <div>
                <CardTitle className="text-2xl">Add New Flat</CardTitle>
                <CardDescription className="text-blue-100">
                  {building?.address || 'Loading...'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
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
                  placeholder="e.g., Flat 1, Ground Floor, Apartment A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="leaseholder_name" className="text-slate-900 font-medium">
                  Leaseholder Name *
                </Label>
                <Input
                  id="leaseholder_name"
                  name="leaseholder_name"
                  value={formData.leaseholder_name}
                  onChange={handleChange}
                  required
                  className="border-slate-300"
                  placeholder="e.g., John Smith"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="lease_start_date" className="text-slate-900 font-medium">
                    Lease Start Date *
                  </Label>
                  <Input
                    id="lease_start_date"
                    name="lease_start_date"
                    type="date"
                    value={formData.lease_start_date}
                    onChange={handleChange}
                    required
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

              <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50">
                <div>
                  <Label htmlFor="participating" className="text-slate-900 font-medium">
                    Participating in Enfranchisement
                  </Label>
                  <p className="text-sm text-slate-600 mt-1">
                    Is this leaseholder participating in the collective enfranchisement?
                  </p>
                </div>
                <Switch
                  id="participating"
                  checked={formData.participating}
                  onCheckedChange={(checked) => setFormData({ ...formData, participating: checked })}
                />
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
