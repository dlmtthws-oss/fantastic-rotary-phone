import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { consumeXeroOAuthContext } from '../lib/xero'

export default function XeroCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code')
      const returnedState = searchParams.get('state')

      if (!code) {
        setError('Missing required parameters from Xero')
        setLoading(false)
        return
      }

      // Xero's redirect back only carries `code` - recover userId (and the
      // state we generated at connect-time) from what startXeroAuth stashed.
      const context = consumeXeroOAuthContext()
      if (!context?.userId) {
        setError('Missing user context - please try connecting again')
        setLoading(false)
        return
      }
      if (returnedState && context.state && returnedState !== context.state) {
        setError('Could not verify this connection request - please try connecting again')
        setLoading(false)
        return
      }

      try {
        const { data, error: callbackError } = await supabase.functions.invoke('xero-auth-callback', {
          body: { code, userId: context.userId, state: context.state },
        })

        if (callbackError) {
          console.error('Callback error:', callbackError)
          setError('Failed to complete authentication')
        } else if (data?.success) {
          navigate('/settings/integrations', { replace: true })
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
          <p className="text-gray-600">Connecting to Xero...</p>
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
            onClick={() => navigate('/settings/integrations')}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Back to Settings
          </button>
        </div>
      </div>
    )
  }

  return null
}
