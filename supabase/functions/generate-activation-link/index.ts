const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getAppOrigin(redirectTo?: string) {
  try {
    return new URL(redirectTo || 'https://mekloc-saas.vercel.app').origin;
  } catch {
    return 'https://mekloc-saas.vercel.app';
  }
}

function randomToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 28);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Session admin manquante.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const projectUrl = Deno.env.get('PROJECT_URL') || '';
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (!projectUrl || !serviceRole || !anonKey) throw new Error('PROJECT_URL, SERVICE_ROLE_KEY or ANON_KEY missing');

    const { email, redirectTo } = (await req.json()) as { email?: string; redirectTo?: string };
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) throw new Error('Email requis');
    const appOrigin = getAppOrigin(redirectTo);

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

    const buildLink = async (type: 'recovery' | 'invite') => {
      const res = await fetch(`${projectUrl}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          email: normalized,
          ...(redirectTo ? { redirect_to: redirectTo } : {}),
        }),
      });
      const txt = await res.text();
      return { res, txt };
    };

    const createShortLink = async () => {
      const profileRes = await fetch(`${projectUrl}/rest/v1/users_profiles?email=ilike.${encodeURIComponent(normalized)}&select=agency_id,role&limit=1`, {
        headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
      });
      const profiles = profileRes.ok ? await profileRes.json() as Array<{ agency_id: string | null; role: string | null }> : [];
      const token = randomToken();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const insertRes = await fetch(`${projectUrl}/rest/v1/activation_links`, {
        method: 'POST',
        headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          token,
          email: normalized,
          agency_id: profiles?.[0]?.agency_id || null,
          role: profiles?.[0]?.role || 'owner',
          expires_at: expiresAt,
        }]),
      });
      if (!insertRes.ok) throw new Error(await insertRes.text());
      return `${appOrigin}/set-password?token=${encodeURIComponent(token)}`;
    };

    const { res: genRes, txt } = await buildLink('recovery');
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
        if (!createUserRes.ok && !createUserText.toLowerCase().includes('already')) {
          throw new Error(createUserText || 'Création utilisateur Auth impossible');
        }

        // 2) Retry recovery link generation
        const retry = await buildLink('recovery');
        if (retry.res.ok) {
          const retryData = JSON.parse(retry.txt) as { action_link?: string; properties?: { action_link?: string } };
          const retryLink = retryData?.action_link || retryData?.properties?.action_link || '';
          if (!retryLink) throw new Error('Lien non généré après création user');
          const shortLink = await createShortLink();
          return new Response(JSON.stringify({ success: true, activationLink: shortLink }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // 3) Final fallback: invite link (also creates user in many setups)
        const inviteTry = await buildLink('invite');
        if (inviteTry.res.ok) {
          const inviteData = JSON.parse(inviteTry.txt) as { action_link?: string; properties?: { action_link?: string } };
          const inviteLink = inviteData?.action_link || inviteData?.properties?.action_link || '';
          if (!inviteLink) throw new Error('Lien invitation non généré');
          const shortLink = await createShortLink();
          return new Response(JSON.stringify({ success: true, activationLink: shortLink }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        throw new Error(retry.txt || inviteTry.txt || txt);
      }
      throw new Error(txt);
    }
    const data = JSON.parse(txt) as { action_link?: string; properties?: { action_link?: string } };
    const link = data?.action_link || data?.properties?.action_link || '';
    if (!link) throw new Error('Lien non généré');
    const shortLink = await createShortLink();

    return new Response(JSON.stringify({ success: true, activationLink: shortLink }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
