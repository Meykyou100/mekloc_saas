const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Session admin manquante.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const internalKey = req.headers.get('x-internal-key') || '';
    const anonKey = Deno.env.get('ANON_KEY') || '';
    if (!anonKey || internalKey !== anonKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const projectUrl = Deno.env.get('PROJECT_URL') || '';
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || '';
    if (!projectUrl || !serviceRole) throw new Error('PROJECT_URL or SERVICE_ROLE_KEY missing');

    const { email, redirectTo } = (await req.json()) as { email?: string; redirectTo?: string };
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) throw new Error('Email requis');

    const userRes = await fetch(`${projectUrl}/auth/v1/user`, {
      method: 'GET',
      headers: { apikey: anonKey, Authorization: authHeader },
    });
    if (!userRes.ok) throw new Error('Session admin invalide.');
    const authUser = await userRes.json() as { id?: string };
    const adminUserId = authUser?.id;
    if (!adminUserId) throw new Error('Utilisateur admin introuvable.');

    const adminCheckRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(adminUserId)}&select=is_super_admin&limit=1`, {
      headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
    });
    const rows = await adminCheckRes.json() as Array<{ is_super_admin: boolean }>;
    if (!rows?.[0]?.is_super_admin) return new Response(JSON.stringify({ error: 'Accès refusé' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const genRes = await fetch(`${projectUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'recovery',
        email: normalized,
        ...(redirectTo ? { redirect_to: redirectTo } : {}),
      }),
    });
    const txt = await genRes.text();
    if (!genRes.ok) {
      if (txt.includes('user_not_found')) {
        // 1) Ensure Auth user exists (create if missing)
        const createUserRes = await fetch(`${projectUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalized,
            email_confirm: true,
            user_metadata: { source: 'mekloc-super-admin-activation' },
          }),
        });
        const createUserText = await createUserRes.text();
        if (!createUserRes.ok && !createUserText.includes('already')) {
          throw new Error(createUserText || 'Création utilisateur Auth impossible');
        }

        // 2) Retry activation link generation after creation
        const retryRes = await fetch(`${projectUrl}/auth/v1/admin/generate_link`, {
          method: 'POST',
          headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'recovery',
            email: normalized,
            ...(redirectTo ? { redirect_to: redirectTo } : {}),
          }),
        });
        const retryTxt = await retryRes.text();
        if (!retryRes.ok) throw new Error(retryTxt || 'Génération du lien impossible après création user');
        const retryData = JSON.parse(retryTxt) as { action_link?: string; properties?: { action_link?: string } };
        const retryLink = retryData?.action_link || retryData?.properties?.action_link || '';
        if (!retryLink) throw new Error('Lien non généré après création user');
        return new Response(JSON.stringify({ success: true, activationLink: retryLink }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(txt);
    }
    const data = JSON.parse(txt) as { action_link?: string; properties?: { action_link?: string } };
    const link = data?.action_link || data?.properties?.action_link || '';
    if (!link) throw new Error('Lien non généré');

    return new Response(JSON.stringify({ success: true, activationLink: link }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
