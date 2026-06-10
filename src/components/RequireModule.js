import { Navigate, useLocation } from 'react-router-dom'
import { useEntitlements } from '../context/EntitlementsContext'

// Wrap a route element to redirect to the Upgrade page when the current
// company's plan doesn't include the given module.
export default function RequireModule({ module, children }) {
  const { isEntitled, loading } = useEntitlements()
  const location = useLocation()

  if (loading) return null

  if (!isEntitled(module)) {
    return <Navigate to={`/upgrade/${module}`} state={{ from: location }} replace />
  }

  return children
}
