export const defaultCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const buckets = new Map<string, number[]>();

export function json(corsHeaders: Record<string, string>, payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function getClientIp(req: Request) {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function sanitizeText(value: unknown, maxLength = 500) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const since = now - windowMs;
  const hits = (buckets.get(key) || []).filter((timestamp) => timestamp > since);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

export function getSupabaseConfig() {
  const projectUrl = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL') || '';
  const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!projectUrl || !serviceRole || !anonKey) {
    throw new Error('Configuration Supabase manquante.');
  }
  return { projectUrl, serviceRole, anonKey };
}

export function serviceHeaders(serviceRole: string) {
  return {
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
    'Content-Type': 'application/json',
  };
}

export async function getAuthUser(projectUrl: string, anonKey: string, authHeader: string) {
  if (!authHeader.startsWith('Bearer ')) return null;
  const userRes = await fetch(`${projectUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authHeader },
  });
  if (!userRes.ok) return null;
  const authUser = await userRes.json() as { id?: string };
  return authUser.id ? authUser : null;
}

export async function getCallerProfile(projectUrl: string, serviceRole: string, userId: string) {
  const res = await fetch(
    `${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(userId)}&select=id,agency_id,role,account_status,is_super_admin&limit=1`,
    { headers: serviceHeaders(serviceRole) },
  );
  if (!res.ok) return null;
  const rows = await res.json() as Array<{
    id: string;
    agency_id: string | null;
    role: string | null;
    account_status: string | null;
    is_super_admin: boolean | null;
  }>;
  return rows?.[0] || null;
}

export async function requireSuperAdmin(req: Request) {
  const { projectUrl, serviceRole, anonKey } = getSupabaseConfig();
  const authUser = await getAuthUser(projectUrl, anonKey, req.headers.get('Authorization') || '');
  if (!authUser?.id) return { ok: false as const, status: 401, error: 'Session admin manquante.' };
  const profile = await getCallerProfile(projectUrl, serviceRole, authUser.id);
  if (!profile?.is_super_admin) return { ok: false as const, status: 403, error: 'Accès refusé.' };
  return { ok: true as const, projectUrl, serviceRole, anonKey, authUser };
}
