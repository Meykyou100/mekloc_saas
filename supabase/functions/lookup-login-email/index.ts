const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ProfileRow = {
  id: string;
  agency_id: string | null;
  account_status: string | null;
  email: string | null;
};

const rateBuckets = new Map<string, number[]>();

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

function genericLookupResponse() {
  return {
    found: true,
    email: '',
    accountStatus: 'pending',
    agencyName: 'votre agence',
    agencyPhone: '',
    agencyEmail: '',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const projectUrl = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL') || '';
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!projectUrl || !serviceRole) throw new Error('Configuration Supabase manquante.');

    const { email } = await req.json() as { email?: string };
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const ip = clientIp(req);
    if (!checkRateLimit(`ip:${ip}`, 20, 10 * 60 * 1000) || !checkRateLimit(`email:${normalizedEmail}`, 5, 10 * 60 * 1000)) {
      return json(genericLookupResponse(), 200);
    }
    if (!normalizedEmail || !isEmail(normalizedEmail)) {
      return json(genericLookupResponse(), 200);
    }

    const serviceHeaders = {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
    };

    const profileRes = await fetch(`${projectUrl}/rest/v1/users_profiles?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,agency_id,account_status,email&limit=1`, {
      headers: serviceHeaders,
    });
    if (!profileRes.ok) throw new Error(await profileRes.text());
    const profileRows = await profileRes.json() as ProfileRow[];
    const profile = profileRows?.[0] || null;
    if (!profile?.agency_id || profile.account_status === 'active') return json(genericLookupResponse(), 200);

    return json({ ...genericLookupResponse(), accountStatus: profile.account_status || 'pending' }, 200);
  } catch (error) {
    console.error('lookup-login-email failed', error);
    return json(genericLookupResponse(), 200);
  }
});
