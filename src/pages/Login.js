import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BUSINESS_TYPE_OPTIONS, DEFAULT_BUSINESS_TYPE } from '../config/verticals'

// Real Supabase Auth. Signing in or registering creates a session; the
// CompanyProvider then loads (or provisions) the caller's company, so this
// screen doesn't need to fabricate a user object or call back into App.
export default function Login() {
  const [params] = useSearchParams()
  // Marketing CTAs link to /login?mode=register to open signup directly.
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState(DEFAULT_BUSINESS_TYPE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')

    try {
      if (mode === 'register') {
        // Carry the business details in user_metadata so the company can be
        // provisioned server-side on first authenticated load.
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              business_name: businessName,
              business_type: businessType,
            },
          },
        })
        if (error) throw error
        if (!data.session) {
          setInfo('Check your email to confirm your account, then sign in.')
        }
        // With a session, CompanyProvider's auth listener provisions the
        // company automatically - nothing else to do here.
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const isRegister = mode === 'register'

  return (
    <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)'}}>
      <div className="w-full max-w-md p-8" style={{background: 'white', borderRadius: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)'}}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center" style={{background: 'linear-gradient(135deg, #3b82f6, #2563eb)', borderRadius: '16px'}}>
            <span className="text-3xl">🪟</span>
          </div>
          <h1 className="text-2xl font-bold" style={{color: '#0f172a'}}>ClearRoute</h1>
          <p className="text-gray-500 mt-2">Field Service Business Management</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="input"
                  placeholder="Jane Smith"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  className="input"
                  placeholder="Smith Window Cleaning"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What's your trade?</label>
                <select
                  value={businessType}
                  onChange={e => setBusinessType(e.target.value)}
                  className="input"
                >
                  {BUSINESS_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg" style={{background: '#fef2f2', color: '#dc2626', fontSize: '14px'}}>
              {error}
            </div>
          )}
          {info && (
            <div className="p-3 rounded-lg" style={{background: '#eff6ff', color: '#1d4ed8', fontSize: '14px'}}>
              {info}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Please wait...' : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setMode(isRegister ? 'signin' : 'register'); setError(''); setInfo('') }}
            className="text-sm"
            style={{color: '#3b82f6'}}
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Start your business"}
          </button>
          <div className="mt-4">
            <Link to="/" className="text-xs text-gray-400 hover:text-gray-600">← Back to home</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
