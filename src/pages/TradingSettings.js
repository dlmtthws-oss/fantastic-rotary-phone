import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { saveApiKey, getStoredSettings, removeApiKey, testConnection } from '../lib/trading212'

export default function TradingSettings({ user }) {
  const [apiKey, setApiKey] = useState('')
  const [environment, setEnvironment] = useState('demo')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [message, setMessage] = useState(null)
  const [existingSettings, setExistingSettings] = useState(null)
  const [showKey, setShowKey] = useState(false)

  const userId = user?.id || user?.email

  useEffect(() => {
    async function load() {
      const settings = await getStoredSettings(userId)
      if (settings) {
        setExistingSettings(settings)
        setEnvironment(settings.environment || 'demo')
      }
    }
    load()
  }, [userId])

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage({ type: 'error', text: 'Please enter your API key.' })
      return
    }

    try {
      setSaving(true)
      setMessage(null)
      await saveApiKey(userId, apiKey.trim(), environment)
      setExistingSettings({ environment, updated_at: new Date().toISOString() })
      setApiKey('')
      setMessage({ type: 'success', text: 'API key saved successfully.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    try {
      setTesting(true)
      setMessage(null)
      const result = await testConnection(userId)
      if (result.success) {
        setMessage({
          type: 'success',
          text: `Connected successfully. Account ID: ${result.data?.id || 'N/A'}, Currency: ${result.data?.currencyCode || 'N/A'}`
        })
      } else {
        setMessage({ type: 'error', text: `Connection failed: ${result.error}` })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setTesting(false)
    }
  }

  const handleRemove = async () => {
    if (!window.confirm('Are you sure you want to remove your Trading 212 connection? This will delete your API key.')) {
      return
    }

    try {
      setRemoving(true)
      setMessage(null)
      await removeApiKey(userId)
      setExistingSettings(null)
      setApiKey('')
      setEnvironment('demo')
      setMessage({ type: 'success', text: 'Trading 212 connection removed.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trading 212 Settings</h1>
          <p className="text-gray-500 text-sm">Configure your Trading 212 API connection</p>
        </div>
        <Link to="/trading" className="text-blue-600 text-sm hover:underline">Back to Dashboard</Link>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Connection Status */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-lg mb-4">Connection Status</h2>
        {existingSettings ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <div>
                <p className="font-medium">Connected</p>
                <p className="text-sm text-gray-500">
                  Environment: <span className="font-medium">{existingSettings.environment === 'live' ? 'Live' : 'Demo'}</span>
                  {existingSettings.updated_at && (
                    <span className="ml-2 text-gray-400">
                      (Updated {new Date(existingSettings.updated_at).toLocaleDateString('en-GB')})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleTest}
                disabled={testing}
                className="px-3 py-1.5 bg-gray-100 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100 disabled:opacity-50"
              >
                {removing ? 'Removing...' : 'Disconnect'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-gray-300"></span>
            <p className="text-gray-500">Not connected</p>
          </div>
        )}
      </div>

      {/* API Key Setup */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-lg mb-4">
          {existingSettings ? 'Update API Key' : 'Connect Your Account'}
        </h2>

        <div className="space-y-4">
          {/* Environment Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Environment</label>
            <div className="flex gap-3">
              <button
                onClick={() => setEnvironment('demo')}
                className={`flex-1 p-4 rounded-lg border-2 transition ${
                  environment === 'demo'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium">Demo (Paper Trading)</p>
                <p className="text-sm text-gray-500 mt-1">Practice with virtual money. Safe for testing.</p>
              </button>
              <button
                onClick={() => setEnvironment('live')}
                className={`flex-1 p-4 rounded-lg border-2 transition ${
                  environment === 'live'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium">Live</p>
                <p className="text-sm text-gray-500 mt-1">Connect to your real Trading 212 account.</p>
              </button>
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={existingSettings ? 'Enter new API key to update...' : 'Paste your Trading 212 API key...'}
                className="w-full px-3 py-2 border rounded-lg text-sm pr-20"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !apiKey.trim()}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : existingSettings ? 'Update API Key' : 'Connect Account'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-lg mb-4">How to Get Your API Key</h2>
        <ol className="space-y-3 text-sm text-gray-600">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <span>Log in to your Trading 212 account at <strong>trading212.com</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <span>Go to <strong>Settings</strong> (gear icon in the bottom-left)</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <span>Click on <strong>API (Beta)</strong> in the settings menu</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <span>Choose <strong>Practice</strong> (demo) or <strong>Live</strong> environment</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">5</span>
            <span>Click <strong>Generate API Key</strong> and copy the key</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">6</span>
            <span>Paste the key above and click Connect</span>
          </li>
        </ol>

        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            <strong>Note:</strong> The Trading 212 API is currently in beta. Generate a <strong>separate key</strong> for demo and live environments.
            Your API key is stored securely and only used to fetch your portfolio data.
          </p>
        </div>
      </div>

      {/* Rate Limits */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-lg mb-4">API Rate Limits</h2>
        <div className="text-sm text-gray-600 space-y-2">
          <p>Trading 212 enforces a rate limit of <strong>30 requests per minute</strong>.</p>
          <p>The dashboard automatically manages request frequency to stay within these limits.</p>
          <p>If you see rate limit errors, wait a minute before refreshing.</p>
        </div>
      </div>
    </div>
  )
}
