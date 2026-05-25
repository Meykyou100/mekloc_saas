// Supabase Edge Function: check-login-email
// Public-safe login pre-check. Returns only a coarse status.
// Deploy with: supabase functions deploy check-login-email

const allowedOrigins = new Set([
  'https://mekloc.com',
  'https://www.mekloc.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
]);

const rateBuckets = new Map<string, number[]>();

type LoginEmailStatus = 'not_found' | 'pending' | 'active' | 'suspended';

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) || origin.includes('localhost') || origin.includes('127.0.0.1') ? origin || '*' : 'https://mekloc.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(req: Request, payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function clientIp(req: Request) {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((timestamp) => timestamp > now - windowMs);
  if (hits.length >= limit) {
    rateBuckets.set(key, hits);
    return false;
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  return true;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeStatus(value: string | null | undefined): LoginEmailStatus {
  const status = String(value || '').toLowerCase();
  if (status === 'active' || status === 'approved') return 'active';
  if (status === 'suspended' || status === 'pending_deletion' || status === 'rejected') return 'suspended';
  if (['pending', 'pending_verification', 'contacted', 'payment_pending', 'verified'].includes(status)) return 'pending';
  return 'not_found';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { status: 'not_found' }, 200);

  try {
    const projectUrl = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL') || '';
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!projectUrl || !serviceRole) throw new Error('Configuration Supabase manquante.');

    const body = await req.json().catch(() => null) as { email?: string } | null;
    const email = String(body?.email || '').trim().toLowerCase();
    const ip = clientIp(req);

    if (!checkRateLimit(`ip:${ip}`, 40, 10 * 60 * 1000) || !checkRateLimit(`email:${email}`, 12, 10 * 60 * 1000)) {
      return json(req, { status: 'not_found' }, 200);
    }
    if (!email || !isEmail(email)) return json(req, { status: 'not_found' }, 200);

    const headers = {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
    };

    const profileRes = await fetch(
      `${projectUrl}/rest/v1/users_profiles?select=account_status,agency_id,email&email=ilike.${encodeURIComponent(email)}&limit=1`,
      { headers },
    );
    if (!profileRes.ok) throw new Error(await profileRes.text());
    const profiles = await profileRes.json() as Array<{ account_status?: string | null; agency_id?: string | null; email?: string | null }>;
    const profile = profiles?.[0] || null;
    if (profile) {
      if (!profile.agency_id) return json(req, { status: 'pending' }, 200);
      return json(req, { status: normalizeStatus(profile.account_status) }, 200);
    }

    const accessRes = await fetch(
      `${projectUrl}/rest/v1/access_requests?select=status,email,created_at&email=ilike.${encodeURIComponent(email)}&order=created_at.desc&limit=1`,
      { headers },
    );
    if (!accessRes.ok) throw new Error(await accessRes.text());
    const requests = await accessRes.json() as Array<{ status?: string | null }>;
    const accessRequest = requests?.[0] || null;
    if (accessRequest) return json(req, { status: normalizeStatus(accessRequest.status) }, 200);

    return json(req, { status: 'not_found' }, 200);
  } catch (error) {
    console.error('check-login-email failed', error);
    return json(req, { status: 'not_found' }, 200);
  }
});
