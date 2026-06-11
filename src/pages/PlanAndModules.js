import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useEntitlements } from '../context/EntitlementsContext'
import { MODULES, PLANS, TIER_ORDER } from '../config/modules'
import { supabase } from '../lib/supabase'

const TIER_LABELS = {
  solo: 'Solo',
  team: 'Team',
  business: 'Business',
  ai: 'AI',
}

// Mirrors PLAN_AI_REQUEST_LIMITS in supabase/functions/_shared/ai.ts
const PLAN_AI_REQUEST_LIMITS = { ai: 500 }

function AiUsageCard({ plan }) {
  const [settings, setSettings] = useState(null)
  const [usedThisMonth, setUsedThisMonth] = useState(0)
  const [keyInput, setKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    const load = async () => {
      const monthStart = new Date()
      monthStart.setUTCDate(1)
      monthStart.setUTCHours(0, 0, 0, 0)

      const [{ data: cs }, { count }] = await Promise.all([
        supabase
          .from('company_settings')
          .select('id, anthropic_api_key, ai_monthly_request_limit')
          .limit(1)
          .single(),
        supabase
          .from('ai_usage_log')
          .select('id', { count: 'exact', head: true })
          .eq('key_source', 'platform')
          .gte('created_at', monthStart.toISOString()),
      ])
      setSettings(cs)
      setUsedThisMonth(count || 0)
    }
    load()
  }, [])

  if (!settings) return null

  const hasOwnKey = Boolean(settings.anthropic_api_key)
  const limit = settings.ai_monthly_request_limit ?? PLAN_AI_REQUEST_LIMITS[plan] ?? 0

  const saveKey = async (value) => {
    setSaving(true)
    setMessage(null)
    const { error } = await supabase
      .from('company_settings')
      .update({ anthropic_api_key: value })
      .eq('id', settings.id)
    setSaving(false)
    if (error) {
      setMessage({ type: 'error', text: 'Failed to save API key. Please try again.' })
    } else {
      setSettings({ ...settings, anthropic_api_key: value })
      setKeyInput('')
      setMessage({
        type: 'success',
        text: value ? 'API key saved. AI features now use your own Anthropic account.' : 'API key removed.',
      })
    }
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow mb-6">
      <h3 className="font-semibold mb-1">AI usage & API key</h3>
      <p className="text-sm text-gray-500 mb-4">
        AI features run on your own Anthropic API key if you add one. Otherwise they use the
        included monthly allowance on the AI plan.
      </p>

      <div className="flex items-center gap-6 mb-4">
        <div>
          <p className="text-sm text-gray-500">This month (included allowance)</p>
          <p className="text-lg font-semibold">
            {usedThisMonth} / {limit} requests
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Billing source</p>
          <p className="text-lg font-semibold">{hasOwnKey ? 'Your Anthropic account' : 'Included allowance'}</p>
        </div>
      </div>

      {hasOwnKey ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-600">
            Using your API key ending in{' '}
            <span className="font-mono">…{settings.anthropic_api_key.slice(-4)}</span>. Requests are
            unmetered and billed to your Anthropic account.
          </p>
          <button
            onClick={() => saveKey(null)}
            disabled={saving}
            className="text-sm text-red-600 hover:underline whitespace-nowrap disabled:opacity-50"
          >
            Remove key
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-ant-..."
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <button
            onClick={() => saveKey(keyInput.trim())}
            disabled={saving || !keyInput.trim().startsWith('sk-ant-')}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? 'Saving…' : 'Use my key'}
          </button>
        </div>
      )}

      {message && (
        <p className={`text-sm mt-3 ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}

export default function PlanAndModules() {
  const { plan, modules, loading } = useEntitlements()

  if (loading) {
    return <div className="p-6 text-gray-500">Loading...</div>
  }

  const currentPlan = PLANS[plan]

  return (
    <div className="p-6 max-w-4xl">
      <Link to="/settings" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Settings</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Plan & Modules</h1>
      <p className="text-gray-600 mb-6">Manage your subscription plan and see which features are included.</p>

      <div className="p-6 bg-white rounded-lg shadow mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Current plan</p>
          <h2 className="text-xl font-semibold">{currentPlan.name}</h2>
          <p className="text-sm text-gray-600 mt-1">{currentPlan.description}</p>
        </div>
        {currentPlan.perSeat && (
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full whitespace-nowrap">
            Per-seat pricing
          </span>
        )}
      </div>

      {modules.has('ai_copilot') && <AiUsageCard plan={plan} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {TIER_ORDER.map((tier) => (
          <div key={tier} className="p-4 bg-white rounded-lg shadow">
            <h3 className="font-semibold mb-3">{TIER_LABELS[tier]} modules</h3>
            <ul className="space-y-3">
              {Object.entries(MODULES)
                .filter(([, m]) => m.tier === tier)
                .map(([key, m]) => {
                  const enabled = modules.has(key)
                  return (
                    <li key={key} className="flex items-start gap-2 text-sm">
                      <span className={enabled ? 'text-green-600 mt-0.5' : 'text-gray-300 mt-0.5'}>
                        {enabled ? '✓' : '○'}
                      </span>
                      <div>
                        <p className={enabled ? 'text-gray-900' : 'text-gray-400'}>{m.label}</p>
                        <p className="text-xs text-gray-400">{m.description}</p>
                      </div>
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
      </div>

      <div className="p-6 bg-white rounded-lg shadow">
        <h3 className="font-semibold mb-1">Available plans</h3>
        <p className="text-sm text-gray-500 mb-4">
          Want to change plans? Email{' '}
          <a href="mailto:hello@clearroute.co.uk" className="text-blue-600 hover:underline">
            hello@clearroute.co.uk
          </a>{' '}
          and we'll set it up for you.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {TIER_ORDER.map((key) => {
            const p = PLANS[key]
            const isCurrent = key === plan
            return (
              <div
                key={key}
                className={`p-4 rounded-lg border ${isCurrent ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold">{p.name}</h4>
                  {isCurrent && (
                    <span className="text-xs px-2 py-0.5 bg-gray-900 text-white rounded-full">Current</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">{p.perSeat ? 'Per seat / month' : 'Single user'}</p>
                <p className="text-sm text-gray-600">{p.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
