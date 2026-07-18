import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, Suspense, lazy } from 'react';
import { supabase } from './lib/supabase';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import OfflineBanner from './components/OfflineBanner';
import { SkeletonTable } from './components/SkeletonComponents';
import { EntitlementsProvider } from './context/EntitlementsContext';
import { CompanyProvider, useCompany } from './context/CompanyContext';
import RequireModule from './components/RequireModule';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const Jobs = lazy(() => import('./pages/Jobs'));
const RoutesPage = lazy(() => import('./pages/Routes'));
const MyRoutes = lazy(() => import('./pages/MyRoutes'));
const RouteExecution = lazy(() => import('./pages/RouteExecution'));
const WorkerDashboard = lazy(() => import('./pages/WorkerDashboard'));
const Login = lazy(() => import('./pages/Login'));
const CustomerImportPage = lazy(() => import('./pages/CustomerImportPage'));
const ImportHistoryPage = lazy(() => import('./pages/ImportHistoryPage'));
const Invoices = lazy(() => import('./pages/Invoices'));
const RecurringInvoices = lazy(() => import('./pages/RecurringInvoices'));
const Quotes = lazy(() => import('./pages/Quotes'));
const QuoteBuilder = lazy(() => import('./pages/QuoteBuilder'));
const QuoteDetail = lazy(() => import('./pages/QuoteDetail'));
const Portal = lazy(() => import('./pages/Portal'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Workers = lazy(() => import('./pages/Workers'));
const OnboardingWizard = lazy(() => import('./pages/OnboardingWizard'));
const InvitationAccept = lazy(() => import('./pages/InvitationAccept'));
const VATReturnReport = lazy(() => import('./pages/VATReturnReport'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const BankFeed = lazy(() => import('./pages/BankFeed'));
const RiskDashboard = lazy(() => import('./components/RiskDashboard'));
const NotFoundPage = lazy(() => import('./pages/NotFound'));
const QuickBooksCallback = lazy(() => import('./pages/QuickBooksCallback'));
const RoutePerformance = lazy(() => import('./pages/RoutePerformance'));
const WorkerPerformanceReport = lazy(() => import('./pages/WorkerPerformanceReport'));
const CashFlowForecast = lazy(() => import('./pages/CashFlowForecast'));
const SmartScheduling = lazy(() => import('./pages/SmartScheduling'));
const CustomerHealth = lazy(() => import('./pages/CustomerHealth'));
const CommunicationsCentre = lazy(() => import('./pages/CommunicationsCentre'));
const InviteUsers = lazy(() => import('./pages/InviteUsers'));
const BusinessInsights = lazy(() => import('./pages/BusinessInsights'));
const AnomalyManagement = lazy(() => import('./pages/AnomalyManagement'));
const Legal = lazy(() => import('./pages/Legal'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Upgrade = lazy(() => import('./pages/Upgrade'));
const PlanAndModules = lazy(() => import('./pages/PlanAndModules'));
const BusinessProfile = lazy(() => import('./pages/BusinessProfile'));
const Landing = lazy(() => import('./pages/Landing'));
const Pricing = lazy(() => import('./pages/Pricing'));

function PageLoading() {
  return (
    <div className="p-6">
      <SkeletonTable rows={8} columns={5} />
    </div>
  );
}

function AppInner() {
  const { session, profile, company, loading } = useCompany();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  const role = profile?.role;
  const isWorker = role === 'worker' || role === 'field_worker';
  // A user object shaped like the one pages already expect, derived from the
  // real session + profile instead of a fabricated demo object.
  const user = session?.user
    ? { ...session.user, ...profile, role, is_worker: isWorker, is_admin: !isWorker }
    : null;

  useEffect(() => {
    async function checkOnboarding() {
      if (!user || isWorker || onboardingChecked || !company) return

      // RLS scopes this to the caller's own company row.
      const { data: settings } = await supabase
        .from('company_settings')
        .select('onboarding_completed')
        .maybeSingle()

      if (settings && !settings.onboarding_completed) {
        setShowOnboarding(true)
      }
      setOnboardingChecked(true)
    }
    checkOnboarding()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isWorker, onboardingChecked, company])

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Public, unauthenticated experience: marketing + auth + the public
    // flows (invitation accept, customer portal, legal).
    return (
      <ErrorBoundary>
        <Router>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/invitation/:token" element={<InvitationAccept />} />
              <Route path="/portal/:token" element={<Portal />} />
              <Route path="/legal" element={<Legal />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </ErrorBoundary>
    );
  }

  if (showOnboarding) {
    return (
      <ErrorBoundary>
        <OnboardingWizard
          user={user}
          onComplete={() => setShowOnboarding(false)}
        />
      </ErrorBoundary>
    );
  }

  if (user.is_worker) {
    return (
      <ErrorBoundary>
        <WorkerDashboard worker={user} onLogout={handleLogout} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary user={user}>
      <OfflineBanner />
      <EntitlementsProvider>
        <Router>
          <Layout user={user} onLogout={handleLogout}>
            <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                {/* Public-only paths: once signed in, send these to the app. */}
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="/pricing" element={<Navigate to="/settings/plan" replace />} />
                <Route path="/onboarding" element={<OnboardingWizard user={user} onComplete={() => setShowOnboarding(false)} />} />
                <Route path="/invitation/:token" element={<InvitationAccept />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/import" element={<RequireModule module="csv_import"><CustomerImportPage /></RequireModule>} />
                <Route path="/customers/import/history" element={<RequireModule module="csv_import"><ImportHistoryPage /></RequireModule>} />
                <Route path="/quotes" element={<RequireModule module="quotes"><Quotes user={user} /></RequireModule>} />
                <Route path="/quotes/new" element={<RequireModule module="quotes"><QuoteBuilder user={user} /></RequireModule>} />
                <Route path="/quotes/:id" element={<RequireModule module="quotes"><QuoteDetail user={user} /></RequireModule>} />
                <Route path="/quotes/:id/edit" element={<RequireModule module="quotes"><QuoteBuilder user={user} /></RequireModule>} />
                <Route path="/jobs" element={<Jobs user={user} />} />
                <Route path="/routes" element={<RoutesPage user={user} />} />
                <Route path="/my-routes" element={<RequireModule module="field_worker"><MyRoutes user={user} /></RequireModule>} />
                <Route path="/my-routes/:routeId/execute" element={<RequireModule module="field_worker"><RouteExecution /></RequireModule>} />
                <Route path="/invoices" element={<Invoices user={user} />} />
                <Route path="/invoices/recurring" element={<RequireModule module="recurring_invoices"><RecurringInvoices user={user} /></RequireModule>} />
                <Route path="/portal/:token" element={<Portal />} />
                <Route path="/expenses" element={<Expenses user={user} />} />
                <Route path="/reports" element={<Reports user={user} />} />
                <Route path="/reports/vat" element={<RequireModule module="vat_mtd"><VATReturnReport user={user} /></RequireModule>} />
                <Route path="/scheduling" element={<RequireModule module="smart_scheduling_ai"><SmartScheduling user={user} /></RequireModule>} />
                <Route path="/cashflow" element={<RequireModule module="cashflow_forecast"><CashFlowForecast user={user} /></RequireModule>} />
                <Route path="/communications" element={<RequireModule module="auto_comms"><CommunicationsCentre user={user} /></RequireModule>} />
                <Route path="/legal" element={<Legal />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/customers/health" element={<RequireModule module="churn_prediction"><CustomerHealth user={user} /></RequireModule>} />
                <Route path="/workers" element={<RequireModule module="multi_user"><Workers /></RequireModule>} />
                <Route path="/settings" element={<Settings user={user} />} />
                <Route path="/settings/business" element={<BusinessProfile />} />
                <Route path="/settings/plan" element={<PlanAndModules />} />
                <Route path="/invite" element={<RequireModule module="multi_user"><InviteUsers user={user} /></RequireModule>} />
                <Route path="/settings/audit-log" element={<RequireModule module="audit_log"><AuditLog /></RequireModule>} />
                <Route path="/settings/quickbooks-callback" element={<RequireModule module="quickbooks"><QuickBooksCallback /></RequireModule>} />
                <Route path="/accounting/bank-feed" element={<RequireModule module="open_banking"><BankFeed /></RequireModule>} />
                <Route path="/reports/anomalies/dashboard" element={<RequireModule module="anomaly_detection"><RiskDashboard /></RequireModule>} />
                <Route path="/reports/anomalies/invoices" element={<RequireModule module="anomaly_detection"><AnomalyManagement user={user} /></RequireModule>} />
                <Route path="/routes/:id/performance" element={<RequireModule module="route_optimisation"><RoutePerformance /></RequireModule>} />
                <Route path="/upgrade/:moduleKey" element={<Upgrade />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </Layout>
        </Router>
      </EntitlementsProvider>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <CompanyProvider>
      <AppInner />
    </CompanyProvider>
  );
}

export default App;
