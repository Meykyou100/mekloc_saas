const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const internalKey = req.headers.get('x-internal-key') || '';
    const anonKey = Deno.env.get('ANON_KEY') || '';
    if (!anonKey || internalKey !== anonKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = Deno.env.get('PROJECT_URL')!;
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY')!;
    const body = await req.json();
    const { email, agencyId, redirectTo } = body as { email: string; agencyId: string; redirectTo?: string };
    if (!email || !agencyId) throw new Error('email and agencyId required');

    const normalized = email.trim().toLowerCase();
    const adminRes = await fetch(`${url}/auth/v1/invite`, {
      method: 'POST',
      headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalized,
        data: { agency_id: agencyId },
        ...(redirectTo ? { redirect_to: redirectTo } : {}),
      }),
    });
    if (!adminRes.ok) {
      const text = await adminRes.text();
      if (text.includes('email_exists')) {
        const recoverRes = await fetch(`${url}/auth/v1/recover`, {
          method: 'POST',
          headers: { apikey: anonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalized,
            ...(redirectTo ? { redirect_to: redirectTo } : {}),
          }),
        });
        if (!recoverRes.ok) {
          const recoverText = await recoverRes.text();
          return new Response(JSON.stringify({ error: recoverText }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ success: true, info: 'password_recovery_sent' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: text }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
