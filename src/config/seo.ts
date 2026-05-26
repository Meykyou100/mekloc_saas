export const SITE_NAME = 'MekLoc';
export const SITE_URL = 'https://mekloc.com';
export const DEFAULT_TITLE = 'MekLoc – Logiciel de gestion pour agences de location de voitures au Maroc';
export const DEFAULT_DESCRIPTION =
  'MekLoc aide les agences de location de voitures au Maroc à gérer réservations, véhicules, clients, contrats PDF, paiements et entretien depuis une seule plateforme.';
export const DEFAULT_KEYWORDS = [
  'logiciel location voiture Maroc',
  'logiciel gestion location voiture',
  'SaaS location voiture Maroc',
  'gestion flotte location voiture',
  'contrat location voiture PDF Maroc',
  'application location voiture Maroc',
  'agence location voiture Maroc',
];
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
export const DEFAULT_LOGO = `${SITE_URL}/mekloc-logo-dark.png`;

export function absoluteUrl(path = '/') {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
