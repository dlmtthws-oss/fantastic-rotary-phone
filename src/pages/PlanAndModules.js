import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useEntitlements } from '../context/EntitlementsContext'
import { supabase } from '../lib/supabase'
import { MODULES, PLANS, TIER_ORDER } from '../config/modules'

const TIER_LABELS = { solo: 'Solo', team: 'Team', business: 'Business', ai: 'AI' }

const priceLabel = (p) => (p.price ? `£${p.price}` : 'Free')

export default function PlanAndModules() {
  const { plan, modules, loading } = useEntitlements()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [subStatus, setSubStatus] = useState(null)

  const checkout = params.get('checkout')

  useEffect(() => {
    async function loadStatus() {
      const { data } = await supabase
        .from('company_settings')
        .select('stripe_subscription_status, stripe_customer_id')
        .maybeSingle()
      setSubStatus(data || null)
    }
    loadStatus()
  }, [])

  async function startCheckout(planKey) {
    setBusy(planKey)
    setError('')
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { plan: planKey },
      })
      if (error || data?.error) throw new Error(data?.error || 'Could not start checkout')
      if (data?.url) window.location.href = data.url
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function manageBilling() {
    setBusy('manage')
    setError('')
    try {
      const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {})
      if (error || data?.error) throw new Error(data?.error || 'Could not open billing portal')
      if (data?.url) window.location.href = data.url
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>

  const currentPlan = PLANS[plan]
  const hasBilling = !!subStatus?.stripe_customer_id

  return (
    <div className="p-6 max-w-4xl">
      <Link to="/settings" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Settings</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Plan &amp; Billing</h1>
      <p className="text-gray-600 mb-6">Choose a plan, start a 14-day free trial, and manage your subscription.</p>

      {checkout === 'success' && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 text-green-800 text-sm">
          🎉 Subscription started — your new plan will be active in a moment. Refresh if it hasn't updated yet.
        </div>
      )}
      {checkout === 'cancelled' && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 text-amber-800 text-sm">
          Checkout cancelled — no changes were made.
        </div>
      )}
      {error && <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="p-6 bg-white rounded-lg shadow mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Current plan</p>
          <h2 className="text-xl font-semibold">
            {currentPlan.name}{' '}
            <span className="text-gray-400 text-base font-normal">
              {currentPlan.price ? `· £${currentPlan.price}/mo` : '· Free'}
            </span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">{currentPlan.description}</p>
          {subStatus?.stripe_subscription_status && (
            <p className="text-xs text-gray-500 mt-1">
              Subscription status: <span className="font-medium">{subStatus.stripe_subscription_status}</span>
            </p>
          )}
        </div>
        {hasBilling && (
          <button
            onClick={manageBilling}
            disabled={busy === 'manage'}
            className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 text-sm whitespace-nowrap"
          >
            {busy === 'manage' ? 'Opening…' : 'Manage billing'}
          </button>
        )}
      </div>

      {/* Plan cards with pricing + subscribe */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {TIER_ORDER.map((key) => {
          const p = PLANS[key]
          const isCurrent = key === plan
          return (
            <div
              key={key}
              className={`p-4 rounded-lg border flex flex-col ${isCurrent ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold">{p.name}</h4>
                {isCurrent && <span className="text-xs px-2 py-0.5 bg-gray-900 text-white rounded-full">Current</span>}
              </div>
              <p className="text-2xl font-bold mb-0.5">{priceLabel(p)}<span className="text-sm font-normal text-gray-500">{p.price ? '/mo' : ''}</span></p>
              <p className="text-xs text-gray-500 mb-2">{p.perSeat ? 'per seat · billed monthly' : 'single user'}</p>
              <p className="text-sm text-gray-600 flex-1">{p.description}</p>
              <div className="mt-4">
                {p.paid && !isCurrent && (
                  <button
                    onClick={() => startCheckout(key)}
                    disabled={busy === key}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    {busy === key ? 'Starting…' : 'Start 14-day trial'}
                  </button>
                )}
                {p.paid && isCurrent && hasBilling && (
                  <button
                    onClick={manageBilling}
                    disabled={busy === 'manage'}
                    className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                  >
                    Manage
                  </button>
                )}
                {!p.paid && (
                  <p className="text-center text-xs text-gray-400">Included free</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Module breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </div>
  )
}
