export const MEKLOC_ALL_FEATURES = [
  'Réservations et calendrier',
  'Gestion des clients et documents',
  'Gestion complète des véhicules',
  'Contrats PDF personnalisés',
  'Paiements, cautions et restes à payer',
  'Entretien et échéances véhicules',
  'Rapports et statistiques',
  'Alertes et rappels',
  'Accès équipe et rôles',
  'Support prioritaire',
] as const;

export const MEKLOC_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 199,
    annualPrice: 1910,
    monthlyLabel: '199 MAD /mois',
    annualLabel: '1 910 MAD /an',
    annualBillingLabel: 'Facturé 1 910 MAD/an',
    note: 'Pour démarrer simplement',
    features: ['Jusqu’à 7 véhicules', 'Réservations et calendrier', 'Clients et documents', 'Contrats PDF', 'Paiements et cautions', 'Entretien essentiel', 'Support standard'],
  },
  business: {
    id: 'business',
    name: 'Business',
    monthlyPrice: 399,
    annualPrice: 3830,
    monthlyLabel: '399 MAD /mois',
    annualLabel: '3 830 MAD /an',
    annualBillingLabel: 'Facturé 3 830 MAD/an',
    note: 'Pour les agences en croissance',
    features: ['Jusqu’à 20 véhicules', 'Toutes les fonctions Starter', 'Rapports et tableaux de bord', 'Alertes et rappels automatiques', 'Entretien avancé', 'Contrats illimités', 'Support prioritaire'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 599,
    annualPrice: 5750,
    monthlyLabel: '599 MAD /mois',
    annualLabel: '5 750 MAD /an',
    annualBillingLabel: 'Facturé 5 750 MAD/an',
    note: 'Pour une agence sans limites',
    features: ['Véhicules et réservations illimités', 'Toutes les fonctions Business', 'Équipe multi-utilisateurs', 'Rapports financiers avancés', 'Suivi complet des paiements', 'Automatisations', 'Support prioritaire'],
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
    note: 'Toutes les fonctionnalités à vie',
    features: ['Accès à vie MekLoc', 'Toutes les fonctionnalités', 'Véhicules et utilisateurs illimités', 'Mises à jour incluses', 'Support prioritaire à vie'],
  },
} as const;

export type MekLocPlanId = keyof typeof MEKLOC_PLANS;
export const MEKLOC_PLAN_LIST = [MEKLOC_PLANS.starter, MEKLOC_PLANS.business, MEKLOC_PLANS.pro, MEKLOC_PLANS.lifetime] as const;
