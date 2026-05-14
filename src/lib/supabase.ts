import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function isValidSupabaseUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

function isSafeBrowserKey(value: string | undefined) {
  if (!value) return false;
  return !value.startsWith('sb_secret_');
}

export const isSupabaseConfigured = isValidSupabaseUrl(supabaseUrl) && isSafeBrowserKey(supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const storageBuckets = {
  logos: 'logos',
  contracts: 'contract-pdfs',
  vehicleImages: 'vehicle-images',
} as const;
