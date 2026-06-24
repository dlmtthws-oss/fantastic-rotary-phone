import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getOrderHistory, getDividendHistory, getTransactionHistory } from '../lib/trading212'
import { supabase } from '../lib/supabase'

const TABS = [
  { key: 'orders', label: 'Orders' },
  { key: 'dividends', label: 'Dividends' },
  { key: 'transactions', label: 'Transactions' },
]

export default function TradingHistory({ user }) {
  const [tab, setTab] = useState('orders')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [orders, setOrders] = useState([])
  const [dividends, setDividends] = useState([])
  const [transactions, setTransactions] = useState([])
  const [cursors, setCursors] = useState({ orders: null, dividends: null, transactions: null })
  const [hasMore, setHasMore] = useState({ orders: true, dividends: true, transactions: true })

  const userId = user?.id || user?.email

  const loadTab = useCallback(async (tabKey, cursor = null) => {
    try {
      setLoading(true)
      setError(null)

      const { data: acct } = await supabase
        .from('trading_accounts')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (!acct) {
        setError('not_configured')
        setLoading(false)
        return
      }

      let data
      switch (tabKey) {
        case 'orders':
          data = await getOrderHistory(userId, cursor)
          if (cursor) {
            setOrders(prev => [...prev, ...(data.items || [])])
          } else {
            setOrders(data.items || [])
          }
          setCursors(prev => ({ ...prev, orders: data.nextPagePath || null }))
          setHasMore(prev => ({ ...prev, orders: !!data.nextPagePath }))
          break
        case 'dividends':
          data = await getDividendHistory(userId, cursor)
          if (cursor) {
            setDividends(prev => [...prev, ...(data.items || [])])
          } else {
            setDividends(data.items || [])
          }
          setCursors(prev => ({ ...prev, dividends: data.nextPagePath || null }))
          setHasMore(prev => ({ ...prev, dividends: !!data.nextPagePath }))
          break
        case 'transactions':
          data = await getTransactionHistory(userId, cursor)
          if (cursor) {
            setTransactions(prev => [...prev, ...(data.items || [])])
          } else {
            setTransactions(data.items || [])
          }
          setCursors(prev => ({ ...prev, transactions: data.nextPagePath || null }))
          setHasMore(prev => ({ ...prev, transactions: !!data.nextPagePath }))
          break
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { loadTab(tab) }, [tab, loadTab])

  if (error === 'not_configured') {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Trading 212 not connected.</p>
        <Link to="/trading/settings" className="text-blue-600 hover:underline">Configure API key</Link>
      </div>
    )
  }

  const formatCurrency = (v) => `£${parseFloat(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trading History</h1>
          <p className="text-gray-500 text-sm">Orders, dividends and transactions</p>
        </div>
        <Link to="/trading" className="text-blue-600 text-sm hover:underline">Back to Dashboard</Link>
      </div>

      {error && error !== 'not_configured' && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          {loading && orders.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No order history found.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Ticker</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Quantity</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Fill Price</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.map((order, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(order.dateModified || order.dateCreated)}</td>
                        <td className="px-4 py-3 font-medium">{order.ticker}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            order.type === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {order.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            order.status === 'FILLED' ? 'bg-blue-100 text-blue-700' :
                            order.status === 'CANCELLED' ? 'bg-gray-100 text-gray-600' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">{order.filledQuantity || order.orderedQuantity || '-'}</td>
                        <td className="px-4 py-3 text-right">{order.fillPrice ? formatCurrency(order.fillPrice) : '-'}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {order.fillPrice && order.filledQuantity
                            ? formatCurrency(order.fillPrice * order.filledQuantity)
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMore.orders && (
                <div className="p-4 text-center border-t">
                  <button
                    onClick={() => loadTab('orders', cursors.orders)}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Dividends Tab */}
      {tab === 'dividends' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          {loading && dividends.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Loading dividends...</div>
          ) : dividends.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No dividend history found.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Ticker</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Quantity</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Amount Per Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dividends.map((div, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(div.paidOn)}</td>
                        <td className="px-4 py-3 font-medium">{div.ticker}</td>
                        <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(div.amount)}</td>
                        <td className="px-4 py-3 text-right">{div.quantity}</td>
                        <td className="px-4 py-3 text-right">{div.amountPerShare ? formatCurrency(div.amountPerShare) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMore.dividends && (
                <div className="p-4 text-center border-t">
                  <button
                    onClick={() => loadTab('dividends', cursors.dividends)}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Dividend Summary */}
          {dividends.length > 0 && (
            <div className="p-4 bg-green-50 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-700 font-medium">Total Dividends Received</span>
                <span className="text-lg font-bold text-green-700">
                  {formatCurrency(dividends.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {tab === 'transactions' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          {loading && transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No transaction history found.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Reference</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {transactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(tx.dateTime)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            tx.type === 'DEPOSIT' ? 'bg-green-100 text-green-700' :
                            tx.type === 'WITHDRAWAL' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{tx.reference || '-'}</td>
                        <td className={`px-4 py-3 text-right font-medium ${(tx.amount || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(tx.amount || 0) >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMore.transactions && (
                <div className="p-4 text-center border-t">
                  <button
                    onClick={() => loadTab('transactions', cursors.transactions)}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
