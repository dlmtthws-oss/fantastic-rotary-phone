-- Apply the accounting-integration schema that previously lived only in the
-- standalone supabase/*.sql scripts and had never been applied to the live
-- database (discovered 2026-07-21: none of these tables existed remotely).
-- Also corrects two mismatches against the real schema:
--   * audit_log.customer_id references customers(id), which is BIGINT (legacy),
--     not UUID as the original companies_house.sql assumed.
--   * sync_all_bank_connections() writes notifications.message (the real
--     column), not the non-existent notifications.body.
-- The per-connection RPC helper functions from the original scripts that
-- referenced a dropped profiles_id column are intentionally omitted; the edge
-- functions perform those operations directly.

-- ==========================================================================
-- Audit log (prerequisite for companies_house + bank feed foreign keys)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_name TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_reference TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit log" ON audit_log;
CREATE POLICY "Admins can view audit log" ON audit_log
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Service role can insert audit log" ON audit_log;
CREATE POLICY "Service role can insert audit log" ON audit_log
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "No update audit log" ON audit_log;
CREATE POLICY "No update audit log" ON audit_log FOR UPDATE USING (false);

DROP POLICY IF EXISTS "No delete audit log" ON audit_log;
CREATE POLICY "No delete audit log" ON audit_log FOR DELETE USING (false);

CREATE OR REPLACE FUNCTION log_audit_event(
  p_action TEXT, p_entity_type TEXT, p_entity_id UUID DEFAULT NULL,
  p_entity_reference TEXT DEFAULT NULL, p_old_values JSONB DEFAULT NULL, p_new_values JSONB DEFAULT NULL
) RETURNS VOID AS $$
DECLARE v_user_id UUID; v_user_name TEXT; v_user_role TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT id, full_name, role INTO v_user_id, v_user_name, v_user_role FROM profiles WHERE id = auth.uid();
  END IF;
  INSERT INTO audit_log (user_id, user_name, user_role, action, entity_type, entity_id, entity_reference, old_values, new_values)
  VALUES (v_user_id, v_user_name, v_user_role, p_action, p_entity_type, p_entity_id, p_entity_reference, p_old_values, p_new_values);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Audit log failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================================
-- Companies House / VAT validation
-- ==========================================================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_number TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_business BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vat_number TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vat_validated BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vat_validated_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS registered_address_line_1 TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS registered_address_line_2 TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS registered_city TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS registered_postcode TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_company_number ON customers(company_number);
CREATE INDEX IF NOT EXISTS idx_customers_vat_number ON customers(vat_number);

CREATE TABLE IF NOT EXISTS vat_validation_cache (
  vat_number TEXT PRIMARY KEY,
  is_valid BOOLEAN,
  company_name TEXT,
  address TEXT,
  validated_at TIMESTAMPTZ DEFAULT NOW()
);

-- customers.id is BIGINT (legacy), not UUID.
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id);

-- ==========================================================================
-- Xero
-- ==========================================================================
CREATE TABLE IF NOT EXISTS xero_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL, tenant_name TEXT NOT NULL,
  access_token TEXT NOT NULL, refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL, is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ DEFAULT NOW(), last_synced_at TIMESTAMPTZ
);
ALTER TABLE xero_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own xero connections" ON xero_connections FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own xero connections" ON xero_connections FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own xero connections" ON xero_connections FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can delete xero connections" ON xero_connections FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS xero_sync_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  auto_sync_invoices BOOLEAN DEFAULT true, auto_sync_expenses BOOLEAN DEFAULT true, auto_sync_payments BOOLEAN DEFAULT true,
  account_code_mappings JSONB DEFAULT '{"fuel":"449","equipment":"720","supplies":"400","insurance":"478","other":"404"}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE xero_sync_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own xero settings" ON xero_sync_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own xero settings" ON xero_sync_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own xero settings" ON xero_sync_settings FOR UPDATE USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS xero_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('invoice','customer','expense','payment')),
  entity_id UUID NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('to_xero','from_xero')),
  status TEXT NOT NULL CHECK (status IN ('success','error')),
  xero_id TEXT, error_message TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE xero_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own xero sync log" ON xero_sync_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can insert xero sync log" ON xero_sync_log FOR INSERT WITH CHECK (true);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_invoice_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_synced_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xero_sync_status TEXT DEFAULT 'not_synced' CHECK (xero_sync_status IN ('not_synced','synced','error'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_xero_id ON invoices(xero_invoice_id) WHERE xero_invoice_id IS NOT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS xero_contact_id TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS xero_synced_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_xero_id ON customers(xero_contact_id) WHERE xero_contact_id IS NOT NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS xero_bill_id TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS xero_synced_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_xero_id ON expenses(xero_bill_id) WHERE xero_bill_id IS NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS xero_payment_id TEXT;

-- ==========================================================================
-- QuickBooks
-- ==========================================================================
CREATE TABLE IF NOT EXISTS quickbooks_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  realm_id TEXT NOT NULL, company_name TEXT NOT NULL,
  access_token TEXT NOT NULL, refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL, is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ DEFAULT NOW(), last_synced_at TIMESTAMPTZ
);
ALTER TABLE quickbooks_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quickbooks connections" ON quickbooks_connections FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own quickbooks connections" ON quickbooks_connections FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own quickbooks connections" ON quickbooks_connections FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can delete quickbooks connections" ON quickbooks_connections FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS quickbooks_sync_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  auto_sync_invoices BOOLEAN DEFAULT true, auto_sync_expenses BOOLEAN DEFAULT true, auto_sync_payments BOOLEAN DEFAULT true,
  income_account_id TEXT, income_account_name TEXT, bank_account_id TEXT, bank_account_name TEXT,
  expense_account_mappings JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE quickbooks_sync_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quickbooks settings" ON quickbooks_sync_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own quickbooks settings" ON quickbooks_sync_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own quickbooks settings" ON quickbooks_sync_settings FOR UPDATE USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS quickbooks_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('invoice','customer','expense','payment')),
  entity_id UUID NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('to_qbo','from_qbo')),
  status TEXT NOT NULL CHECK (status IN ('success','error')),
  qbo_id TEXT, error_message TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE quickbooks_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quickbooks sync log" ON quickbooks_sync_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can insert quickbooks sync log" ON quickbooks_sync_log FOR INSERT WITH CHECK (true);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qbo_invoice_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qbo_synced_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qbo_sync_status TEXT DEFAULT 'not_synced' CHECK (qbo_sync_status IN ('not_synced','synced','error'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_qbo_id ON invoices(qbo_invoice_id) WHERE qbo_invoice_id IS NOT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS qbo_customer_id TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS qbo_synced_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_qbo_id ON customers(qbo_customer_id) WHERE qbo_customer_id IS NOT NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_bill_id TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_synced_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_qbo_id ON expenses(qbo_bill_id) WHERE qbo_bill_id IS NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS qbo_payment_id TEXT;

-- ==========================================================================
-- TrueLayer bank feed
-- ==========================================================================
CREATE TABLE IF NOT EXISTS bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL, account_name TEXT NOT NULL,
  account_number_last4 TEXT, sort_code TEXT, currency TEXT DEFAULT 'GBP',
  access_token TEXT NOT NULL, refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL, last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true, truelayer_connection_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES bank_connections(id) ON DELETE CASCADE,
  truelayer_transaction_id TEXT UNIQUE, date DATE NOT NULL, description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL, currency TEXT DEFAULT 'GBP',
  transaction_type TEXT CHECK (transaction_type IN ('credit','debit')),
  merchant_name TEXT, category TEXT,
  reconciliation_status TEXT DEFAULT 'unmatched' CHECK (reconciliation_status IN ('unmatched','matched','ignored','needs_review')),
  matched_invoice_id UUID REFERENCES invoices(id), matched_expense_id UUID REFERENCES expenses(id),
  matched_at TIMESTAMPTZ, matched_by UUID REFERENCES profiles(id), ignore_reason TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_connection ON bank_transactions(connection_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON bank_transactions(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(date);

ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own bank connections" ON bank_connections FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create bank connections" ON bank_connections FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own bank connections" ON bank_connections FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can delete bank connections" ON bank_connections FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own bank transactions" ON bank_transactions FOR SELECT USING (connection_id IN (SELECT id FROM bank_connections WHERE user_id = auth.uid()));
CREATE POLICY "System can insert bank transactions" ON bank_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own bank transactions" ON bank_transactions FOR UPDATE USING (connection_id IN (SELECT id FROM bank_connections WHERE user_id = auth.uid()));

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS bank_transaction_id UUID REFERENCES bank_transactions(id);

CREATE TABLE IF NOT EXISTS bank_connection_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  code_verifier TEXT NOT NULL, auth_state TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================================
-- OAuth CSRF state tables (new - back the state-validation hardening added to
-- the xero and hmrc callback edge functions)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS xero_oauth_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  state TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS hmrc_oauth_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vrn TEXT NOT NULL, state TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
);
