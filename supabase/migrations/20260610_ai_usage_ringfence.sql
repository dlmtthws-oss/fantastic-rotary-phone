-- Migration: AI usage ringfencing (bring-your-own-key + monthly metering)
-- Date: 2026-06-10
--
-- AI edge functions either use the subscriber's own Anthropic API key
-- (anthropic_api_key, unmetered) or the platform key, metered against a
-- monthly request allowance (plan default, overridable per company via
-- ai_monthly_request_limit). Every AI request is recorded in ai_usage_log.

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_monthly_request_limit INTEGER;

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  key_source TEXT NOT NULL CHECK (key_source IN ('own', 'platform')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_month
  ON ai_usage_log (key_source, created_at);

-- Authenticated users can see usage (for the Settings page); rows are only
-- written by edge functions using the service role, so no insert policy.
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_log_read ON ai_usage_log
  FOR SELECT TO authenticated USING (true);
