// Canonical registry of feature modules and subscription plans.
//
// This is the single source of truth for which modules exist, which plan
// tier unlocks them, and how a company's effective entitlements are
// resolved. The server-side mirror of this file lives at
// supabase/functions/_shared/entitlements.ts and must be kept in sync.

export const TIER_ORDER = ['solo', 'team', 'business', 'ai'];

export const MODULES = {
  // ---- Solo (always available, every plan includes these) ----
  customers: {
    label: 'Customers',
    tier: 'solo',
    description: 'Manage your customer list, contact details and job history.',
  },
  routes: {
    label: 'Routes',
    tier: 'solo',
    description: 'Plan and organise your cleaning routes.',
  },
  jobs: {
    label: 'Jobs',
    tier: 'solo',
    description: 'Schedule and track individual cleaning jobs.',
  },
  invoicing: {
    label: 'Invoicing',
    tier: 'solo',
    description: 'Create, send and track invoices.',
  },
  gocardless: {
    label: 'Direct Debit (GoCardless)',
    tier: 'solo',
    description: 'Collect recurring payments automatically via GoCardless.',
  },
  dashboard: {
    label: 'Dashboard',
    tier: 'solo',
    description: 'An overview of your business at a glance.',
  },
  pwa: {
    label: 'Mobile App',
    tier: 'solo',
    description: 'Install ClearRoute on your phone as an app.',
  },

  // ---- Team (multi-worker businesses) ----
  field_worker: {
    label: 'Field Worker App',
    tier: 'team',
    description: 'Give workers their own routes and job lists on mobile.',
  },
  scheduling: {
    label: 'Scheduling',
    tier: 'team',
    description: 'Plan and assign work across your team.',
  },
  job_assignment: {
    label: 'Job Assignment',
    tier: 'team',
    description: 'Assign individual jobs to specific workers.',
  },
  recurring_invoices: {
    label: 'Recurring Invoices',
    tier: 'team',
    description: 'Automatically generate and send repeat invoices.',
  },
  quotes: {
    label: 'Quotes',
    tier: 'team',
    description: 'Create and send quotes to prospective customers.',
  },
  customer_portal: {
    label: 'Customer Portal',
    tier: 'team',
    description: 'Let customers view invoices and pay online.',
  },
  stripe: {
    label: 'Card Payments (Stripe)',
    tier: 'team',
    description: 'Accept card payments on invoices via Stripe.',
  },
  csv_import: {
    label: 'CSV Import',
    tier: 'team',
    description: 'Bulk import customers from a spreadsheet.',
  },
  notifications: {
    label: 'Notifications',
    tier: 'team',
    description: 'In-app notifications for you and your team.',
  },
  multi_user: {
    label: 'Team Members',
    tier: 'team',
    description: 'Invite workers and managers to your account.',
  },

  // ---- Business (accounting & compliance) ----
  vat_mtd: {
    label: 'VAT (Making Tax Digital)',
    tier: 'business',
    description: 'Submit VAT returns to HMRC under Making Tax Digital.',
  },
  xero: {
    label: 'Xero Integration',
    tier: 'business',
    description: 'Sync invoices, customers and payments with Xero.',
  },
  quickbooks: {
    label: 'QuickBooks Integration',
    tier: 'business',
    description: 'Sync invoices, customers and payments with QuickBooks.',
  },
  open_banking: {
    label: 'Open Banking',
    tier: 'business',
    description: 'Connect your bank account to track transactions automatically.',
  },
  companies_house: {
    label: 'Companies House Lookup',
    tier: 'business',
    description: 'Look up registered company details from Companies House.',
  },
  vat_validation: {
    label: 'VAT Number Validation',
    tier: 'business',
    description: "Validate customers' VAT numbers with HMRC.",
  },
  audit_log: {
    label: 'Audit Log',
    tier: 'business',
    description: 'See a full history of changes made across your account.',
  },
  data_export: {
    label: 'Data Export',
    tier: 'business',
    description: 'Export your business data for backup or accounting.',
  },
  receipt_ocr: {
    label: 'Receipt Scanning',
    tier: 'business',
    description: 'Scan receipts to automatically log expenses.',
  },

  // ---- AI (premium add-ons powered by the Claude API) ----
  ai_copilot: {
    label: 'AI Copilot',
    tier: 'ai',
    description: 'Chat with an AI assistant about your business and data.',
  },
  cashflow_forecast: {
    label: 'Cash Flow Forecast',
    tier: 'ai',
    description: 'AI-powered predictions of your future cash position.',
  },
  smart_scheduling_ai: {
    label: 'Smart Scheduling',
    tier: 'ai',
    description: 'AI-optimised suggestions for scheduling jobs and routes.',
  },
  churn_prediction: {
    label: 'Customer Health',
    tier: 'ai',
    description: 'AI-powered identification of customers at risk of leaving.',
  },
  auto_comms: {
    label: 'Automated Communications',
    tier: 'ai',
    description: 'AI-generated customer communications and reminders.',
  },
  expense_ai: {
    label: 'Expense Categorisation',
    tier: 'ai',
    description: 'AI-powered expense categorisation and VAT suggestions.',
  },
  insights_copilot: {
    label: 'Business Insights',
    tier: 'ai',
    description: 'AI-generated insights and recommendations for your business.',
  },
  anomaly_detection: {
    label: 'Anomaly Detection',
    tier: 'ai',
    description: 'AI-powered detection of unusual or risky invoices.',
  },
  route_optimisation: {
    label: 'Route Optimisation',
    tier: 'ai',
    description: 'AI-optimised route planning and performance analysis.',
  },
  smart_onboarding_ai: {
    label: 'Smart Onboarding',
    tier: 'ai',
    description: 'AI-guided setup recommendations while you get started.',
  },
  invoice_writer: {
    label: 'Invoice Writing Assistant',
    tier: 'ai',
    description: 'AI assistance writing invoice line items and descriptions.',
  },
  fraud_detection: {
    label: 'Fraud Detection',
    tier: 'ai',
    description: 'AI-powered monitoring for fraud and security risks.',
  },
};

const modulesForTier = (tier) =>
  Object.keys(MODULES).filter((key) => MODULES[key].tier === tier);

// Monthly price in GBP. Solo is the free baseline; Team/Business/AI are the
// paid, subscribable tiers (each maps to a Stripe price - see STRIPE_SETUP.md).
// `paid: true` marks tiers that go through Stripe Checkout.
export const PLANS = {
  solo: {
    key: 'solo',
    name: 'Solo',
    description: 'Everything a sole trader needs to run their round.',
    perSeat: false,
    price: 0,
    paid: false,
    modules: [...modulesForTier('solo')],
  },
  team: {
    key: 'team',
    name: 'Team',
    description: 'Adds scheduling, quotes, the customer portal and team management for multi-worker businesses.',
    perSeat: true,
    price: 79,
    paid: true,
    modules: [...modulesForTier('solo'), ...modulesForTier('team')],
  },
  business: {
    key: 'business',
    name: 'Business',
    description: 'Adds accounting integrations, VAT submission and compliance tools.',
    perSeat: true,
    price: 149,
    paid: true,
    modules: [...modulesForTier('solo'), ...modulesForTier('team'), ...modulesForTier('business')],
  },
  ai: {
    key: 'ai',
    name: 'AI',
    description: 'Everything in Business, plus AI copilots across the app.',
    perSeat: true,
    price: 299,
    paid: true,
    modules: [
      ...modulesForTier('solo'),
      ...modulesForTier('team'),
      ...modulesForTier('business'),
      ...modulesForTier('ai'),
    ],
  },
};

// Returns the set of module keys a company is entitled to, given its plan
// and any per-company overrides. Overrides are additive only - they can
// switch on extra modules but never remove ones included in the plan.
export function resolveEntitlements(plan, enabledModules) {
  const planConfig = PLANS[plan] || PLANS.solo;
  const overrides = Array.isArray(enabledModules) ? enabledModules : [];
  return new Set([...planConfig.modules, ...overrides]);
}

// Returns the cheapest plan key that includes the given module, or null if
// no plan includes it (shouldn't happen for a valid module key).
export function planThatUnlocks(moduleKey) {
  for (const planKey of TIER_ORDER) {
    if (PLANS[planKey].modules.includes(moduleKey)) return planKey;
  }
  return null;
}

export function getModule(moduleKey) {
  return MODULES[moduleKey] || null;
}
