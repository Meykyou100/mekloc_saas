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

function normalizePlan(rawPlan: string): 'starter' | 'pro' | 'business' {
  const value = rawPlan.trim().toLowerCase();
  if (value === 'pro') return 'pro';
  if (value === 'business') return 'business';
  if (value === 'gratuit' || value === 'free' || value === 'starter') return 'starter';
  return 'starter';
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
    activationLink = `${getAppOrigin(redirectTo)}/set-password?token=${encodeURIComponent(shortToken)}`;

    return new Response(JSON.stringify({ success: true, inviteInfo, activationLink, agencyId, profileId: approvedUserId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
