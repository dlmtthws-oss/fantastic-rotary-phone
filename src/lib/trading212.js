import { supabase } from './supabase'

const EDGE_FUNCTION_URL = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1`

async function callProxy(endpoint, userId, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const response = await fetch(`${EDGE_FUNCTION_URL}/trading212-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      endpoint,
      userId,
      method: options.method || 'GET',
      body: options.body,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `API error: ${response.status}`)
  }

  return response.json()
}

export async function getAccountInfo(userId) {
  return callProxy('/equity/account/info', userId)
}

export async function getCashBalance(userId) {
  return callProxy('/equity/account/cash', userId)
}

export async function getPortfolio(userId) {
  return callProxy('/equity/portfolio', userId)
}

export async function getInstruments(userId) {
  return callProxy('/equity/metadata/instruments', userId)
}

export async function getOrderHistory(userId, cursor, limit = 50) {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  params.set('limit', String(limit))
  const query = params.toString()
  return callProxy(`/equity/history/orders?${query}`, userId)
}

export async function getDividendHistory(userId, cursor, limit = 50) {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  params.set('limit', String(limit))
  const query = params.toString()
  return callProxy(`/equity/history/dividends?${query}`, userId)
}

export async function getTransactionHistory(userId, cursor, limit = 50) {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)
  params.set('limit', String(limit))
  const query = params.toString()
  return callProxy(`/equity/history/transactions?${query}`, userId)
}

export async function getPies(userId) {
  return callProxy('/equity/pies', userId)
}

export async function getPieDetails(userId, pieId) {
  return callProxy(`/equity/pies/${pieId}`, userId)
}

export async function getActiveOrders(userId) {
  return callProxy('/equity/orders', userId)
}

export async function testConnection(userId) {
  try {
    const info = await getAccountInfo(userId)
    return { success: true, data: info }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export async function saveApiKey(userId, apiKey, environment) {
  const { data: existing } = await supabase
    .from('trading_accounts')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('trading_accounts')
      .update({ api_key: apiKey, environment, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('trading_accounts')
      .insert({ user_id: userId, api_key: apiKey, environment })
    if (error) throw error
  }
}

export async function getStoredSettings(userId) {
  const { data } = await supabase
    .from('trading_accounts')
    .select('environment, created_at, updated_at')
    .eq('user_id', userId)
    .single()
  return data
}

export async function removeApiKey(userId) {
  const { error } = await supabase
    .from('trading_accounts')
    .delete()
    .eq('user_id', userId)
  if (error) throw error
}

export async function generateInsights(userId, analysisType = 'full') {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const response = await fetch(`${EDGE_FUNCTION_URL}/trading212-insights`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ userId, analysisType }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'Insights generation failed')
  }

  return response.json()
}

export async function getPastInsights(userId) {
  const { data } = await supabase
    .from('trading_insights')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)
  return data || []
}

export async function savePortfolioSnapshot(userId, portfolioData, cashData) {
  const totalValue = (portfolioData || []).reduce(
    (sum, p) => sum + (p.quantity * p.currentPrice), 0
  )
  const totalInvested = (portfolioData || []).reduce(
    (sum, p) => sum + (p.quantity * p.averagePrice), 0
  )

  const { error } = await supabase
    .from('trading_snapshots')
    .insert({
      user_id: userId,
      total_value: totalValue,
      total_invested: totalInvested,
      cash_free: cashData?.free || 0,
      cash_total: cashData?.total || 0,
      position_count: portfolioData?.length || 0,
      positions: portfolioData,
    })
  if (error) throw error
}
