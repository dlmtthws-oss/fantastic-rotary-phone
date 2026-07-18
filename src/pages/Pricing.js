import { Link } from 'react-router-dom'
import PublicLayout from '../components/PublicLayout'
import { PLANS, MODULES, TIER_ORDER } from '../config/modules'

// Public pricing page. CTAs send visitors into signup; the actual Stripe
// Checkout happens in-app once they have a company (Settings → Plan & Billing).
const HIGHLIGHTS = {
  solo: ['Customers & rounds', 'Invoicing', 'Direct Debit', 'Mobile app'],
  team: ['Everything in Solo', 'Scheduling & quotes', 'Customer portal', 'Card payments', 'Team members'],
  business: ['Everything in Team', 'Xero & QuickBooks', 'VAT (MTD)', 'Open Banking', 'Audit log'],
  ai: ['Everything in Business', 'AI route optimisation', 'Cash-flow forecast', 'Churn scoring', 'AI copilot'],
}

export default function Pricing() {
  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-8 text-center">
        <h1 className="text-4xl font-bold">Pricing that grows with you</h1>
        <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
          Solo is free forever. Team, Business and AI each start with a 14-day free trial —
          no card charged until the trial ends, cancel anytime.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {TIER_ORDER.map((key) => {
            const p = PLANS[key]
            const featured = key === 'team'
            return (
              <div
                key={key}
                className={`p-6 rounded-2xl border flex flex-col ${featured ? 'border-blue-600 shadow-lg' : 'border-gray-200'}`}
              >
                {featured && (
                  <span className="self-start px-2 py-0.5 rounded-full text-xs font-medium mb-2" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                    Most popular
                  </span>
                )}
                <h3 className="font-semibold text-lg">{p.name}</h3>
                <p className="text-3xl font-bold mt-2">
                  {p.price ? `£${p.price}` : 'Free'}
                  <span className="text-sm font-normal text-gray-500">{p.price ? '/mo' : ''}</span>
                </p>
                <p className="text-xs text-gray-500 mb-4">{p.perSeat ? 'per seat · billed monthly' : 'single user'}</p>
                <ul className="space-y-2 text-sm text-gray-700 flex-1">
                  {HIGHLIGHTS[key].map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>{h}
                    </li>
                  ))}
                </ul>
                {p.comingSoon ? (
                  <span className="mt-6 text-center px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-400 cursor-not-allowed">
                    Coming soon
                  </span>
                ) : (
                  <Link
                    to="/login?mode=register"
                    className={`mt-6 text-center px-4 py-2 rounded-lg font-medium ${featured ? 'text-white' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'}`}
                    style={featured ? { background: 'linear-gradient(135deg, #3b82f6, #2563eb)' } : undefined}
                  >
                    {p.paid ? 'Start free trial' : 'Get started free'}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Full feature matrix */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-center mb-8">What's included</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 pr-4 font-medium text-gray-500">Feature</th>
                {TIER_ORDER.map((key) => (
                  <th key={key} className="py-3 px-3 font-medium text-center">{PLANS[key].name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(MODULES).map(([mKey, m]) => (
                <tr key={mKey} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{m.label}</td>
                  {TIER_ORDER.map((key) => (
                    <td key={key} className="py-2 px-3 text-center">
                      {PLANS[key].modules.includes(mKey) ? <span className="text-green-600">✓</span> : <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-center mt-10">
          <Link to="/login?mode=register" className="inline-block px-6 py-3 rounded-lg text-white font-medium" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
            Start your free trial
          </Link>
        </div>
      </section>
    </PublicLayout>
  )
}
