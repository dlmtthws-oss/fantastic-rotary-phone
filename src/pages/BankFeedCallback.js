import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function BankFeedCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function handleCallback() {
      const providerError = searchParams.get('error')
      const code = searchParams.get('code')
      const state = searchParams.get('state')

      if (providerError) {
        setError('Bank connection was cancelled or declined')
        setLoading(false)
        return
      }

      if (!code || !state) {
        setError('Missing required parameters from your bank')
        setLoading(false)
        return
      }

      // TrueLayer's redirect never carries our user id - recover it from
      // the authenticated session instead of trusting anything client-side.
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Your session expired - please sign in and try again')
        setLoading(false)
        return
      }

      try {
        const { data, error: callbackError } = await supabase.functions.invoke('truelayer-auth-callback', {
          body: { code, state, userId: user.id },
        })

        if (callbackError) {
          console.error('Callback error:', callbackError)
          setError('Failed to complete authentication')
        } else if (data?.success) {
          navigate('/accounting/bank-feed', { replace: true })
        } else {
          setError(data?.error || 'Authentication failed')
        }
      } catch (err) {
        console.error('Error:', err)
        setError('Authentication failed')
      }

      setLoading(false)
    }

    handleCallback()
  }, [searchParams, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to your bank...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-6 bg-white rounded-lg shadow">
          <h1 className="text-xl font-bold text-red-600 mb-2">Connection Failed</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/accounting/bank-feed')}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Back to Bank Feed
          </button>
        </div>
      </div>
    )
  }

  return null
}
