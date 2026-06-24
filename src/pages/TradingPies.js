import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { getPies, getPieDetails, getInstruments } from '../lib/trading212'
import { supabase } from '../lib/supabase'

const COLORS = ['#3B82F6', '#22C55E', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1']

export default function TradingPies({ user }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pies, setPies] = useState([])
  const [selectedPie, setSelectedPie] = useState(null)
  const [pieDetails, setPieDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [instruments, setInstruments] = useState({})

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

      const [piesData, instrumentData] = await Promise.all([
        getPies(userId),
        getInstruments(userId),
      ])

      const instrumentMap = {}
      if (Array.isArray(instrumentData)) {
        instrumentData.forEach(i => { instrumentMap[i.ticker] = i })
      }
      setInstruments(instrumentMap)
      setPies(piesData || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { loadData() }, [loadData])

  const loadPieDetails = async (pie) => {
    try {
      setSelectedPie(pie)
      setLoadingDetails(true)
      const details = await getPieDetails(userId, pie.id)
      setPieDetails(details)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingDetails(false)
    }
  }

  if (error === 'not_configured') {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Trading 212 not connected.</p>
        <Link to="/trading/settings" className="text-blue-600 hover:underline">Configure API key</Link>
      </div>
    )
  }

  const formatCurrency = (v) => `£${parseFloat(v || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pies</h1>
          <p className="text-gray-500 text-sm">Your Trading 212 auto-invest portfolios</p>
        </div>
        <Link to="/trading" className="text-blue-600 text-sm hover:underline">Back to Dashboard</Link>
      </div>

      {error && error !== 'not_configured' && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border p-6 h-48 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : pies.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <span className="text-5xl block mb-4">🥧</span>
          <h2 className="text-xl font-semibold mb-2">No Pies Found</h2>
          <p className="text-gray-500 mb-4">
            Pies are auto-invest portfolios you create in Trading 212.
            Create one in the Trading 212 app to see it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pie List */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">Your Pies</h2>
            {pies.map(pie => (
              <button
                key={pie.id}
                onClick={() => loadPieDetails(pie)}
                className={`w-full text-left bg-white rounded-xl border p-4 hover:border-blue-300 transition ${
                  selectedPie?.id === pie.id ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <h3 className="font-medium">{pie.settings?.name || `Pie ${pie.id}`}</h3>
                <div className="flex justify-between mt-2">
                  <span className="text-sm text-gray-500">{pie.instruments?.length || 0} instruments</span>
                  {pie.result && (
                    <span className={`text-sm font-medium ${(pie.result.result || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(pie.result.result || 0) >= 0 ? '+' : ''}{formatCurrency(pie.result.result)}
                    </span>
                  )}
                </div>
                {pie.result?.investedValue != null && (
                  <p className="text-xs text-gray-400 mt-1">Invested: {formatCurrency(pie.result.investedValue)}</p>
                )}
              </button>
            ))}
          </div>

          {/* Pie Details */}
          <div className="lg:col-span-2">
            {!selectedPie ? (
              <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
                Select a pie to view its details
              </div>
            ) : loadingDetails ? (
              <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
                Loading pie details...
              </div>
            ) : pieDetails ? (
              <div className="bg-white rounded-xl border p-6 space-y-6">
                <div>
                  <h2 className="text-xl font-bold">{pieDetails.settings?.name || `Pie ${pieDetails.id}`}</h2>
                  {pieDetails.settings?.dividendCashAction && (
                    <p className="text-sm text-gray-500 mt-1">
                      Dividend action: <span className="font-medium">{pieDetails.settings.dividendCashAction}</span>
                    </p>
                  )}
                </div>

                {/* Pie Stats */}
                {pieDetails.result && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600">Invested</p>
                      <p className="text-lg font-bold text-blue-700">{formatCurrency(pieDetails.result.investedValue)}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-green-600">Current Value</p>
                      <p className="text-lg font-bold text-green-700">
                        {formatCurrency((pieDetails.result.investedValue || 0) + (pieDetails.result.result || 0))}
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg ${(pieDetails.result.result || 0) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className={`text-xs ${(pieDetails.result.result || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>P&L</p>
                      <p className={`text-lg font-bold ${(pieDetails.result.result || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {(pieDetails.result.result || 0) >= 0 ? '+' : ''}{formatCurrency(pieDetails.result.result)}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600">Dividends</p>
                      <p className="text-lg font-bold text-gray-700">{formatCurrency(pieDetails.result.dividendCashAction)}</p>
                    </div>
                  </div>
                )}

                {/* Allocation Chart */}
                {pieDetails.instruments?.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Allocation</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieDetails.instruments.map(inst => ({
                                name: instruments[inst.ticker]?.name || inst.ticker,
                                value: inst.expectedShare || inst.currentShare || 0,
                              }))}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={2}
                            >
                              {pieDetails.instruments.map((_, idx) => (
                                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
                            <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: '11px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {pieDetails.instruments.map((inst, idx) => (
                          <div key={inst.ticker} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                              <div>
                                <p className="text-sm font-medium">{inst.ticker}</p>
                                <p className="text-xs text-gray-500">{instruments[inst.ticker]?.name || ''}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{(inst.expectedShare || 0).toFixed(1)}%</p>
                              {inst.result && (
                                <p className={`text-xs ${(inst.result.ppl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {(inst.result.ppl || 0) >= 0 ? '+' : ''}{formatCurrency(inst.result.ppl)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
