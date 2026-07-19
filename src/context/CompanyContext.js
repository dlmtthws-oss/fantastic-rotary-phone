import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Holds the authenticated session, the caller's profile and their company
// (including business_type, which drives the per-trade skin). Everything in
// the app reads tenancy from here rather than from a fabricated user object.
const CompanyContext = createContext(null)

export function CompanyProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  // Guards against repeatedly trying to provision a company for the same user
  // (e.g. when a brand-new account has confirmed their email but the company
  // row hasn't been created yet).
  const provisioningFor = useRef(null)

  const loadProfileAndCompany = useCallback(async (sess) => {
    if (!sess?.user) {
      setProfile(null)
      setCompany(null)
      return
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sess.user.id)
      .maybeSingle()

    // Self-heal: a logged-in user with no company yet (new signup awaiting
    // first load, or email-confirm flow) gets one provisioned atomically
    // server-side from their signup metadata. Invited workers always have a
    // profile+company already, so they never hit this path.
    if ((!prof || !prof.company_id) && provisioningFor.current !== sess.user.id) {
      provisioningFor.current = sess.user.id
      try {
        await supabase.functions.invoke('signup-company', {
          body: {
            business_name: sess.user.user_metadata?.business_name,
            business_type: sess.user.user_metadata?.business_type,
            full_name: sess.user.user_metadata?.full_name,
          },
        })
        const { data: prof2 } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sess.user.id)
          .maybeSingle()
        setProfile(prof2 || null)
        if (prof2?.company_id) {
          const { data: comp } = await supabase
            .from('companies').select('*').eq('id', prof2.company_id).maybeSingle()
          setCompany(comp || null)
        }
        return
      } catch (_e) {
        // Fall through and surface whatever we have.
      }
    }

    setProfile(prof || null)
    if (prof?.company_id) {
      const { data: comp } = await supabase
        .from('companies').select('*').eq('id', prof.company_id).maybeSingle()
      setCompany(comp || null)
    } else {
      setCompany(null)
    }
  }, [])

  useEffect(() => {
    let active = true

    async function handle(sess) {
      if (!active) return
      setSession(sess)
      await loadProfileAndCompany(sess)
      if (active) setLoading(false)
    }

    // Initial session. getSession() here runs outside the auth lock, so it is
    // safe to make further Supabase calls from its continuation.
    supabase.auth.getSession().then(({ data }) => handle(data.session))

    // IMPORTANT: onAuthStateChange fires while supabase-js holds its internal
    // auth lock. Awaiting other Supabase calls (PostgREST with an auth header,
    // functions.invoke, which internally call getSession) *inside* this
    // callback deadlocks the auth subsystem - which left the app stuck forever
    // on "Loading…". So we (a) skip INITIAL_SESSION (already handled above)
    // and (b) defer the work with setTimeout(0) so it runs after the lock is
    // released.
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'INITIAL_SESSION') return
      setTimeout(() => handle(sess), 0)
    })

    // Fail-safe: never leave the user stranded on the loading screen if the
    // auth/profile bootstrap stalls for any reason.
    const failSafe = setTimeout(() => { if (active) setLoading(false) }, 10000)

    return () => {
      active = false
      clearTimeout(failSafe)
      sub.subscription.unsubscribe()
    }
  }, [loadProfileAndCompany])

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    await loadProfileAndCompany(data.session)
  }, [loadProfileAndCompany])

  const signOut = useCallback(async () => {
    provisioningFor.current = null
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setCompany(null)
  }, [])

  const value = {
    session,
    profile,
    company,
    companyId: company?.id || profile?.company_id || null,
    businessType: company?.business_type || 'window_cleaning',
    loading,
    refresh,
    signOut,
  }

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany must be used within a CompanyProvider')
  return ctx
}
