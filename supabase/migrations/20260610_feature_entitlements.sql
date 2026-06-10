-- Migration: Feature entitlements (plan + per-company module overrides)
-- Date: 2026-06-10

-- Plan determines the base set of feature modules a company can access.
-- enabled_modules is an additive override (JSON array of module keys) for
-- switching on extra modules for an individual company without changing
-- their plan.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'solo' CHECK (plan IN ('solo', 'team', 'business', 'ai')),
  ADD COLUMN IF NOT EXISTS enabled_modules JSONB,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT;

-- Existing companies keep full access to every module until they actively
-- choose a plan, so nothing they currently use disappears.
UPDATE company_settings SET plan = 'ai' WHERE plan = 'solo';
