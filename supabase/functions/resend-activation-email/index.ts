const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function randomToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 28);
}

function getAppOrigin(redirectTo?: string) {
  const configuredOrigin = Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('APP_URL') || 'https://mekloc.com';
  try {
    return new URL(redirectTo || configuredOrigin).origin;
  } catch {
    return 'https://mekloc.com';
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatPlanName(plan: string) {
  const value = plan.trim().toLowerCase();
  if (value === 'business') return 'Business';
  if (value === 'pro') return 'Pro';
  return 'Starter';
}

function buildApprovalEmail(params: {
  activationLink: string;
  agencyName: string;
  email: string;
  ownerName: string;
  plan: string;
  redirectTo?: string;
}) {
  const cleanSiteUrl = getAppOrigin(params.redirectTo).replace(/\/$/, '');
  const logoUrl = Deno.env.get('EMAIL_LOGO_URL') || `${cleanSiteUrl}/mekloc-logo-dark.png`;
  const safeActivationLink = escapeHtml(params.activationLink);
  const safeAgencyName = escapeHtml(params.agencyName || 'Agence MekLoc');
  const safeEmail = escapeHtml(params.email);
  const safeGreetingName = escapeHtml(params.ownerName || params.agencyName || 'Bonjour');
  const safePlanName = escapeHtml(formatPlanName(params.plan));
  const safeLogoUrl = escapeHtml(logoUrl);

  const text = [
    'Votre accès MekLoc est prêt',
    '',
    `Bonjour ${params.ownerName || params.agencyName || ''},`,
    'Votre demande d’accès à MekLoc a été validée. Vous pouvez maintenant créer votre mot de passe et accéder à votre espace.',
    '',
    `Créer mon mot de passe : ${params.activationLink}`,
    '',
    `Plan sélectionné : ${formatPlanName(params.plan)}`,
    `Agence : ${params.agencyName}`,
    `Email : ${params.email}`,
    '',
    'Pour votre sécurité, ce lien est personnel. Ne le partagez avec personne.',
    '',
    'Besoin d’aide ? Contactez-nous à contact@mekloc.com',
    '© MekLoc — Gestion location automobile',
  ].join('\n');

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>Votre accès MekLoc est prêt</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f4ef;font-family:Arial,Helvetica,sans-serif;color:#151515;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Votre espace MekLoc a été validé. Créez votre mot de passe pour commencer.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f4ef;margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:28px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid #eadfbd;border-radius:22px;overflow:hidden;">
            <tr>
              <td style="background:#070807;padding:26px 28px;text-align:center;">
                <img src="${safeLogoUrl}" width="190" alt="MekLoc" style="display:block;margin:0 auto;max-width:190px;width:190px;height:auto;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td style="padding:34px 30px 12px;text-align:center;">
                <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:#fff7db;border:1px solid #efd47a;color:#a87400;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">
                  Accès validé
                </div>
                <h1 style="margin:18px 0 10px;font-size:30px;line-height:1.16;color:#151515;font-weight:800;">
                  Votre accès MekLoc est prêt
                </h1>
                <p style="margin:0 auto;max-width:500px;font-size:16px;line-height:1.65;color:#4b5563;">
                  Bonjour ${safeGreetingName},<br>
                  Votre demande d’accès à MekLoc a été validée. Vous pouvez maintenant créer votre mot de passe et accéder à votre espace.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 30px 28px;">
                <a href="${safeActivationLink}" style="display:inline-block;background:#e3b117;color:#111111;text-decoration:none;font-size:16px;font-weight:800;padding:15px 24px;border-radius:14px;border:1px solid #c9950c;">
                  Créer mon mot de passe
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 26px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fffaf0;border:1px solid #f0dfaa;border-radius:16px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 10px;color:#8a6409;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Informations d’activation</p>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="padding:7px 0;color:#6b7280;font-size:14px;">Plan sélectionné</td>
                          <td align="right" style="padding:7px 0;color:#111827;font-size:14px;font-weight:700;">${safePlanName}</td>
                        </tr>
                        <tr>
                          <td style="padding:7px 0;color:#6b7280;font-size:14px;">Agence</td>
                          <td align="right" style="padding:7px 0;color:#111827;font-size:14px;font-weight:700;">${safeAgencyName}</td>
                        </tr>
                        <tr>
                          <td style="padding:7px 0;color:#6b7280;font-size:14px;">Email</td>
                          <td align="right" style="padding:7px 0;color:#111827;font-size:14px;font-weight:700;">${safeEmail}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:16px;">
                  <tr>
                    <td style="padding:16px 18px;color:#4b5563;font-size:14px;line-height:1.55;">
                      <strong style="color:#111827;">Note de sécurité :</strong>
                      Pour votre sécurité, ce lien est personnel. Ne le partagez avec personne.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 30px;background:#fafafa;border-top:1px solid #eeeeee;text-align:center;">
                <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.5;">
                  Besoin d’aide ? Contactez-nous à
                  <a href="mailto:contact@mekloc.com" style="color:#a87400;text-decoration:none;font-weight:700;">contact@mekloc.com</a>
                </p>
                <p style="margin:0;color:#9ca3af;font-size:12px;">
                  © MekLoc — Gestion location automobile
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, text };
}

async function sendApprovalEmail(params: {
  activationLink: string;
  agencyName: string;
  email: string;
  ownerName: string;
  plan: string;
  redirectTo?: string;
}) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY missing');

  const email = buildApprovalEmail(params);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM_EMAIL') || 'MekLoc <contact@mekloc.com>',
      to: [params.email],
      subject: 'Votre accès MekLoc est prêt',
      html: email.html,
      text: email.text,
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    console.error('resend-activation-email resend failed', { status: response.status, body });
    throw new Error(`Email non envoyé (${response.status})`);
  }
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

    const { accessRequestId, agencyId, email: rawEmail, redirectTo } = (await req.json()) as {
      accessRequestId?: string;
      agencyId?: string;
      email?: string;
      redirectTo?: string;
    };
    const requestedEmail = String(rawEmail || '').trim().toLowerCase();
    if (!accessRequestId && !agencyId && !requestedEmail) throw new Error('accessRequestId, agencyId or email required');

    const serviceHeaders = {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
    };

    const userRes = await fetch(`${projectUrl}/auth/v1/user`, {
      method: 'GET',
      headers: { apikey: anonKey, Authorization: authHeader },
    });
    if (!userRes.ok) throw new Error('Session admin invalide.');
    const authUser = await userRes.json() as { id?: string };
    if (!authUser?.id) throw new Error('Utilisateur admin introuvable.');

    const adminCheckRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(authUser.id)}&select=is_super_admin&limit=1`, { headers: serviceHeaders });
    const adminRows = await adminCheckRes.json() as Array<{ is_super_admin: boolean }>;
    if (!adminRows?.[0]?.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Accès refusé. Super admin requis.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let accessRequest: Record<string, unknown> | null = null;
    if (accessRequestId) {
      const requestRes = await fetch(`${projectUrl}/rest/v1/access_requests?id=eq.${encodeURIComponent(accessRequestId)}&select=*`, { headers: serviceHeaders });
      if (!requestRes.ok) throw new Error(await requestRes.text());
      const requestRows = await requestRes.json() as Array<Record<string, unknown>>;
      accessRequest = requestRows?.[0] || null;
      if (!accessRequest) throw new Error('Demande introuvable.');
      if (String(accessRequest.status || '') !== 'approved') throw new Error('La demande doit être approuvée avant de renvoyer l’email.');
    }

    let email = String(accessRequest?.email || requestedEmail || '').trim().toLowerCase();
    let agencyName = String(accessRequest?.agency_name || 'Agence MekLoc');
    let ownerName = String(accessRequest?.owner_name || 'Responsable');
    let plan = String(accessRequest?.selected_plan || 'starter');
    if (!email) throw new Error('Email introuvable.');

    if (!accessRequest && agencyId) {
      const agencyRes = await fetch(`${projectUrl}/rest/v1/agencies?id=eq.${encodeURIComponent(agencyId)}&select=id,name,plan&limit=1`, { headers: serviceHeaders });
      if (!agencyRes.ok) throw new Error(await agencyRes.text());
      const agencies = await agencyRes.json() as Array<{ id: string; name: string | null; plan: string | null }>;
      const agency = agencies?.[0];
      if (!agency) throw new Error('Agence introuvable.');
      agencyName = agency.name || agencyName;
      plan = agency.plan || plan;
    }

    const profileQuery = agencyId
      ? `agency_id=eq.${encodeURIComponent(agencyId)}`
      : `email=ilike.${encodeURIComponent(email)}`;
    const profileRes = await fetch(`${projectUrl}/rest/v1/users_profiles?${profileQuery}&select=agency_id,role,email,full_name&order=created_at.asc&limit=20`, { headers: serviceHeaders });
    const profiles = profileRes.ok ? await profileRes.json() as Array<{ agency_id: string | null; role: string | null; email: string | null; full_name: string | null }> : [];
    const ownerProfile =
      profiles.find((profile) => String(profile.role || '').toLowerCase() === 'owner' && profile.email) ||
      profiles.find((profile) => profile.email) ||
      profiles[0];
    if (ownerProfile?.email) email = ownerProfile.email.trim().toLowerCase();
    if (ownerProfile?.full_name) ownerName = ownerProfile.full_name;

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const insertRes = await fetch(`${projectUrl}/rest/v1/activation_links`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify([{
        token,
        email,
        agency_id: ownerProfile?.agency_id || agencyId || null,
        role: ownerProfile?.role || 'owner',
        expires_at: expiresAt,
      }]),
    });
    if (!insertRes.ok) throw new Error(`Erreur création lien court: ${await insertRes.text()}`);

    const activationLink = `${getAppOrigin(redirectTo)}/activation/${encodeURIComponent(token)}`;

    await sendApprovalEmail({
      activationLink,
      agencyName,
      email,
      ownerName,
      plan,
      redirectTo,
    });

    if (accessRequestId) {
      await fetch(`${projectUrl}/rest/v1/access_requests?id=eq.${encodeURIComponent(accessRequestId)}`, {
        method: 'PATCH',
        headers: serviceHeaders,
        body: JSON.stringify({ activation_link: activationLink }),
      });
    }

    console.log('resend-activation-email sent', { email, accessRequestId: accessRequestId || null, agencyId: agencyId || null });
    return new Response(JSON.stringify({ success: true, emailSent: true, activationLink }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('resend-activation-email failed', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Email d’activation non envoyé.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
