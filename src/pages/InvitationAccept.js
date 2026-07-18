import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Accepting an invitation joins the invitee to the INVITING company. The
// invitee has no account yet and isn't a member of the company, so RLS would
// hide the invitation - all the work happens in the `accept-invitation` edge
// function (service role). The :token route param is the invitation id.
export default function InvitationAccept() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState(null)
  const [companyName, setCompanyName] = useState('the company')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    async function lookup() {
      try {
        const { data, error } = await supabase.functions.invoke('accept-invitation', {
          body: { action: 'lookup', invitation_id: token },
        })
        if (error || data?.error) throw new Error(data?.error || 'Invalid or expired invitation')
        setInvite(data)
        setFullName(data.full_name || '')
        setCompanyName(data.company_name || 'the company')
      } catch (err) {
        setError(err.message || 'Invalid or expired invitation')
      }
      setLoading(false)
    }
    lookup()
  }, [token])

  async function handleAccept(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setAccepting(true)
    try {
      const { data, error } = await supabase.functions.invoke('accept-invitation', {
        body: { action: 'accept', invitation_id: token, password, full_name: fullName },
      })
      if (error || data?.error) throw new Error(data?.error || 'Could not accept invitation')

      // Sign in as the newly-created user; CompanyProvider takes it from here.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: data.email || invite.email,
        password,
      })
      if (signInErr) throw signInErr

      setAccepted(true)
      setTimeout(() => navigate('/'), 1500)
    } catch (err) {
      setError(err.message)
    }
    setAccepting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)'}}>
        <div className="w-full max-w-md p-8 bg-white rounded-2xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">❌</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
            <p className="text-gray-600">{error}</p>
            <a href="/" className="inline-block mt-6 px-6 py-3 bg-blue-500 text-white rounded-lg">Go to Login</a>
          </div>
        </div>
      </div>
    )
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)'}}>
        <div className="w-full max-w-md p-8 bg-white rounded-2xl text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h1>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)'}}>
      <div className="w-full max-w-md p-8 bg-white rounded-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🪟</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">You've been invited</h1>
          <p className="text-gray-600 mt-2">
            Join <strong>{companyName}</strong> on ClearRoute
          </p>
        </div>

        <form onSubmit={handleAccept} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your email</label>
            <input type="email" value={invite?.email || ''} disabled className="input bg-gray-100" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your role</label>
            <input
              type="text"
              value={invite?.role === 'manager' ? 'Manager' : 'Field Worker'}
              disabled
              className="input bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Create a password *</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input"
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="input"
              placeholder="Confirm your password"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={accepting || !password || !confirmPassword}
            className="btn btn-primary w-full"
          >
            {accepting ? 'Setting up...' : 'Accept Invitation'}
          </button>
        </form>
      </div>
    </div>
  )
}
