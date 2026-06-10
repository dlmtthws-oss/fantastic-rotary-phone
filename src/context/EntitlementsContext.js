import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PLANS, resolveEntitlements } from '../config/modules'

const EntitlementsContext = createContext(null)

export function EntitlementsProvider({ children }) {
  const [plan, setPlan] = useState('ai')
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
          // If entitlements can't be loaded (network error, migration not
          // yet applied, etc.) default to full access so nothing
          // disappears for existing users.
          setPlan('ai')
          setEnabledModules(null)
        } else {
          setPlan(data.plan || 'solo')
          setEnabledModules(data.enabled_modules || null)
        }
      } catch (err) {
        if (!cancelled) {
          setPlan('ai')
          setEnabledModules(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadEntitlements()
    return () => { cancelled = true }
  }, [])

  // While loading, behave as if on the AI plan so the app doesn't briefly
  // hide modules (or bounce a user to the Upgrade page) before the real
  // plan has loaded.
  const effectivePlan = loading ? 'ai' : plan
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
