export const MEKLOC_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 199,
    annualPrice: 2390,
    monthlyLabel: '199 MAD /mois',
    annualLabel: '2 390 MAD /an',
    annualBillingLabel: 'Facturé 2 390 MAD/an',
  },
  business: {
    id: 'business',
    name: 'Business',
    monthlyPrice: 319,
    annualPrice: 3830,
    monthlyLabel: '319 MAD /mois',
    annualLabel: '3 830 MAD /an',
    annualBillingLabel: 'Facturé 3 830 MAD/an',
  },
} as const;

export type MekLocPlanId = keyof typeof MEKLOC_PLANS;

export const MEKLOC_PLAN_LIST = [MEKLOC_PLANS.starter, MEKLOC_PLANS.business] as const;
