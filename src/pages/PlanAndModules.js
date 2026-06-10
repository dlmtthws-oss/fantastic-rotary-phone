import { Link } from 'react-router-dom'
import { useEntitlements } from '../context/EntitlementsContext'
import { MODULES, PLANS, TIER_ORDER } from '../config/modules'

const TIER_LABELS = {
  solo: 'Solo',
  team: 'Team',
  business: 'Business',
  ai: 'AI',
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
