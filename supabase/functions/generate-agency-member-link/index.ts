const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AgencyRole = 'owner' | 'manager' | 'agent' | 'accountant';

type ProfileRow = {
  id: string;
  agency_id: string | null;
  role: string | null;
  account_status: string | null;
  is_super_admin: boolean | null;
  full_name?: string | null;
  email?: string | null;
};

function normalizeRole(rawRole: unknown): AgencyRole {
  const value = String(rawRole || '').trim().toLowerCase();
  if (value === 'owner' || value === 'admin') return 'owner';
  if (value === 'manager') return 'manager';
  if (value === 'accountant') return 'accountant';
  return 'agent';
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractUserId(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const obj = payload as Record<string, unknown>;
  const direct = typeof obj.id === 'string' ? obj.id : '';
  if (direct) return direct;
  const user = obj.user && typeof obj.user === 'object' ? obj.user as Record<string, unknown> : null;
  if (typeof user?.id === 'string') return user.id;
  const data = obj.data && typeof obj.data === 'object' ? obj.data as Record<string, unknown> : null;
  const dataUser = data?.user && typeof data.user === 'object' ? data.user as Record<string, unknown> : null;
  if (typeof dataUser?.id === 'string') return dataUser.id;
  return '';
}

function randomToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 28);
}

function getAppOrigin(redirectTo?: string) {
  try {
    return new URL(redirectTo || 'https://mekloc-saas.vercel.app').origin;
  } catch {
    return 'https://mekloc-saas.vercel.app';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Session manquante.' }, 401);

    const projectUrl = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL') || '';
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (!projectUrl || !serviceRole || !anonKey) throw new Error('Configuration Supabase manquante.');

    const { memberId, email, redirectTo } = await req.json() as { memberId?: string; email?: string; redirectTo?: string };
    if (!memberId && !email) throw new Error('memberId ou email requis.');

    const serviceHeaders = {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
    };

    const userRes = await fetch(`${projectUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authHeader },
    });
    if (!userRes.ok) return json({ error: 'Session invalide.' }, 401);
    const authUser = await userRes.json() as { id?: string };
    if (!authUser.id) return json({ error: 'Utilisateur introuvable.' }, 401);

    const callerRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,agency_id,role,account_status,is_super_admin&limit=1`, {
      headers: serviceHeaders,
    });
    const callerRows = await callerRes.json() as ProfileRow[];
    const caller = callerRows?.[0];
    const callerRole = normalizeRole(caller?.role);
    if (!caller?.agency_id || caller.account_status !== 'active') return json({ error: 'Compte agence inactif.' }, 403);
    if (!caller.is_super_admin && callerRole !== 'owner' && callerRole !== 'manager') return json({ error: 'Accès refusé.' }, 403);

    const targetFilter = memberId
      ? `id=eq.${encodeURIComponent(memberId)}`
      : `email=eq.${encodeURIComponent(String(email || '').trim().toLowerCase())}`;
    const targetRes = await fetch(`${projectUrl}/rest/v1/users_profiles?${targetFilter}&select=id,agency_id,role,account_status,is_super_admin,full_name,email&limit=1`, {
      headers: serviceHeaders,
    });
    const targetRows = await targetRes.json() as ProfileRow[];
    const target = targetRows?.[0];
    if (!target) return json({ error: 'Utilisateur introuvable dans cette agence.' }, 404);
    if (target.agency_id !== caller.agency_id) return json({ error: 'Cet utilisateur ne fait pas partie de votre agence.' }, 403);
    if (target.is_super_admin) return json({ error: 'Impossible de générer un lien pour un super admin.' }, 403);
    if (normalizeRole(target.role) === 'owner' && callerRole !== 'owner' && !caller.is_super_admin) {
      return json({ error: 'Seul un propriétaire peut gérer un propriétaire.' }, 403);
    }

    const normalizedEmail = String(target.email || email || '').trim().toLowerCase();
    if (!normalizedEmail) throw new Error('Email membre introuvable.');
    const createShortLink = async () => {
      const token = randomToken();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const insertRes = await fetch(`${projectUrl}/rest/v1/activation_links`, {
        method: 'POST',
        headers: serviceHeaders,
        body: JSON.stringify([{
          token,
          email: normalizedEmail,
          agency_id: target.agency_id,
          role: normalizeRole(target.role),
          expires_at: expiresAt,
        }]),
      });
      if (!insertRes.ok) throw new Error(await insertRes.text());
      return `${getAppOrigin(redirectTo)}/set-password?token=${encodeURIComponent(token)}`;
    };

    const buildLink = async (type: 'recovery' | 'invite') => {
      const res = await fetch(`${projectUrl}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: serviceHeaders,
        body: JSON.stringify({
          type,
          email: normalizedEmail,
          ...(redirectTo ? { redirect_to: redirectTo } : {}),
        }),
      });
      const text = await res.text();
      return { res, text };
    };

    const parseActivationLink = (text: string) => {
      const payload = JSON.parse(text) as { action_link?: string; properties?: { action_link?: string }; user?: { id?: string } };
      return {
        activationLink: payload.action_link || payload.properties?.action_link || '',
        userId: extractUserId(payload),
      };
    };

    const first = await buildLink('recovery');
    if (first.res.ok) {
      const parsed = parseActivationLink(first.text);
      if (!parsed.activationLink) throw new Error('Lien non généré.');
      return json({ success: true, activationLink: await createShortLink(), email: normalizedEmail });
    }

    if (first.text.includes('user_not_found')) {
      const createRes = await fetch(`${projectUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: serviceHeaders,
        body: JSON.stringify({
          email: normalizedEmail,
          email_confirm: true,
          user_metadata: {
            agency_id: caller.agency_id,
            full_name: target.full_name || '',
            role: normalizeRole(target.role),
            source: 'mekloc-team-generate-link',
          },
        }),
      });
      const createText = await createRes.text();
      if (!createRes.ok && !/already|exist|registered/i.test(createText)) {
        throw new Error(createText || 'Création utilisateur Auth impossible.');
      }

      const createdUserId = createRes.ok ? extractUserId(JSON.parse(createText)) : '';
      if (createdUserId && createdUserId !== target.id) {
        await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(target.id)}`, {
          method: 'PATCH',
          headers: serviceHeaders,
          body: JSON.stringify({ id: createdUserId }),
        });
      }

      const retry = await buildLink('recovery');
      if (retry.res.ok) {
        const parsed = parseActivationLink(retry.text);
        if (!parsed.activationLink) throw new Error('Lien non généré après création utilisateur.');
        return json({ success: true, activationLink: await createShortLink(), email: normalizedEmail, memberId: createdUserId || target.id });
      }

      const invite = await buildLink('invite');
      if (invite.res.ok) {
        const parsed = parseActivationLink(invite.text);
        if (!parsed.activationLink) throw new Error('Lien invitation non généré.');
        return json({ success: true, activationLink: await createShortLink(), email: normalizedEmail, memberId: createdUserId || target.id });
      }

      throw new Error(retry.text || invite.text || first.text);
    }

    const inviteFallback = await buildLink('invite');
    if (inviteFallback.res.ok) {
      const parsed = parseActivationLink(inviteFallback.text);
      if (!parsed.activationLink) throw new Error('Lien invitation non généré.');
      return json({ success: true, activationLink: await createShortLink(), email: normalizedEmail });
    }

    throw new Error(first.text || inviteFallback.text || 'Génération du lien impossible.');
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Génération du lien impossible.' }, 400);
  }
});
