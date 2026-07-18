import { Link } from 'react-router-dom'
import PublicLayout from '../components/PublicLayout'
import { VERTICALS } from '../config/verticals'
import { PLANS, TIER_ORDER } from '../config/modules'

const FEATURES = [
  { icon: '🗺️', title: 'Round & route planning', body: 'Auto-build daily rounds, optimise stops and track jobs from your phone.' },
  { icon: '👥', title: 'Customer CRM', body: 'Full customer records, service history, pricing and CSV import.' },
  { icon: '📄', title: 'Invoicing & payments', body: 'Professional invoices, Direct Debit (GoCardless) and card payments (Stripe).' },
  { icon: '📊', title: 'Reports & VAT', body: 'P&L, cash flow and HMRC Making Tax Digital VAT submissions.' },
  { icon: '✨', title: 'AI copilots', body: 'Route optimisation, cash-flow forecasting, churn scoring and more.' },
  { icon: '👷', title: 'Team & field app', body: 'Invite workers, assign rounds and track completion on mobile.' },
]

export default function Landing() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-6" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
          14-day free trial · no setup fees
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
          Run your whole field-service business from one place
        </h1>
        <p className="text-lg text-gray-600 mt-6 max-w-2xl mx-auto">
          ClearRoute saves field-service businesses 10+ hours a week on admin — rounds,
          customers, invoicing, payments and reports, with AI built in.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link to="/login?mode=register" className="px-6 py-3 rounded-lg text-white font-medium" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
            Start your free trial
          </Link>
          <Link to="/pricing" className="px-6 py-3 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">
            See pricing
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-4">No card charged during your trial. Cancel anytime.</p>
      </section>

      {/* Trades */}
      <section className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-center text-sm text-gray-500 mb-6">Built for field-service trades</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {Object.values(VERTICALS).map((v) => (
            <span key={v.key} className="px-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-sm text-gray-700">
              {v.icon} {v.label}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Everything you need to run the round</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-3">Simple, per-seat pricing</h2>
        <p className="text-center text-gray-600 mb-10">Start free on Solo, upgrade when you grow. Every paid plan starts with a 14-day trial.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {TIER_ORDER.map((key) => {
            const p = PLANS[key]
            return (
              <div key={key} className="p-5 rounded-2xl border border-gray-200 text-center">
                <p className="font-semibold">{p.name}</p>
                <p className="text-2xl font-bold mt-1">{p.price ? `£${p.price}` : 'Free'}<span className="text-sm font-normal text-gray-500">{p.price ? '/mo' : ''}</span></p>
                <p className="text-xs text-gray-500 mt-1">{p.perSeat ? 'per seat' : 'single user'}</p>
              </div>
            )
          })}
        </div>
        <div className="text-center mt-8">
          <Link to="/pricing" className="text-blue-600 hover:underline font-medium">Compare plans &amp; features →</Link>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-8">
        <div className="rounded-3xl px-8 py-14 text-center text-white" style={{ background: 'linear-gradient(135deg, #1e3a5f, #0f172a)' }}>
          <h2 className="text-3xl font-bold mb-3">Ready to get your evenings back?</h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">Set up your business in minutes and see your first round planned today.</p>
          <Link to="/login?mode=register" className="inline-block px-6 py-3 rounded-lg bg-white text-gray-900 font-medium hover:bg-gray-100">
            Start your free trial
          </Link>
        </div>
      </section>
    </PublicLayout>
  )
}
