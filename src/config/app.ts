export const APP_URL =
  import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://mekloc.com');

export const PUBLIC_SITE_URL =
  import.meta.env.VITE_PUBLIC_SITE_URL || APP_URL;

export const SUPPORT_EMAIL = 'contact@mekloc.com';
export const SUPPORT_PHONE = '+212762971653';
export const SUPPORT_PHONE_DISPLAY = '+212 762-971653';
export const WHATSAPP_URL = 'https://wa.me/212762971653';
