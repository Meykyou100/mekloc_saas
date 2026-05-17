const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

type ProfileRow = {
  id: string;
  agency_id: string | null;
  account_status: string | null;
  email: string | null;
};

type AgencyRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
};

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const projectUrl = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL') || '';
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const internalKey = req.headers.get('x-internal-key') || '';
    if (!projectUrl || !serviceRole || !anonKey) throw new Error('Configuration Supabase manquante.');
    if (internalKey !== anonKey) return json({ error: 'Unauthorized' }, 401);

    const { email } = await req.json() as { email?: string };
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !isEmail(normalizedEmail)) {
      return json({ found: false });
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
    if (!profile?.agency_id) return json({ found: false });

    const agencyRes = await fetch(`${projectUrl}/rest/v1/agencies?id=eq.${encodeURIComponent(profile.agency_id)}&select=id,name,phone,email&limit=1`, {
      headers: serviceHeaders,
    });
    if (!agencyRes.ok) throw new Error(await agencyRes.text());
    const agencyRows = await agencyRes.json() as AgencyRow[];
    const agency = agencyRows?.[0] || null;

    return json({
      found: true,
      email: normalizedEmail,
      accountStatus: profile.account_status || 'pending',
      agencyName: agency?.name || 'votre agence',
      agencyPhone: agency?.phone || '',
      agencyEmail: agency?.email || '',
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Vérification impossible.' }, 400);
  }
});
