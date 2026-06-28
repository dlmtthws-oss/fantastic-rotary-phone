// Per-trade "skins" for ClearRoute.
//
// The same engine (tables, logic, modules) serves different field-service
// trades. A company's `companies.business_type` selects one of these
// configs, which only changes labels, default service types, terminology
// and theming - never data structure or behaviour.
//
// Keep `window_cleaning` as the canonical default; the others are stubs that
// prove the pattern and can be fleshed out per trade.

export const DEFAULT_BUSINESS_TYPE = 'window_cleaning';

export const VERTICALS = {
  window_cleaning: {
    key: 'window_cleaning',
    label: 'Window Cleaning',
    icon: '🪟',
    accent: '#2563EB',
    // The noun this trade uses for a scheduled list of customer visits.
    routeNoun: 'Round',
    routeNounPlural: 'Rounds',
    serviceTypes: [
      { value: 'window_clean', label: 'Window Clean' },
      { value: 'gutter_clean', label: 'Gutter Clean' },
      { value: 'conservatory', label: 'Conservatory Roof' },
      { value: 'fascia_soffit', label: 'Fascia & Soffit' },
    ],
    // Customer-facing terminology overrides. Anything not listed falls back
    // to the generic terms in `BASE_TERMS` below.
    terms: {
      job: 'Clean',
      jobPlural: 'Cleans',
      worker: 'Cleaner',
    },
  },

  gardening: {
    key: 'gardening',
    label: 'Gardening & Grounds',
    icon: '🌳',
    accent: '#16A34A',
    routeNoun: 'Visit schedule',
    routeNounPlural: 'Visit schedules',
    serviceTypes: [
      { value: 'lawn_mowing', label: 'Lawn Mowing' },
      { value: 'hedge_trimming', label: 'Hedge Trimming' },
      { value: 'weeding', label: 'Weeding & Borders' },
      { value: 'garden_tidy', label: 'Garden Tidy-up' },
    ],
    terms: {
      job: 'Visit',
      jobPlural: 'Visits',
      worker: 'Gardener',
    },
  },

  mobile_valeting: {
    key: 'mobile_valeting',
    label: 'Mobile Valeting',
    icon: '🚗',
    accent: '#0891B2',
    routeNoun: 'Run',
    routeNounPlural: 'Runs',
    serviceTypes: [
      { value: 'exterior_wash', label: 'Exterior Wash' },
      { value: 'full_valet', label: 'Full Valet' },
      { value: 'interior_detail', label: 'Interior Detail' },
      { value: 'ceramic_coating', label: 'Ceramic Coating' },
    ],
    terms: {
      job: 'Valet',
      jobPlural: 'Valets',
      worker: 'Valeter',
    },
  },

  pest_control: {
    key: 'pest_control',
    label: 'Pest Control',
    icon: '🐀',
    accent: '#B45309',
    routeNoun: 'Call sheet',
    routeNounPlural: 'Call sheets',
    serviceTypes: [
      { value: 'inspection', label: 'Inspection' },
      { value: 'treatment', label: 'Treatment' },
      { value: 'proofing', label: 'Proofing' },
      { value: 'monitoring', label: 'Monitoring Visit' },
    ],
    terms: {
      job: 'Treatment',
      jobPlural: 'Treatments',
      worker: 'Technician',
    },
  },
};

// Generic fallbacks for any term a vertical doesn't override.
const BASE_TERMS = {
  job: 'Job',
  jobPlural: 'Jobs',
  worker: 'Worker',
  customer: 'Customer',
  customerPlural: 'Customers',
};

// Selectable list for signup / settings pickers.
export const BUSINESS_TYPE_OPTIONS = Object.values(VERTICALS).map((v) => ({
  value: v.key,
  label: v.label,
  icon: v.icon,
}));

// Resolve a vertical config, always returning a usable object with fully
// populated `terms` (merged over the base terms).
export function getVertical(businessType) {
  const vertical = VERTICALS[businessType] || VERTICALS[DEFAULT_BUSINESS_TYPE];
  return {
    ...vertical,
    terms: { ...BASE_TERMS, ...vertical.terms },
  };
}
