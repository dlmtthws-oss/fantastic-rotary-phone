import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useEntitlements } from '../context/EntitlementsContext'
import { showSuccessToast, showErrorToast } from '../lib/errorHandling'
import { getXeroConnection, startXeroAuth } from '../lib/xero'
import { getQuickBooksConnection, startQuickBooksAuth } from '../lib/quickbooks'

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Never'
  const date = new Date(timestamp)
  const seconds = Math.floor((new Date() - date) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return date.toLocaleDateString()
}

function IntegrationCard({ icon, name, description, entitled, connected, detailLine, lastSynced, busy, onConnect, onDisconnect, manageTo }) {
  if (!entitled) return null

  return (
    <div className="bg-white rounded-lg border p-5 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <h3 className="font-semibold">{name}</h3>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {connected ? 'Connected' : 'Not connected'}
        </span>
      </div>
      <p className="text-sm text-gray-600 flex-1 mb-3">{description}</p>
      {connected && (
        <div className="text-xs text-gray-500 mb-3">
          {detailLine && <p>{detailLine}</p>}
          <p>Last synced: {formatTimeAgo(lastSynced)}</p>
        </div>
      )}
      <div className="flex gap-2">
        {connected ? (
          <>
            {manageTo && (
              <Link to={manageTo} className="flex-1 px-3 py-2 text-sm bg-gray-100 rounded-md hover:bg-gray-200 text-center">
                Manage
              </Link>
            )}
            <button
              onClick={onDisconnect}
              disabled={busy}
              className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={onConnect}
            disabled={busy}
            className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function SettingsIntegrations({ user }) {
  const { isEntitled, loading: entitlementsLoading } = useEntitlements()
  const [xero, setXero] = useState(null)
  const [qbo, setQbo] = useState(null)
  const [bank, setBank] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function loadStatus() {
    if (!user?.id) return
    setLoading(true)
    const [xeroConn, qboConn, bankConn] = await Promise.all([
      getXeroConnection(user.id),
      getQuickBooksConnection(user.id),
      supabase.from('bank_connections').select('*').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle().then(r => r.data),
    ])
    setXero(xeroConn)
    setQbo(qboConn)
    setBank(bankConn)
    setLoading(false)
  }

  async function connectXero() {
    setBusy('xero')
    try {
      const authUrl = await startXeroAuth(user.id)
      if (authUrl) window.location.href = authUrl
      else showErrorToast('Connection Failed', 'Could not start Xero connection.')
    } catch (err) {
      showErrorToast('Connection Failed', 'Could not start Xero connection.')
    } finally {
      setBusy('')
    }
  }

  async function disconnectXero() {
    if (!window.confirm('Disconnect Xero?')) return
    setBusy('xero')
    await supabase.from('xero_connections').update({ is_active: false }).eq('user_id', user.id)
    await loadStatus()
    showSuccessToast('Disconnected', 'Xero has been disconnected')
    setBusy('')
  }

  async function connectQuickBooks() {
    setBusy('qbo')
    try {
      const authUrl = await startQuickBooksAuth(user.id)
      if (authUrl) window.location.href = authUrl
      else showErrorToast('Connection Failed', 'Could not start QuickBooks connection.')
    } catch (err) {
      showErrorToast('Connection Failed', 'Could not start QuickBooks connection.')
    } finally {
      setBusy('')
    }
  }

  async function disconnectQuickBooks() {
    if (!window.confirm('Disconnect QuickBooks?')) return
    setBusy('qbo')
    await supabase.from('quickbooks_connections').update({ is_active: false }).eq('user_id', user.id)
    await loadStatus()
    showSuccessToast('Disconnected', 'QuickBooks has been disconnected')
    setBusy('')
  }

  async function connectBank() {
    setBusy('bank')
    try {
      const { data, error } = await supabase.functions.invoke('truelayer-auth-start', {
        body: { userId: user.id },
      })
      if (error) throw error
      if (data?.authUrl) window.location.href = data.authUrl
      else showErrorToast('Connection Failed', 'Could not start bank connection.')
    } catch (err) {
      showErrorToast('Connection Failed', 'Could not start bank connection.')
    } finally {
      setBusy('')
    }
  }

  async function disconnectBank() {
    if (!window.confirm('Disconnect this bank account?')) return
    setBusy('bank')
    await supabase.from('bank_connections').delete().eq('id', bank.id)
    await loadStatus()
    showSuccessToast('Disconnected', 'Bank account has been disconnected')
    setBusy('')
  }

  if (loading || entitlementsLoading) return <div className="p-6 text-gray-500">Loading…</div>

  return (
    <div className="p-6 max-w-4xl">
      <Link to="/settings" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Settings</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Accounting Integrations</h1>
      <p className="text-gray-600 mb-6">Connect Xero, QuickBooks, or your bank account to sync data automatically.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <IntegrationCard
          icon="🟦"
          name="Xero"
          description="Sync customers, invoices, payments and expenses with Xero."
          entitled={isEntitled('xero')}
          connected={!!xero}
          detailLine={xero?.tenant_name}
          lastSynced={xero?.last_synced_at}
          busy={busy === 'xero'}
          onConnect={connectXero}
          onDisconnect={disconnectXero}
        />
        <IntegrationCard
          icon="🟩"
          name="QuickBooks"
          description="Sync customers, invoices, payments and expenses with QuickBooks."
          entitled={isEntitled('quickbooks')}
          connected={!!qbo}
          detailLine={qbo?.company_name}
          lastSynced={qbo?.last_synced_at}
          busy={busy === 'qbo'}
          onConnect={connectQuickBooks}
          onDisconnect={disconnectQuickBooks}
        />
        <IntegrationCard
          icon="🏦"
          name="Open Banking"
          description="Connect your bank account to auto-import transactions."
          entitled={isEntitled('open_banking')}
          connected={!!bank}
          detailLine={bank ? `${bank.bank_name} •••• ${bank.account_number_last4}` : null}
          lastSynced={bank?.last_synced_at}
          busy={busy === 'bank'}
          onConnect={connectBank}
          onDisconnect={disconnectBank}
          manageTo="/accounting/bank-feed"
        />
      </div>
    </div>
  )
}
