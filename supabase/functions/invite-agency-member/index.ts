const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AgencyRole = 'owner' | 'manager' | 'agent' | 'accountant';

type CallerProfile = {
  id: string;
  agency_id: string | null;
  role: string | null;
  account_status: string | null;
  is_super_admin: boolean | null;
  full_name?: string | null;
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

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
}

function roleLabel(role: AgencyRole) {
  if (role === 'owner') return 'Propriétaire';
  if (role === 'manager') return 'Manager';
  if (role === 'accountant') return 'Comptable';
  return 'Agent';
}

function appOrigin(redirectTo: string) {
  try {
    const url = new URL(redirectTo);
    return url.origin;
  } catch {
    return 'https://mekloc.com';
  }
}

function createToken() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

function buildTeamInviteEmail(params: { activationLink: string; agencyName: string; inviteeName: string; inviterName: string; role: AgencyRole; origin: string }) {
  const agencyName = escapeHtml(params.agencyName || 'votre agence');
  const inviteeName = escapeHtml(params.inviteeName || 'Bonjour');
  const inviterName = escapeHtml(params.inviterName || 'Votre administrateur');
  const role = escapeHtml(roleLabel(params.role));
  const activationLink = escapeHtml(params.activationLink);
  const logoUrl = escapeHtml(Deno.env.get('EMAIL_LOGO_URL') || `${params.origin}/mekloc-logo-dark.png`);
  const text = `Bonjour ${params.inviteeName || ''},\n\n${params.inviterName || 'Votre administrateur'} vous invite à rejoindre ${params.agencyName} sur MekLoc comme ${roleLabel(params.role)}.\n\nCréez votre mot de passe : ${params.activationLink}\n\nCe lien est personnel et expire dans 48 heures.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f6f4ef;font-family:Arial,Helvetica,sans-serif;color:#151515"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #eadfbd;border-radius:22px;overflow:hidden"><tr><td align="center" style="padding:24px;background:#090a0b"><img src="${logoUrl}" alt="MekLoc" width="170" style="display:block;border:0;max-width:170px"></td></tr><tr><td style="padding:32px 30px 12px"><p style="margin:0;color:#9b7207;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">Invitation d’équipe</p><h1 style="margin:14px 0 10px;font-size:28px;line-height:1.2">Bienvenue chez ${agencyName}</h1><p style="margin:0;color:#4b5563;font-size:16px;line-height:1.65">Bonjour ${inviteeName},<br><strong style="color:#151515">${inviterName}</strong> vous a ajouté à l’équipe de <strong style="color:#151515">${agencyName}</strong> sur MekLoc.</p></td></tr><tr><td style="padding:18px 30px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff9e8;border:1px solid #efd47a;border-radius:16px"><tr><td style="padding:16px 18px"><p style="margin:0 0 7px;color:#8a6409;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em">Votre accès</p><p style="margin:0;color:#6b7280;font-size:14px">Agence <strong style="color:#151515">${agencyName}</strong></p><p style="margin:8px 0 0;color:#6b7280;font-size:14px">Rôle <strong style="color:#151515">${role}</strong></p></td></tr></table></td></tr><tr><td align="center" style="padding:12px 30px 30px"><a href="${activationLink}" style="display:inline-block;background:#e3b117;color:#111;text-decoration:none;font-weight:800;font-size:16px;padding:15px 24px;border-radius:14px">Créer mon mot de passe</a><p style="margin:18px 0 0;color:#6b7280;font-size:13px;line-height:1.5">Ce lien est personnel et expire dans 48 heures. Ne le partagez avec personne.</p></td></tr><tr><td style="padding:20px 30px;background:#fafafa;border-top:1px solid #eee;text-align:center;color:#9ca3af;font-size:12px">© MekLoc — Gestion location automobile</td></tr></table></td></tr></table></body></html>`;
  return { html, text };
}

async function sendTeamInviteEmail(params: { activationLink: string; agencyName: string; inviteeName: string; inviterName: string; role: AgencyRole; email: string; origin: string }) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('Configuration email MekLoc manquante.');
  const email = buildTeamInviteEmail(params);
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: Deno.env.get('RESEND_FROM_EMAIL') || 'MekLoc <contact@mekloc.com>', to: [params.email], subject: `Invitation MekLoc · ${params.agencyName}`, html: email.html, text: email.text }) });
  if (!response.ok) throw new Error(`Email d’invitation non envoyé (${response.status}).`);
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

    const body = await req.json() as { action?: 'invite' | 'generate_link'; email?: string; fullName?: string; role?: string; redirectTo?: string };
    const action = body.action || 'invite';
    const linkOnly = action === 'generate_link';
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

    const callerRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,agency_id,role,account_status,is_super_admin,full_name&limit=1`, {
      headers: serviceHeaders,
    });
    const callerRows = await callerRes.json() as CallerProfile[];
    const caller = callerRows?.[0];
    const callerRole = normalizeRole(caller?.role);
    if (!caller?.agency_id || caller.account_status !== 'active') return json({ error: 'Compte agence inactif.' }, 403);
    if (!caller.is_super_admin && callerRole !== 'owner' && callerRole !== 'manager') return json({ error: 'Accès refusé.' }, 403);
    if (role === 'owner' && callerRole !== 'owner' && !caller.is_super_admin) return json({ error: 'Seul un propriétaire peut inviter un autre propriétaire.' }, 403);

    const agencyRes = await fetch(`${projectUrl}/rest/v1/agencies?id=eq.${encodeURIComponent(caller.agency_id)}&select=name&limit=1`, { headers: serviceHeaders });
    const agencyRows = agencyRes.ok ? await agencyRes.json() as Array<{ name?: string | null }> : [];
    const agencyName = String(agencyRows?.[0]?.name || 'Votre agence').trim();
    const inviterName = String(caller.full_name || 'Votre administrateur').trim();

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

    const generateUsableActivationLink = async () => {
      const recovery = await generateLink('recovery');
      if (recovery.activationLink) return recovery;

      const invite = await generateLink('invite');
      if (invite.activationLink) return invite;

      throw new Error(recovery.text || invite.text || 'Lien activation non généré.');
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

    if (linkOnly) {
      if (!authUserId) {
        const createRes = await fetch(`${projectUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: serviceHeaders,
          body: JSON.stringify({
            email,
            email_confirm: true,
            user_metadata: { agency_id: caller.agency_id, full_name: fullName, role, source: 'mekloc-team-link' },
          }),
        });
        const createText = await createRes.text();
        if (!createRes.ok && !/already|exist|registered/i.test(createText)) throw new Error(createText);
        authUserId = createRes.ok ? extractUserId(JSON.parse(createText)) : '';
      }
      const link = await generateUsableActivationLink();
      activationLink = link.activationLink;
      authUserId = authUserId || link.userId;
      inviteSent = false;
    } else {
      // Team invitations use a MekLoc-branded email and a short activation link,
      // rather than the generic Supabase invite email.
      if (!authUserId) {
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
        if (!createRes.ok && !/already|exist|registered/i.test(createText)) throw new Error(createText || 'Création utilisateur impossible.');
        authUserId = createRes.ok ? extractUserId(JSON.parse(createText)) : '';
        if (!authUserId) {
          const link = await generateUsableActivationLink();
          authUserId = link.userId;
        }
      }
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

    if (!linkOnly) {
      const token = createToken();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const linkRes = await fetch(`${projectUrl}/rest/v1/activation_links`, {
        method: 'POST',
        headers: serviceHeaders,
        body: JSON.stringify([{ token, email, agency_id: caller.agency_id, role, expires_at: expiresAt }]),
      });
      if (!linkRes.ok) throw new Error(await linkRes.text());
      activationLink = `${appOrigin(redirectTo)}/activation/${encodeURIComponent(token)}`;
      await sendTeamInviteEmail({ activationLink, agencyName, inviteeName: fullName || email.split('@')[0], inviterName, role, email, origin: appOrigin(redirectTo) });
      inviteSent = true;
    }

    return json({ success: true, inviteSent, activationLink });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invitation impossible.' }, 400);
  }
});
