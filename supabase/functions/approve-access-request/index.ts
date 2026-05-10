const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const internalKey = req.headers.get('x-internal-key') || '';
    const anonKey = Deno.env.get('ANON_KEY') || '';
    if (!anonKey || internalKey !== anonKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const projectUrl = Deno.env.get('PROJECT_URL') || '';
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || '';
    if (!projectUrl || !serviceRole) throw new Error('PROJECT_URL or SERVICE_ROLE_KEY missing');

    const { accessRequestId, redirectTo } = (await req.json()) as { accessRequestId?: string; redirectTo?: string };
    if (!accessRequestId) throw new Error('accessRequestId required');

    const headers = {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
    };

    const reqRes = await fetch(`${projectUrl}/rest/v1/access_requests?id=eq.${encodeURIComponent(accessRequestId)}&select=*`, { headers });
    const reqRows = (await reqRes.json()) as Array<Record<string, unknown>>;
    const row = reqRows?.[0];
    if (!row) throw new Error('Demande introuvable');

    const email = String(row.email || '').trim().toLowerCase();
    const agencyName = String(row.agency_name || 'Agence MekLoc');
    const ownerName = String(row.owner_name || 'Responsable');
    const plan = String(row.selected_plan || 'starter');
    const billingType = String(row.billing_type || 'monthly');
    const phone = `${String(row.phone_country_code || '+212')} ${String(row.phone_number || '')}`.trim();
    const today = new Date();
    const startDate = today.toISOString().slice(0, 10);
    const nextDue = new Date(today);
    nextDue.setDate(nextDue.getDate() + 30);
    const nextDueDate = nextDue.toISOString().slice(0, 10);

    const agencyLookupRes = await fetch(`${projectUrl}/rest/v1/agencies?owner_email=eq.${encodeURIComponent(email)}&select=id,name&limit=1`, { headers });
    const agencyLookup = (await agencyLookupRes.json()) as Array<{ id: string }>;
    let agencyId = agencyLookup?.[0]?.id;

    if (!agencyId) {
      const createAgencyRes = await fetch(`${projectUrl}/rest/v1/agencies`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify([{
          name: agencyName,
          slug: `${slugify(agencyName)}-${Date.now().toString().slice(-5)}`,
          owner_email: email,
          phone,
          country: String(row.country || 'Maroc'),
          city: String(row.city || ''),
          address: String(row.address || ''),
          plan,
          billing_type: billingType,
          billing_status: 'trial',
          account_status: 'active',
          subscription_start_date: startDate,
          subscription_end_date: nextDueDate,
          next_payment_due_date: nextDueDate,
        }]),
      });
      const createdAgency = (await createAgencyRes.json()) as Array<{ id: string }>;
      agencyId = createdAgency?.[0]?.id;
      if (!agencyId) throw new Error('Création agence impossible');
    } else {
      await fetch(`${projectUrl}/rest/v1/agencies?id=eq.${encodeURIComponent(agencyId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          owner_email: email,
          plan,
          billing_type: billingType,
          billing_status: 'trial',
          account_status: 'active',
          next_payment_due_date: nextDueDate,
        }),
      });
    }

    const profileLookupRes = await fetch(`${projectUrl}/rest/v1/users_profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`, { headers });
    const profileLookup = (await profileLookupRes.json()) as Array<{ id: string }>;
    if (profileLookup?.[0]?.id) {
      await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(profileLookup[0].id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ agency_id: agencyId, full_name: ownerName, account_status: 'active', is_super_admin: false }),
      });
    } else {
      await fetch(`${projectUrl}/rest/v1/users_profiles`, {
        method: 'POST',
        headers,
        body: JSON.stringify([{ email, agency_id: agencyId, full_name: ownerName, role: 'Admin', account_status: 'active', is_super_admin: false }]),
      });
    }

    await fetch(`${projectUrl}/rest/v1/access_requests?id=eq.${encodeURIComponent(accessRequestId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved' }),
    });

    const inviteRes = await fetch(`${projectUrl}/auth/v1/invite`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, data: { agency_id: agencyId }, ...(redirectTo ? { redirect_to: redirectTo } : {}) }),
    });
    let activationLink = '';
    let inviteInfo = 'invite_sent';
    if (!inviteRes.ok) {
      const txt = await inviteRes.text();
      if (txt.includes('email_exists')) {
        const recoverRes = await fetch(`${projectUrl}/auth/v1/recover`, {
          method: 'POST',
          headers: { apikey: anonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, ...(redirectTo ? { redirect_to: redirectTo } : {}) }),
        });
        if (!recoverRes.ok) {
          const recoverText = await recoverRes.text();
          throw new Error(`Activation email impossible: ${recoverText}`);
        }
        inviteInfo = 'recover_sent';
      } else {
        throw new Error(`Activation email impossible: ${txt}`);
      }
    } else {
      const inviteJson = await inviteRes.json() as { action_link?: string };
      activationLink = inviteJson.action_link || '';
    }

    return new Response(JSON.stringify({ success: true, inviteInfo, activationLink }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

