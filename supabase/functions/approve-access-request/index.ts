const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

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

function normalizePlan(rawPlan: string): 'starter' | 'pro' | 'business' | 'lifetime' {
  const value = rawPlan.trim().toLowerCase();
  if (value === 'lifetime' || value === 'life_time' || value === 'à vie' || value === 'a vie') return 'lifetime';
  if (value === 'pro') return 'pro';
  if (value === 'business') return 'business';
  if (value === 'gratuit' || value === 'free' || value === 'starter') return 'starter';
  return 'starter';
}

function getCleanSiteUrl(redirectTo?: string) {
  return getAppOrigin(redirectTo).replace(/\/$/, '');
}

function getFromEmail() {
  return Deno.env.get('RESEND_FROM_EMAIL') || 'MekLoc <contact@mekloc.com>';
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
  if (value === 'lifetime') return 'Lifetime';
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
  const cleanSiteUrl = getCleanSiteUrl(params.redirectTo);
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
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('Approval email skipped: RESEND_API_KEY missing');
    return { sent: false, error: 'missing_resend_api_key' };
  }

  const email = buildApprovalEmail(params);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getFromEmail(),
        to: [params.email],
        subject: 'Votre accès MekLoc est prêt',
        html: email.html,
        text: email.text,
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      console.error('Approval email failed', { status: response.status, body });
      return { sent: false, error: `resend_${response.status}` };
    }
    console.log('Approval email sent', { to: params.email });
    return { sent: true };
  } catch (error) {
    console.error('Approval email error', error);
    return { sent: false, error: error instanceof Error ? error.message : 'email_send_failed' };
  }
}

async function generateActivationLink(params: {
  projectUrl: string;
  serviceRole: string;
  email: string;
  redirectTo?: string;
}): Promise<{ activationLink: string; userId: string }> {
  const { projectUrl, serviceRole, email, redirectTo } = params;
  const headers = { apikey: serviceRole, Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' };

  const extractUserId = (payload: unknown): string => {
    if (!payload || typeof payload !== 'object') return '';
    const obj = payload as Record<string, unknown>;
    const directUser = obj.user && typeof obj.user === 'object' ? obj.user as Record<string, unknown> : null;
    if (typeof directUser?.id === 'string') return directUser.id;
    const data = obj.data && typeof obj.data === 'object' ? obj.data as Record<string, unknown> : null;
    const dataUser = data?.user && typeof data.user === 'object' ? data.user as Record<string, unknown> : null;
    if (typeof dataUser?.id === 'string') return dataUser.id;
    if (typeof obj.id === 'string') return obj.id;
    return '';
  };

  const requestLink = async (type: 'recovery' | 'invite') => {
    const res = await fetch(`${projectUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type,
        email,
        ...(redirectTo ? { redirect_to: redirectTo } : {}),
      }),
    });
    const txt = await res.text();
    return { res, txt };
  };

  // First try recovery for existing users
  const first = await requestLink('recovery');
  if (first.res.ok) {
    const data = JSON.parse(first.txt) as { action_link?: string; properties?: { action_link?: string } };
    return { activationLink: data?.action_link || data?.properties?.action_link || '', userId: extractUserId(data) };
  }

  // If user does not exist, create Auth user then retry recovery
  if (first.txt.includes('user_not_found')) {
    const createRes = await fetch(`${projectUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        email_confirm: true,
        user_metadata: { source: 'mekloc-approve-access-request' },
      }),
    });
    const createTxt = await createRes.text();
    let createdUserId = '';
    if (!createRes.ok && !createTxt.toLowerCase().includes('already')) {
      throw new Error(createTxt || 'Création utilisateur Auth impossible');
    }
    if (createRes.ok) {
      createdUserId = extractUserId(JSON.parse(createTxt));
    }

    const retry = await requestLink('recovery');
    if (retry.res.ok) {
      const data = JSON.parse(retry.txt) as { action_link?: string; properties?: { action_link?: string } };
      return { activationLink: data?.action_link || data?.properties?.action_link || '', userId: extractUserId(data) || createdUserId };
    }

    // Last fallback
    const inviteFallback = await requestLink('invite');
    if (inviteFallback.res.ok) {
      const data = JSON.parse(inviteFallback.txt) as { action_link?: string; properties?: { action_link?: string } };
      return { activationLink: data?.action_link || data?.properties?.action_link || '', userId: extractUserId(data) || createdUserId };
    }

    throw new Error(retry.txt || inviteFallback.txt || first.txt);
  }

  // If user exists but recovery flow failed, try invite link
  const invite = await requestLink('invite');
  if (invite.res.ok) {
    const data = JSON.parse(invite.txt) as { action_link?: string; properties?: { action_link?: string } };
    return { activationLink: data?.action_link || data?.properties?.action_link || '', userId: extractUserId(data) };
  }

  throw new Error(first.txt || invite.txt || 'Génération du lien impossible');
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

    const { accessRequestId, redirectTo } = (await req.json()) as { accessRequestId?: string; redirectTo?: string };
    if (!accessRequestId) throw new Error('accessRequestId required');

    const headers = {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
    };

    // Validate caller and ensure only super admin can approve.
    const userRes = await fetch(`${projectUrl}/auth/v1/user`, {
      method: 'GET',
      headers: { apikey: anonKey, Authorization: authHeader },
    });
    if (!userRes.ok) throw new Error('Session admin invalide.');
    const authUser = await userRes.json() as { id?: string };
    const adminUserId = authUser?.id;
    if (!adminUserId) throw new Error('Utilisateur admin introuvable.');

    const adminCheckRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(adminUserId)}&select=is_super_admin&limit=1`, { headers });
    const adminCheckRows = await adminCheckRes.json() as Array<{ is_super_admin: boolean }>;
    if (!adminCheckRows?.[0]?.is_super_admin) {
      return new Response(JSON.stringify({ error: 'Accès refusé. Super admin requis.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const reqRes = await fetch(`${projectUrl}/rest/v1/access_requests?id=eq.${encodeURIComponent(accessRequestId)}&select=*`, { headers });
    const reqRows = (await reqRes.json()) as Array<Record<string, unknown>>;
    const row = reqRows?.[0];
    if (!row) throw new Error('Demande introuvable');

    const email = String(row.email || '').trim().toLowerCase();
    const agencyName = String(row.agency_name || 'Agence MekLoc');
    const ownerName = String(row.owner_name || 'Responsable');
    const plan = normalizePlan(String(row.selected_plan || 'starter'));
    const billingType = String(row.billing_type || 'monthly');
    const monthlyPriceByPlan: Record<typeof plan, number> = { starter: 199, pro: 599, business: 399, lifetime: 5999 };
    const annualPriceByPlan: Record<typeof plan, number> = { starter: 1910, pro: 5750, business: 3830, lifetime: 5999 };
    const phone = `${String(row.phone_country_code || '+212')} ${String(row.phone_number || '')}`.trim();
    const today = new Date();
    const startDate = today.toISOString().slice(0, 10);
    const nextDue = new Date(today);
    nextDue.setDate(nextDue.getDate() + 30);
    const nextDueDate = nextDue.toISOString().slice(0, 10);

    let activationLink = '';
    let inviteInfo = 'activation_link_generated';
    let approvedUserId = '';
    try {
      const activation = await generateActivationLink({
        projectUrl,
        serviceRole,
        email,
        redirectTo,
      });
      activationLink = activation.activationLink;
      approvedUserId = activation.userId;
      if (!activationLink) inviteInfo = 'email_failed';
    } catch {
      inviteInfo = 'email_failed';
    }
    if (!approvedUserId) throw new Error('Utilisateur Auth introuvable pour cette demande approuvée.');

    const legacyProfileRes = await fetch(`${projectUrl}/rest/v1/users_profiles?email=ilike.${encodeURIComponent(email)}&select=id,agency_id&limit=1`, { headers });
    const legacyProfile = (await legacyProfileRes.json()) as Array<{ id: string; agency_id: string | null }>;
    let agencyId = legacyProfile?.[0]?.agency_id || '';

    if (!agencyId) {
      const agencyLookupRes = await fetch(`${projectUrl}/rest/v1/agencies?name=ilike.${encodeURIComponent(agencyName)}&select=id,name&order=created_at.desc&limit=1`, { headers });
      const agencyLookup = (await agencyLookupRes.json()) as Array<{ id: string }>;
      agencyId = agencyLookup?.[0]?.id || '';
    }

    if (!agencyId) {
      const createAgencyRes = await fetch(`${projectUrl}/rest/v1/agencies`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify([{
          name: agencyName,
          slug: `${slugify(agencyName)}-${Date.now().toString().slice(-5)}`,
          created_by: approvedUserId,
          plan,
          billing_status: 'trial',
          subscription_start_date: startDate,
          next_payment_due_date: nextDueDate,
          billing_type: billingType,
          monthly_price: monthlyPriceByPlan[plan],
          annual_price: annualPriceByPlan[plan],
        }]),
      });
      const createAgencyText = await createAgencyRes.text();
      if (!createAgencyRes.ok) {
        throw new Error(`Erreur création agence: ${createAgencyText}`);
      }
      const createdAgency = JSON.parse(createAgencyText) as Array<{ id: string }>;
      agencyId = createdAgency?.[0]?.id;
      if (!agencyId) throw new Error('Création agence impossible');
    } else {
      const updateAgencyRes = await fetch(`${projectUrl}/rest/v1/agencies?id=eq.${encodeURIComponent(agencyId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          plan,
          billing_status: 'trial',
          next_payment_due_date: nextDueDate,
          billing_type: billingType,
          monthly_price: monthlyPriceByPlan[plan],
          annual_price: annualPriceByPlan[plan],
        }),
      });
      if (!updateAgencyRes.ok) {
        const txt = await updateAgencyRes.text();
        throw new Error(`Erreur mise à jour agence: ${txt}`);
      }
    }

    const profilePayload = {
      id: approvedUserId,
      agency_id: agencyId,
      full_name: ownerName,
      email,
      phone,
      role: 'owner',
      account_status: 'active',
      is_super_admin: false,
    };

    const profileByIdRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(approvedUserId)}&select=id&limit=1`, { headers });
    const profileById = (await profileByIdRes.json()) as Array<{ id: string }>;
    const legacyProfileId = legacyProfile?.[0]?.id || '';
    if (profileById?.[0]?.id) {
      const updateProfileRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(approvedUserId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(profilePayload),
      });
      if (!updateProfileRes.ok) throw new Error(`Erreur mise à jour profil: ${await updateProfileRes.text()}`);
    } else if (legacyProfileId && legacyProfileId !== approvedUserId) {
      const deleteLegacyRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(legacyProfileId)}`, {
        method: 'DELETE',
        headers,
      });
      if (!deleteLegacyRes.ok) throw new Error(`Erreur suppression ancien profil: ${await deleteLegacyRes.text()}`);
      const insertProfileRes = await fetch(`${projectUrl}/rest/v1/users_profiles`, {
        method: 'POST',
        headers,
        body: JSON.stringify([profilePayload]),
      });
      if (!insertProfileRes.ok) throw new Error(`Erreur création profil: ${await insertProfileRes.text()}`);
    } else {
      const insertProfileRes = await fetch(`${projectUrl}/rest/v1/users_profiles`, {
        method: 'POST',
        headers,
        body: JSON.stringify([profilePayload]),
      });
      if (!insertProfileRes.ok) throw new Error(`Erreur création profil: ${await insertProfileRes.text()}`);
    }

    await fetch(`${projectUrl}/rest/v1/access_requests?id=eq.${encodeURIComponent(accessRequestId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved' }),
    });

    const shortToken = randomToken();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const shortInsertRes = await fetch(`${projectUrl}/rest/v1/activation_links`, {
      method: 'POST',
      headers,
      body: JSON.stringify([{
        token: shortToken,
        email,
        agency_id: agencyId,
        role: 'owner',
        expires_at: expiresAt,
      }]),
    });
    if (!shortInsertRes.ok) throw new Error(`Erreur création lien court: ${await shortInsertRes.text()}`);
    activationLink = `${getCleanSiteUrl(redirectTo)}/activation/${encodeURIComponent(shortToken)}`;

    const approvalEmail = await sendApprovalEmail({
      activationLink,
      agencyName,
      email,
      ownerName,
      plan,
      redirectTo,
    });
    inviteInfo = approvalEmail.sent ? 'activation_email_sent' : 'email_failed';

    return new Response(JSON.stringify({
      success: true,
      inviteInfo,
      emailSent: approvalEmail.sent,
      ...(approvalEmail.error ? { emailError: approvalEmail.error } : {}),
      activationLink,
      agencyId,
      profileId: approvedUserId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
