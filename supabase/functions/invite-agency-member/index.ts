const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

type AgencyRole = 'owner' | 'manager' | 'agent' | 'accountant';

type CallerProfile = {
  id: string;
  agency_id: string | null;
  role: string | null;
  account_status: string | null;
  is_super_admin: boolean | null;
};

type ExistingProfile = {
  id: string;
  agency_id: string | null;
  account_status: string | null;
  role: string | null;
};

function normalizeRole(rawRole: unknown): AgencyRole {
  const value = String(rawRole || '').trim().toLowerCase();
  if (value === 'owner' || value === 'admin') return 'owner';
  if (value === 'manager') return 'manager';
  if (value === 'accountant') return 'accountant';
  return 'agent';
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Session manquante.' }, 401);

    const projectUrl = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL') || '';
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const internalKey = req.headers.get('x-internal-key') || '';
    if (!projectUrl || !serviceRole || !anonKey) throw new Error('Configuration Supabase manquante.');
    if (internalKey !== anonKey) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json() as { email?: string; fullName?: string; role?: string; redirectTo?: string };
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.fullName || '').trim().slice(0, 100);
    const role = normalizeRole(body.role);
    const redirectTo = String(body.redirectTo || '').trim();
    if (!email || !isEmail(email)) throw new Error('Email invalide.');

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
    const callerRows = await callerRes.json() as CallerProfile[];
    const caller = callerRows?.[0];
    const callerRole = normalizeRole(caller?.role);
    if (!caller?.agency_id || caller.account_status !== 'active') return json({ error: 'Compte agence inactif.' }, 403);
    if (!caller.is_super_admin && callerRole !== 'owner' && callerRole !== 'manager') return json({ error: 'Accès refusé.' }, 403);
    if (role === 'owner' && callerRole !== 'owner' && !caller.is_super_admin) return json({ error: 'Seul un propriétaire peut inviter un autre propriétaire.' }, 403);

    const profileLookupRes = await fetch(`${projectUrl}/rest/v1/users_profiles?email=eq.${encodeURIComponent(email)}&select=id,agency_id,account_status,role&limit=1`, {
      headers: serviceHeaders,
    });
    const existingProfiles = await profileLookupRes.json() as ExistingProfile[];
    const existingProfile = existingProfiles?.[0] || null;
    if (existingProfile?.agency_id && existingProfile.agency_id !== caller.agency_id) {
      return json({ error: 'Cet email est déjà lié à une autre agence.' }, 409);
    }
    if (existingProfile && normalizeRole(existingProfile.role) === 'owner' && callerRole !== 'owner' && !caller.is_super_admin) {
      return json({ error: 'Seul un propriétaire peut gérer un propriétaire.' }, 403);
    }

    const generateLink = async (type: 'invite' | 'recovery') => {
      const res = await fetch(`${projectUrl}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: serviceHeaders,
        body: JSON.stringify({
          type,
          email,
          ...(redirectTo ? { redirect_to: redirectTo } : {}),
        }),
      });
      const text = await res.text();
      if (!res.ok) return { ok: false, text, activationLink: '', userId: '' };
      const payload = JSON.parse(text) as Record<string, unknown>;
      const properties = payload.properties && typeof payload.properties === 'object' ? payload.properties as Record<string, unknown> : null;
      return {
        ok: true,
        text,
        activationLink: String(payload.action_link || properties?.action_link || ''),
        userId: extractUserId(payload),
      };
    };

    const sendRecoveryEmail = async () => {
      const res = await fetch(`${projectUrl}/auth/v1/recover`, {
        method: 'POST',
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          ...(redirectTo ? { redirect_to: redirectTo } : {}),
        }),
      });
      return res.ok;
    };

    let authUserId = existingProfile?.id || '';
    let inviteSent = false;
    let activationLink = '';

    if (!authUserId) {
      const inviteRes = await fetch(`${projectUrl}/auth/v1/invite`, {
        method: 'POST',
        headers: serviceHeaders,
        body: JSON.stringify({
          email,
          data: { agency_id: caller.agency_id, full_name: fullName, role },
          ...(redirectTo ? { redirect_to: redirectTo } : {}),
        }),
      });
      const inviteText = await inviteRes.text();
      if (inviteRes.ok) {
        inviteSent = true;
        authUserId = extractUserId(JSON.parse(inviteText));
      } else if (/already|exist|registered/i.test(inviteText)) {
        const link = await generateLink('recovery');
        activationLink = link.activationLink;
        authUserId = link.userId;
        inviteSent = await sendRecoveryEmail();
      } else {
        const createRes = await fetch(`${projectUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: serviceHeaders,
          body: JSON.stringify({
            email,
            email_confirm: true,
            user_metadata: { agency_id: caller.agency_id, full_name: fullName, role, source: 'mekloc-team-invite' },
          }),
        });
        const createText = await createRes.text();
        if (!createRes.ok && !/already|exist|registered/i.test(createText)) throw new Error(inviteText || createText);
        authUserId = createRes.ok ? extractUserId(JSON.parse(createText)) : '';
        const link = await generateLink('recovery');
        activationLink = link.activationLink;
        authUserId = authUserId || link.userId;
      }
    } else {
      const link = await generateLink('recovery');
      activationLink = link.activationLink;
      inviteSent = await sendRecoveryEmail();
    }

    if (!authUserId) throw new Error('Utilisateur Auth introuvable pour cette invitation.');

    const nextStatus = existingProfile?.account_status === 'suspended' ? 'suspended' : 'active';
    const profilePayload: Record<string, unknown> = {
      agency_id: caller.agency_id,
      email,
      role,
      account_status: nextStatus,
      is_super_admin: false,
    };
    if (fullName) profilePayload.full_name = fullName;

    if (existingProfile) {
      const updateRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(existingProfile.id)}`, {
        method: 'PATCH',
        headers: serviceHeaders,
        body: JSON.stringify(profilePayload),
      });
      if (!updateRes.ok) throw new Error(await updateRes.text());
    } else {
      const insertRes = await fetch(`${projectUrl}/rest/v1/users_profiles`, {
        method: 'POST',
        headers: { ...serviceHeaders, Prefer: 'return=representation' },
        body: JSON.stringify([{ id: authUserId, ...profilePayload, full_name: fullName || email.split('@')[0] }]),
      });
      if (!insertRes.ok) throw new Error(await insertRes.text());
    }

    return json({ success: true, inviteSent, activationLink });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invitation impossible.' }, 400);
  }
});
