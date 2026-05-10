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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const projectUrl = Deno.env.get('PROJECT_URL') || '';
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || '';
    if (!projectUrl || !serviceRole) throw new Error('PROJECT_URL or SERVICE_ROLE_KEY missing');

    const { agencyId } = (await req.json()) as { agencyId?: string };
    if (!agencyId) throw new Error('agencyId required');

    const adminHeaders = {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
    };

    const profilesRes = await fetch(
      `${projectUrl}/rest/v1/users_profiles?agency_id=eq.${encodeURIComponent(agencyId)}&select=id,email`,
      { method: 'GET', headers: adminHeaders },
    );
    const profiles = profilesRes.ok ? ((await profilesRes.json()) as Array<{ id: string; email: string | null }>) : [];

    for (const table of ['payments', 'contracts', 'reservations', 'maintenance', 'clients', 'vehicles', 'users_profiles']) {
      await fetch(`${projectUrl}/rest/v1/${table}?agency_id=eq.${encodeURIComponent(agencyId)}`, {
        method: 'DELETE',
        headers: adminHeaders,
      });
    }

    await fetch(`${projectUrl}/rest/v1/agencies?id=eq.${encodeURIComponent(agencyId)}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });

    // Remove auth users tied to the deleted agency profiles.
    for (const p of profiles) {
      await fetch(`${projectUrl}/auth/v1/admin/users/${p.id}`, {
        method: 'DELETE',
        headers: adminHeaders,
      });
    }

    return new Response(JSON.stringify({ success: true, deletedAuthUsers: profiles.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

