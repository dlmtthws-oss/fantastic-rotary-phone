import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../context/CompanyContext'
import { BUSINESS_TYPE_OPTIONS } from '../config/verticals'

// Edit the company's name and trade (business_type). Changing the trade
// switches the per-vertical skin (labels / service types / accent) without
// touching any underlying data.
export default function BusinessProfile() {
  const { company, companyId, refresh } = useCompany()
  const [name, setName] = useState('')
  const [businessType, setBusinessType] = useState('window_cleaning')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (company) {
      setName(company.name || '')
      setBusinessType(company.business_type || 'window_cleaning')
    }
  }, [company])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      // RLS restricts these to the caller's own company row.
      const { error: companyErr } = await supabase
        .from('companies')
        .update({ name, business_type: businessType, updated_at: new Date().toISOString() })
        .eq('id', companyId)
      if (companyErr) throw companyErr

      // Keep the display name on company_settings in step.
      await supabase
        .from('company_settings')
        .update({ company_name: name, updated_at: new Date().toISOString() })
        .eq('company_id', companyId)

      await refresh()
      setSaved(true)
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Business Profile</h1>

      <form onSubmit={handleSave} className="space-y-5 bg-white rounded-lg shadow p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="input"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trade</label>
          <select
            value={businessType}
            onChange={e => setBusinessType(e.target.value)}
            className="input"
          >
            {BUSINESS_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Changes the labels, default service types and accent colour across the app.
          </p>
        </div>

        {error && <div className="p-3 rounded bg-red-50 text-red-600 text-sm">{error}</div>}
        {saved && <div className="p-3 rounded bg-green-50 text-green-700 text-sm">Saved.</div>}

        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
