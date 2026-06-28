import { Link } from 'react-router-dom'

// Chrome for the public, no-login marketing pages (landing, pricing).
export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <header className="border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>🪟</span>
            ClearRoute
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link>
            <Link to="/login" className="text-gray-600 hover:text-gray-900">Sign in</Link>
            <Link
              to="/login?mode=register"
              className="px-4 py-2 rounded-lg text-white font-medium"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
            >
              Start free trial
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} ClearRoute. Field service business management.</p>
          <div className="flex items-center gap-6">
            <Link to="/pricing" className="hover:text-gray-900">Pricing</Link>
            <Link to="/legal" className="hover:text-gray-900">Terms</Link>
            <Link to="/privacy" className="hover:text-gray-900">Privacy</Link>
            <Link to="/login" className="hover:text-gray-900">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
