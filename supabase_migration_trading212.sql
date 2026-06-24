-- Trading 212 Integration Tables
-- Run this migration to set up the database tables for the trading module

-- Store Trading 212 API credentials per user
CREATE TABLE IF NOT EXISTS trading_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  api_key TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'demo' CHECK (environment IN ('demo', 'live')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE trading_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own trading account"
  ON trading_accounts
  FOR ALL
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Historical portfolio snapshots for performance tracking
CREATE TABLE IF NOT EXISTS trading_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_invested DECIMAL(15,2) NOT NULL DEFAULT 0,
  cash_free DECIMAL(15,2) NOT NULL DEFAULT 0,
  cash_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  position_count INTEGER NOT NULL DEFAULT 0,
  positions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trading_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own snapshots"
  ON trading_snapshots
  FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own snapshots"
  ON trading_snapshots
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE INDEX idx_trading_snapshots_user_date
  ON trading_snapshots(user_id, created_at DESC);

-- AI-generated portfolio insights
CREATE TABLE IF NOT EXISTS trading_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  analysis_type TEXT NOT NULL DEFAULT 'full',
  portfolio_snapshot JSONB,
  analysis TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trading_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own insights"
  ON trading_insights
  FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Service role can insert insights"
  ON trading_insights
  FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_trading_insights_user_date
  ON trading_insights(user_id, created_at DESC);
