import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PLANS, resolveEntitlements } from '../config/modules'

const EntitlementsContext = createContext(null)

export function EntitlementsProvider({ children }) {
  // Default to the free floor, never full access. Real plan loads from
  // company_settings (RLS-scoped to the caller's company).
  const [plan, setPlan] = useState('solo')
  const [enabledModules, setEnabledModules] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadEntitlements() {
      try {
        const { data, error } = await supabase
          .from('company_settings')
          .select('plan, enabled_modules')
          .limit(1)
          .single()

        if (cancelled) return

        if (error || !data) {
          // If entitlements can't be loaded (network error, etc.) fall back
          // to the free floor - never full access.
          setPlan('solo')
          setEnabledModules(null)
        } else {
          setPlan(data.plan || 'solo')
          setEnabledModules(data.enabled_modules || null)
        }
      } catch (err) {
        if (!cancelled) {
          setPlan('solo')
          setEnabledModules(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadEntitlements()
    return () => { cancelled = true }
  }, [])

  // Until the real plan loads, assume the free floor so premium features
  // aren't briefly exposed to free accounts (the server enforces entitlements
  // independently on every privileged call).
  const effectivePlan = plan
  const modules = useMemo(
    () => resolveEntitlements(effectivePlan, enabledModules),
    [effectivePlan, enabledModules]
  )

  const value = useMemo(() => ({
    plan: effectivePlan,
    planName: PLANS[effectivePlan]?.name,
    modules,
    loading,
    isEntitled: (moduleKey) => modules.has(moduleKey),
  }), [effectivePlan, modules, loading])

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
    </EntitlementsContext.Provider>
  )
}

export function useEntitlements() {
  const context = useContext(EntitlementsContext)
  if (!context) {
    throw new Error('useEntitlements must be used within an EntitlementsProvider')
  }
  return context
}

export function useEntitlement(moduleKey) {
  const { isEntitled } = useEntitlements()
  return isEntitled(moduleKey)
}
