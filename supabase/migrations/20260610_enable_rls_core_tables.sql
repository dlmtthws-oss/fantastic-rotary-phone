-- Migration: Enable RLS on core tables exposed to the anon key
-- Date: 2026-06-10
--
-- customers, jobs, routes, route_stops, invoices, payments and invoice_items
-- had RLS disabled, leaving them fully readable/writable with the anon key.
-- routes, route_stops, invoices and payments already had authenticated
-- full-access policies defined (dormant while RLS was off); customers, jobs
-- and invoice_items get the same policy here. The customer portal is
-- unaffected: it reads via edge functions using the service role.

CREATE POLICY customers_all ON customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY jobs_all ON jobs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY invoice_items_all ON invoice_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
