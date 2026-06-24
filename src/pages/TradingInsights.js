import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { generateInsights, getPastInsights } from '../lib/trading212'
import { supabase } from '../lib/supabase'

export default function TradingInsights({ user }) {
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [currentAnalysis, setCurrentAnalysis] = useState(null)
  const [pastInsights, setPastInsights] = useState([])
  const [selectedInsight, setSelectedInsight] = useState(null)
  const [analysisType, setAnalysisType] = useState('full')

  const userId = user?.id || user?.email

  const loadPastInsights = useCallback(async () => {
    try {
      setLoading(true)
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

      const insights = await getPastInsights(userId)
      setPastInsights(insights)
      if (insights.length > 0) {
        setSelectedInsight(insights[0])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { loadPastInsights() }, [loadPastInsights])

  const handleGenerate = async () => {
    try {
      setGenerating(true)
      setError(null)
      const result = await generateInsights(userId, analysisType)
      setCurrentAnalysis(result)
      await loadPastInsights()
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
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

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : ''

  const renderMarkdown = (text) => {
    if (!text) return null
    return text.split('\n').map((line, i) => {
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-xl font-bold mt-6 mb-3">{line.slice(3)}</h2>
      }
      if (line.startsWith('# ')) {
        return <h1 key={i} className="text-2xl font-bold mt-6 mb-3">{line.slice(2)}</h1>
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={i} className="ml-4 mb-1">{formatInline(line.slice(2))}</li>
      }
      if (line.match(/^\d+\. /)) {
        return <li key={i} className="ml-4 mb-1 list-decimal">{formatInline(line.replace(/^\d+\. /, ''))}</li>
      }
      if (line.trim() === '') {
        return <br key={i} />
      }
      return <p key={i} className="mb-2">{formatInline(line)}</p>
    })
  }

  const formatInline = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Portfolio Insights</h1>
          <p className="text-gray-500 text-sm">AI-powered analysis of your Trading 212 portfolio</p>
        </div>
        <Link to="/trading" className="text-blue-600 text-sm hover:underline">Back to Dashboard</Link>
      </div>

      {error && error !== 'not_configured' && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>
      )}

      {/* Generate Analysis */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-lg">Generate New Analysis</h2>
            <p className="text-sm text-gray-500">Get AI-powered insights on your current portfolio</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Analysis Type</label>
            <select
              value={analysisType}
              onChange={e => setAnalysisType(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="quick">Quick Health Check (3-4 points)</option>
              <option value="full">Full Analysis (comprehensive)</option>
            </select>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⟳</span> Analysing portfolio...
              </span>
            ) : (
              'Generate Insights'
            )}
          </button>
        </div>
      </div>

      {/* Current Analysis */}
      {currentAnalysis && (
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Latest Analysis</h2>
            <span className="text-xs text-gray-400">{formatDate(currentAnalysis.generatedAt)}</span>
          </div>

          {/* Portfolio Summary */}
          {currentAnalysis.portfolio && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">Portfolio Value</p>
                <p className="text-lg font-bold text-blue-600">
                  £{(currentAnalysis.portfolio.totalValue || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Positions</p>
                <p className="text-lg font-bold">{currentAnalysis.portfolio.positionCount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Free Cash</p>
                <p className="text-lg font-bold text-amber-600">
                  £{(currentAnalysis.portfolio.cash?.free || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Cash</p>
                <p className="text-lg font-bold">
                  £{(currentAnalysis.portfolio.cash?.total || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}

          <div className="prose prose-sm max-w-none">
            {renderMarkdown(currentAnalysis.analysis)}
          </div>
        </div>
      )}

      {/* Past Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-lg mb-4">Previous Analyses</h2>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />)}</div>
          ) : pastInsights.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No previous analyses.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pastInsights.map(insight => (
                <button
                  key={insight.id}
                  onClick={() => setSelectedInsight(insight)}
                  className={`w-full text-left p-3 rounded-lg transition ${
                    selectedInsight?.id === insight.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <p className="text-sm font-medium">
                    {insight.analysis_type === 'quick' ? 'Quick Check' : 'Full Analysis'}
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(insight.created_at)}</p>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {insight.analysis?.slice(0, 100)}...
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-lg mb-4">
            {selectedInsight ? 'Analysis Details' : 'Select an Analysis'}
          </h2>
          {selectedInsight ? (
            <div>
              <div className="flex items-center gap-3 mb-4 text-sm text-gray-500">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  selectedInsight.analysis_type === 'quick' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {selectedInsight.analysis_type === 'quick' ? 'Quick Check' : 'Full Analysis'}
                </span>
                <span>{formatDate(selectedInsight.created_at)}</span>
              </div>
              <div className="prose prose-sm max-w-none">
                {renderMarkdown(selectedInsight.analysis)}
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-12">
              Select a previous analysis from the list or generate a new one.
            </p>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-700">
          <strong>Disclaimer:</strong> AI-generated insights are for informational purposes only and do not constitute financial advice.
          Always do your own research and consider consulting a qualified financial adviser before making investment decisions.
        </p>
      </div>
    </div>
  )
}
