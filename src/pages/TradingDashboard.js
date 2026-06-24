import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { getPortfolio, getCashBalance, getInstruments, savePortfolioSnapshot } from '../lib/trading212'
import { supabase } from '../lib/supabase'

const COLORS = ['#3B82F6', '#22C55E', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1', '#14B8A6', '#E11D48']

export default function TradingDashboard({ user }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [portfolio, setPortfolio] = useState([])
  const [cash, setCash] = useState(null)
  const [instruments, setInstruments] = useState({})
  const [snapshots, setSnapshots] = useState([])
  const [settings, setSettings] = useState(null)

  const userId = user?.id || user?.email

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: acct } = await supabase
        .from('trading_accounts')
        .select('environment')
        .eq('user_id', userId)
        .single()

      if (!acct) {
        setError('not_configured')
        setLoading(false)
        return
      }
      setSettings(acct)

      const [portfolioData, cashData, instrumentData] = await Promise.all([
        getPortfolio(userId),
        getCashBalance(userId),
        getInstruments(userId),
      ])

      const instrumentMap = {}
      if (Array.isArray(instrumentData)) {
        instrumentData.forEach(i => { instrumentMap[i.ticker] = i })
      }
      setInstruments(instrumentMap)
      setPortfolio(portfolioData || [])
      setCash(cashData)

      try {
        await savePortfolioSnapshot(userId, portfolioData, cashData)
      } catch (e) {
        // snapshot save is best-effort
      }

      const { data: snaps } = await supabase
        .from('trading_snapshots')
        .select('total_value, total_invested, cash_total, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(90)
      setSnapshots(snaps || [])

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { loadData() }, [loadData])

  if (error === 'not_configured') {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="text-6xl mb-4">📈</div>
        <h1 className="text-2xl font-bold mb-2">Connect Trading 212</h1>
        <p className="text-gray-500 mb-6">
          Connect your Trading 212 account to track your portfolio, view performance, and get AI-powered insights.
        </p>
        <Link
          to="/trading/settings"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Set Up Trading 212
        </Link>
      </div>
    )
  }

  const totalInvested = portfolio.reduce((sum, p) => sum + (p.quantity * p.averagePrice), 0)
  const totalValue = portfolio.reduce((sum, p) => sum + (p.quantity * p.currentPrice), 0)
  const totalPnl = portfolio.reduce((sum, p) => sum + (p.ppl || 0), 0)
  const totalPnlPercent = totalInvested > 0 ? ((totalPnl / totalInvested) * 100) : 0
  const cashFree = cash?.free || 0
  const accountTotal = totalValue + cashFree

  const allocationData = portfolio
    .map(p => ({
      name: instruments[p.ticker]?.name || p.ticker,
      ticker: p.ticker,
      value: p.quantity * p.currentPrice,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)

  const topMovers = [...portfolio]
    .map(p => ({
      ticker: p.ticker,
      name: instruments[p.ticker]?.name || p.ticker,
      pnl: p.ppl || 0,
      pnlPercent: p.quantity * p.averagePrice > 0
        ? ((p.ppl || 0) / (p.quantity * p.averagePrice)) * 100
        : 0,
      currentPrice: p.currentPrice,
    }))
    .sort((a, b) => Math.abs(b.pnlPercent) - Math.abs(a.pnlPercent))
    .slice(0, 6)

  const chartData = snapshots.map(s => ({
    date: new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    value: parseFloat(s.total_value) || 0,
    invested: parseFloat(s.total_invested) || 0,
  }))

  const formatMoney = (v) => {
    const abs = Math.abs(v)
    if (abs >= 1000000) return `${(v / 1000000).toFixed(1)}M`
    if (abs >= 1000) return `${(v / 1000).toFixed(1)}K`
    return v.toFixed(2)
  }

  const formatCurrency = (v) => `£${parseFloat(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trading Dashboard</h1>
          <p className="text-gray-500 text-sm">
            {settings?.environment === 'live' ? 'Live Account' : 'Demo Account (Paper Trading)'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full ${settings?.environment === 'live' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {settings?.environment === 'live' ? 'LIVE' : 'DEMO'}
          </span>
          <button onClick={loadData} disabled={loading} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50">
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <Link to="/trading/settings" className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
            Settings
          </Link>
        </div>
      </div>

      {error && error !== 'not_configured' && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard title="Account Value" value={formatCurrency(accountTotal)} loading={loading} color="#3B82F6" />
        <KPICard title="Invested" value={formatCurrency(totalInvested)} loading={loading} color="#6366F1" />
        <KPICard title="Portfolio Value" value={formatCurrency(totalValue)} loading={loading} color="#8B5CF6" />
        <KPICard
          title="Total P&L"
          value={`${totalPnl >= 0 ? '+' : ''}${formatCurrency(totalPnl)}`}
          subtitle={`${totalPnlPercent >= 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%`}
          loading={loading}
          color={totalPnl >= 0 ? '#22C55E' : '#EF4444'}
        />
        <KPICard title="Free Cash" value={formatCurrency(cashFree)} loading={loading} color="#F59E0B" />
        <KPICard title="Positions" value={portfolio.length} loading={loading} color="#06B6D4" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Value Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-lg mb-4">Portfolio Value Over Time</h2>
          {chartData.length < 2 ? (
            <div className="text-center py-12 text-gray-400">
              <p>Portfolio history will build up over time as snapshots are taken.</p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `£${formatMoney(v)}`} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} name="Portfolio Value" />
                  <Area type="monotone" dataKey="invested" stroke="#94A3B8" fill="#94A3B8" fillOpacity={0.05} name="Total Invested" strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Allocation Chart */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-lg mb-4">Allocation</h2>
          {allocationData.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No positions</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {allocationData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Movers */}
        <div className="bg-white rounded-xl border p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">Top Movers</h2>
            <Link to="/trading/positions" className="text-blue-600 text-sm hover:underline">View All</Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />)}</div>
          ) : topMovers.length === 0 ? (
            <p className="text-center py-8 text-gray-400">No positions yet</p>
          ) : (
            <div className="space-y-2">
              {topMovers.map(pos => (
                <div key={pos.ticker} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-sm">{pos.ticker}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[200px]">{pos.name}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${pos.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                    </p>
                    <p className={`text-xs ${pos.pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-lg mb-4">Quick Access</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/trading/positions" className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition text-center">
              <span className="text-2xl block mb-1">📊</span>
              <span className="text-sm font-medium text-blue-700">All Positions</span>
              <span className="text-xs text-blue-500 block">{portfolio.length} holdings</span>
            </Link>
            <Link to="/trading/history" className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition text-center">
              <span className="text-2xl block mb-1">📋</span>
              <span className="text-sm font-medium text-purple-700">Order History</span>
              <span className="text-xs text-purple-500 block">Orders & dividends</span>
            </Link>
            <Link to="/trading/insights" className="p-4 bg-amber-50 rounded-lg hover:bg-amber-100 transition text-center">
              <span className="text-2xl block mb-1">🤖</span>
              <span className="text-sm font-medium text-amber-700">AI Insights</span>
              <span className="text-xs text-amber-500 block">Portfolio analysis</span>
            </Link>
            <Link to="/trading/pies" className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition text-center">
              <span className="text-2xl block mb-1">🥧</span>
              <span className="text-sm font-medium text-green-700">Pies</span>
              <span className="text-xs text-green-500 block">Auto-invest portfolios</span>
            </Link>
          </div>

          {/* Cash Breakdown */}
          {cash && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Cash Breakdown</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Free cash</span>
                  <span className="font-medium">{formatCurrency(cash.free)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total cash</span>
                  <span className="font-medium">{formatCurrency(cash.total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Blocked</span>
                  <span className="font-medium">{formatCurrency(cash.blocked)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pie cash</span>
                  <span className="font-medium">{formatCurrency(cash.pieCash)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="font-medium">Total P&L (all-time)</span>
                  <span className={`font-bold ${(cash.result || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(cash.result || 0) >= 0 ? '+' : ''}{formatCurrency(cash.result)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KPICard({ title, value, subtitle, loading, color }) {
  return (
    <div className="bg-white p-4 rounded-xl border">
      <p className="text-sm text-gray-500">{title}</p>
      {loading ? (
        <div className="h-8 bg-gray-200 animate-pulse rounded mt-1" />
      ) : (
        <>
          <p className="text-xl font-bold mt-1" style={{ color }}>{value}</p>
          {subtitle && <p className="text-xs mt-0.5" style={{ color }}>{subtitle}</p>}
        </>
      )}
    </div>
  )
}
