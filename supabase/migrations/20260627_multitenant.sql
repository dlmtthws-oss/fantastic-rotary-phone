-- Multi-tenant foundation for ClearRoute.
--
-- Introduces a `companies` tenant root (with `business_type` for per-trade
-- skins), stamps every business table with `company_id`, adds a
-- `current_company_id()` helper + auto-stamp trigger, and replaces the old
-- permissive `USING (true)` policies with strict per-company RLS.
--
-- Existing data is backfilled into a single default company so nothing that
-- is already in the database is lost or orphaned.
--
-- The list of tenant tables is declared once and iterated, so the column,
-- index, trigger and policy are applied uniformly. `trading_*` tables are
-- intentionally excluded (separate per-user model, out of scope).

begin;

-- ---------------------------------------------------------------------------
-- 1. Tenant root
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default 'My Company',
  business_type text not null default 'window_cleaning',
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.companies enable row level security;

-- profiles belong to a company
alter table public.profiles
  add column if not exists company_id uuid references public.companies(id) on delete set null;
create index if not exists profiles_company_id_idx on public.profiles(company_id);

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
-- Returns the caller's company. SECURITY DEFINER so it can read profiles
-- without tripping the profiles RLS policy (and avoids policy recursion).
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select company_id from public.profiles where id = auth.uid()
$fn$;

revoke all on function public.current_company_id() from public;
grant execute on function public.current_company_id() to authenticated, service_role;

-- Auto-stamp company_id on insert when the client omits it. This is a safety
-- net for authenticated client inserts; service-role callers bypass it and
-- MUST set company_id explicitly.
create or replace function public.set_company_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.company_id is null then
    new.company_id := public.current_company_id();
  end if;
  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. hmrc_connections has a legacy text `company_id` (0 rows) - replace it
--    with the uuid tenant link so it matches every other table.
-- ---------------------------------------------------------------------------
alter table public.hmrc_connections drop column if exists company_id;

-- A few niceties for the invitation flow.
alter table public.invitations add column if not exists full_name   text;
alter table public.invitations add column if not exists accepted_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Stamp every tenant table: company_id column + index + isolation policy
--    + auto-stamp trigger. Old permissive policies are dropped.
-- ---------------------------------------------------------------------------
do $do$
declare
  t   text;
  pol record;
  tenant_tables text[] := array[
    'activity_log','ai_communications','ai_usage_log','business_insights','business_settings',
    'cash_flow_forecast','company_settings','customer_churn','customers','email_log','email_templates',
    'expenses','gocardless_mandates','gocardless_payments','hmrc_connections','import_log','invitations',
    'invoice_anomalies','invoice_items','invoice_line_items','invoice_reminders','invoices','job_executions',
    'job_photos','jobs','notifications','onboarding_checklist','onboarding_progress','payments',
    'quote_line_items','quotes','recurring_invoice_line_items','recurring_invoice_templates','risk_events',
    'risk_thresholds','route_optimisation_history','route_sessions','route_stops','routes',
    'scheduling_suggestions','sms_log','stripe_payments','vat_returns'
  ];
begin
  foreach t in array tenant_tables loop
    execute format(
      'alter table public.%I add column if not exists company_id uuid references public.companies(id) on delete cascade', t);
    execute format(
      'create index if not exists %I on public.%I(company_id)', t || '_company_id_idx', t);
    execute format('alter table public.%I enable row level security', t);

    -- drop any pre-existing policies on this table
    for pol in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;

    -- strict per-company isolation; (select ...) keeps the helper from being
    -- re-evaluated per row (auth_rls_initplan).
    execute format(
      'create policy company_isolation on public.%I for all to authenticated '
      || 'using (company_id = (select public.current_company_id())) '
      || 'with check (company_id = (select public.current_company_id()))', t);

    execute format('drop trigger if exists set_company_id_trg on public.%I', t);
    execute format(
      'create trigger set_company_id_trg before insert on public.%I '
      || 'for each row execute function public.set_company_id()', t);
  end loop;
end
$do$;

-- ---------------------------------------------------------------------------
-- 5. profiles + companies policies (special-cased)
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;

-- See your own profile and everyone in your company (team management).
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or company_id = (select public.current_company_id()));
-- You may only create/update your own profile row from the client; the
-- signup and invite-accept flows run server-side with the service role.
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy companies_select on public.companies for select to authenticated
  using (id = (select public.current_company_id()));
create policy companies_update on public.companies for update to authenticated
  using (id = (select public.current_company_id()))
  with check (id = (select public.current_company_id()));
grant select, update on public.companies to authenticated;

-- ---------------------------------------------------------------------------
-- 6. business_settings was a singleton (id integer default 1). Give it a
--    sequence so each company can have its own row.
-- ---------------------------------------------------------------------------
create sequence if not exists public.business_settings_id_seq owned by public.business_settings.id;
select setval('public.business_settings_id_seq',
              coalesce((select max(id) from public.business_settings), 0) + 1, false);
alter table public.business_settings alter column id set default nextval('public.business_settings_id_seq');
grant usage, select on sequence public.business_settings_id_seq to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Backfill: move all existing data into one default company.
-- ---------------------------------------------------------------------------
do $do$
declare
  v_company uuid;
  t text;
  tenant_tables text[] := array[
    'activity_log','ai_communications','ai_usage_log','business_insights','business_settings',
    'cash_flow_forecast','company_settings','customer_churn','customers','email_log','email_templates',
    'expenses','gocardless_mandates','gocardless_payments','hmrc_connections','import_log','invitations',
    'invoice_anomalies','invoice_items','invoice_line_items','invoice_reminders','invoices','job_executions',
    'job_photos','jobs','notifications','onboarding_checklist','onboarding_progress','payments',
    'quote_line_items','quotes','recurring_invoice_line_items','recurring_invoice_templates','risk_events',
    'risk_thresholds','route_optimisation_history','route_sessions','route_stops','routes',
    'scheduling_suggestions','sms_log','stripe_payments','vat_returns'
  ];
begin
  insert into public.companies (name, business_type)
  values (coalesce((select company_name from public.company_settings limit 1), 'My Company'),
          'window_cleaning')
  returning id into v_company;

  update public.profiles set company_id = v_company where company_id is null;

  foreach t in array tenant_tables loop
    execute format('update public.%I set company_id = $1 where company_id is null', t) using v_company;
  end loop;
end
$do$;

-- ---------------------------------------------------------------------------
-- 8. One settings row per company (enables upsert on company_id).
-- ---------------------------------------------------------------------------
create unique index if not exists company_settings_company_id_key  on public.company_settings(company_id);
create unique index if not exists business_settings_company_id_key on public.business_settings(company_id);

commit;
