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
  lifetime: {
    id: 'lifetime',
    name: 'Lifetime',
    monthlyPrice: 0,
    annualPrice: 5999,
    lifetimePrice: 5999,
    monthlyLabel: '5 999 MAD à vie',
    annualLabel: '5 999 MAD à vie',
    annualBillingLabel: 'Paiement unique 5 999 MAD',
  },
} as const;

export type MekLocPlanId = keyof typeof MEKLOC_PLANS;

export const MEKLOC_PLAN_LIST = [MEKLOC_PLANS.starter, MEKLOC_PLANS.business, MEKLOC_PLANS.lifetime] as const;
