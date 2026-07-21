import { Link } from 'react-router-dom'

export default function Settings({ user }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/settings/business" className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">🏢</div>
          <h3 className="font-semibold">Business Profile</h3>
          <p className="text-sm text-gray-600">Update your business name and trade</p>
        </Link>
        <Link to="/invite" className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">✉️</div>
          <h3 className="font-semibold">Invite Users</h3>
          <p className="text-sm text-gray-600">Invite team members to use ClearRoute</p>
        </Link>
        <Link to="/settings/plan" className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">🚀</div>
          <h3 className="font-semibold">Plan & Modules</h3>
          <p className="text-sm text-gray-600">View your subscription plan and included features</p>
        </Link>
        <Link to="/settings/integrations" className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">🔗</div>
          <h3 className="font-semibold">Accounting Integrations</h3>
          <p className="text-sm text-gray-600">Connect Xero, QuickBooks or your bank account</p>
        </Link>
      </div>
    </div>
  )
}
