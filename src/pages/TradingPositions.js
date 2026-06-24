import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getPortfolio, getInstruments, getCashBalance } from '../lib/trading212'
import { supabase } from '../lib/supabase'

export default function TradingPositions({ user }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [positions, setPositions] = useState([])
  const [instruments, setInstruments] = useState({})
  const [cash, setCash] = useState(null)
  const [sortField, setSortField] = useState('value')
  const [sortDir, setSortDir] = useState('desc')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')

  const userId = user?.id || user?.email

  const loadData = useCallback(async () => {
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

      const [portfolioData, instrumentData, cashData] = await Promise.all([
        getPortfolio(userId),
        getInstruments(userId),
        getCashBalance(userId),
      ])

      const instrumentMap = {}
      if (Array.isArray(instrumentData)) {
        instrumentData.forEach(i => { instrumentMap[i.ticker] = i })
      }
      setInstruments(instrumentMap)
      setPositions(portfolioData || [])
      setCash(cashData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { loadData() }, [loadData])

  if (error === 'not_configured') {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Trading 212 not connected.</p>
        <Link to="/trading/settings" className="text-blue-600 hover:underline">Configure API key</Link>
      </div>
    )
  }

  const enrichedPositions = positions.map(p => {
    const inst = instruments[p.ticker]
    const value = p.quantity * p.currentPrice
    const invested = p.quantity * p.averagePrice
    const pnl = p.ppl || 0
    const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0

    return {
      ...p,
      name: inst?.name || p.ticker,
      type: inst?.type || 'UNKNOWN',
      currencyCode: inst?.currencyCode || 'GBP',
      isin: inst?.isin || '',
      value,
      invested,
      pnl,
      pnlPercent,
    }
  })

  const types = [...new Set(enrichedPositions.map(p => p.type))].sort()

  const filtered = enrichedPositions
    .filter(p => {
      if (search) {
        const q = search.toLowerCase()
        return p.ticker.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
      }
      return true
    })
    .filter(p => filterType === 'all' || p.type === filterType)
    .sort((a, b) => {
      const multiplier = sortDir === 'asc' ? 1 : -1
      switch (sortField) {
        case 'ticker': return multiplier * a.ticker.localeCompare(b.ticker)
        case 'name': return multiplier * a.name.localeCompare(b.name)
        case 'quantity': return multiplier * (a.quantity - b.quantity)
        case 'avgPrice': return multiplier * (a.averagePrice - b.averagePrice)
        case 'currentPrice': return multiplier * (a.currentPrice - b.currentPrice)
        case 'value': return multiplier * (a.value - b.value)
        case 'pnl': return multiplier * (a.pnl - b.pnl)
        case 'pnlPercent': return multiplier * (a.pnlPercent - b.pnlPercent)
        default: return multiplier * (a.value - b.value)
      }
    })

  const totalValue = enrichedPositions.reduce((s, p) => s + p.value, 0)
  const totalPnl = enrichedPositions.reduce((s, p) => s + p.pnl, 0)

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const formatCurrency = (v) => `£${parseFloat(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Positions</h1>
          <p className="text-gray-500 text-sm">{enrichedPositions.length} holdings</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/trading" className="text-blue-600 text-sm hover:underline">Back to Dashboard</Link>
          <button onClick={loadData} disabled={loading} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50">
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>
      )}

      {/* Summary Bar */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-6">
        <div>
          <p className="text-xs text-gray-500">Total Portfolio Value</p>
          <p className="text-lg font-bold text-blue-600">{formatCurrency(totalValue)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total P&L</p>
          <p className={`text-lg font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Free Cash</p>
          <p className="text-lg font-bold text-amber-600">{formatCurrency(cash?.free)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Positions</p>
          <p className="text-lg font-bold">{enrichedPositions.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search ticker or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm w-64"
        />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="all">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Sort controls (mobile) */}
      <div className="flex items-center gap-2 md:hidden">
        <label className="text-xs text-gray-500">Sort by</label>
        <select
          value={sortField}
          onChange={e => { setSortField(e.target.value); setSortDir('desc') }}
          className="px-2 py-1.5 border rounded-lg text-sm flex-1"
        >
          <option value="value">Value</option>
          <option value="pnl">P&L</option>
          <option value="pnlPercent">P&L %</option>
          <option value="ticker">Ticker</option>
          <option value="name">Name</option>
          <option value="quantity">Quantity</option>
        </select>
        <button
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          className="px-2 py-1.5 border rounded-lg text-sm"
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border p-4 h-28 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
            {search || filterType !== 'all' ? 'No positions match your filters.' : 'No open positions.'}
          </div>
        ) : (
          filtered.map(pos => {
            const weight = totalValue > 0 ? (pos.value / totalValue) * 100 : 0
            return (
              <div key={pos.ticker} className="bg-white rounded-xl border p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-base">{pos.ticker}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[180px]">{pos.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-base">{formatCurrency(pos.value)}</p>
                    <div className="flex items-center justify-end gap-1">
                      <div className="w-12 bg-gray-200 rounded-full h-1">
                        <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${Math.min(weight, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{weight.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Qty</span>
                    <span>{pos.quantity.toFixed(pos.quantity % 1 === 0 ? 0 : 4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Current</span>
                    <span>{formatCurrency(pos.currentPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg</span>
                    <span>{formatCurrency(pos.averagePrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">P&L</span>
                    <span className={`font-medium ${pos.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t flex justify-between items-center">
                  <span className="text-xs text-gray-400">{pos.type}</span>
                  <span className={`text-sm font-semibold ${pos.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading positions...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {search || filterType !== 'all' ? 'No positions match your filters.' : 'No open positions.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => handleSort('ticker')}>
                    Ticker <SortIcon field="ticker" />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => handleSort('name')}>
                    Name <SortIcon field="name" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => handleSort('quantity')}>
                    Qty <SortIcon field="quantity" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => handleSort('avgPrice')}>
                    Avg Price <SortIcon field="avgPrice" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => handleSort('currentPrice')}>
                    Current <SortIcon field="currentPrice" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => handleSort('value')}>
                    Value <SortIcon field="value" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => handleSort('pnl')}>
                    P&L <SortIcon field="pnl" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900" onClick={() => handleSort('pnlPercent')}>
                    P&L % <SortIcon field="pnlPercent" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(pos => {
                  const weight = totalValue > 0 ? (pos.value / totalValue) * 100 : 0
                  return (
                    <tr key={pos.ticker} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{pos.ticker}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{pos.name}</td>
                      <td className="px-4 py-3 text-right">{pos.quantity.toFixed(pos.quantity % 1 === 0 ? 0 : 4)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(pos.averagePrice)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(pos.currentPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(pos.value)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${pos.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                      </td>
                      <td className={`px-4 py-3 text-right ${pos.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(weight, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-12 text-right">{weight.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
