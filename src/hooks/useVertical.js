import { useMemo } from 'react'
import { useCompany } from '../context/CompanyContext'
import { getVertical } from '../config/verticals'

// Returns the resolved vertical "skin" config for the current company's
// business_type. Screens use this for labels, service-type pickers and the
// theme accent. Data and logic are identical across verticals - only the
// presentation changes.
export function useVertical() {
  const { businessType } = useCompany()
  return useMemo(() => getVertical(businessType), [businessType])
}
