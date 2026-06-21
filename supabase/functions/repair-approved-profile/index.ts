import { defaultCorsHeaders as corsHeaders, getAuthUser, getSupabaseConfig, json, serviceHeaders } from '../_shared/security.ts';

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'agence';
}

function normalizePlan(rawPlan: unknown): 'starter' | 'pro' | 'business' | 'lifetime' {
  const value = String(rawPlan || '').trim().toLowerCase();
  if (value === 'lifetime' || value === 'life_time') return 'lifetime';
  if (value === 'pro') return 'pro';
  if (value === 'business') return 'business';
  return 'starter';
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

async function readRows<T>(res: Response): Promise<T[]> {
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return text ? JSON.parse(text) as T[] : [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { projectUrl, serviceRole, anonKey } = getSupabaseConfig();
    const authUser = await getAuthUser(projectUrl, anonKey, req.headers.get('Authorization') || '');
    const userId = authUser?.id || '';
    const email = normalizeEmail((authUser as { email?: string } | null)?.email);
    if (!userId || !email) {
      console.log('repair-approved-profile: missing auth user');
      return json(corsHeaders, { success: false, error: 'Session utilisateur introuvable.' }, 401);
    }

    const headers = serviceHeaders(serviceRole);
    console.log('repair-approved-profile: start', { userId, email });

    const requestRes = await fetch(
      `${projectUrl}/rest/v1/access_requests?select=*&status=eq.approved&order=created_at.desc&limit=1&email=ilike.${encodeURIComponent(email)}`,
      { headers },
    );
    const requestRows = await readRows<Record<string, unknown>>(requestRes);
    const accessRequest = requestRows?.[0];
    if (!accessRequest) {
      console.log('repair-approved-profile: approved request not found', { userId, email });
      return json(corsHeaders, { success: false, error: 'Demande approuvée introuvable.' }, 404);
    }

    const agencyName = String(accessRequest.agency_name || accessRequest.company_name || 'Agence MekLoc').trim() || 'Agence MekLoc';
    const ownerName = String(accessRequest.owner_name || accessRequest.full_name || email).trim() || email;
    const phone = `${String(accessRequest.phone_country_code || '+212')} ${String(accessRequest.phone_number || '')}`.trim();
    console.log('repair-approved-profile: approved request found', { userId, email, agencyName });

    const profileByIdRes = await fetch(
      `${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(userId)}&select=id,agency_id,email,account_status&limit=1`,
      { headers },
    );
    const profileById = (await readRows<{ id: string; agency_id: string | null; email: string | null; account_status: string | null }>(profileByIdRes))?.[0];

    const legacyProfileRes = await fetch(
      `${projectUrl}/rest/v1/users_profiles?email=ilike.${encodeURIComponent(email)}&select=id,agency_id,email,account_status&limit=1`,
      { headers },
    );
    const legacyProfile = (await readRows<{ id: string; agency_id: string | null; email: string | null; account_status: string | null }>(legacyProfileRes))?.[0];

    let agencyId = profileById?.agency_id || legacyProfile?.agency_id || '';
    if (!agencyId) {
      const agencyByNameRes = await fetch(
        `${projectUrl}/rest/v1/agencies?name=ilike.${encodeURIComponent(agencyName)}&select=id,name&order=created_at.desc&limit=1`,
        { headers },
      );
      const agencyByName = (await readRows<{ id: string; name: string }>(agencyByNameRes))?.[0];
      agencyId = agencyByName?.id || '';
      if (agencyId) console.log('repair-approved-profile: agency found by name', { userId, agencyId });
    }

    if (!agencyId) {
      const today = new Date();
      const nextDue = new Date(today);
      nextDue.setDate(nextDue.getDate() + 30);
      const plan = normalizePlan(accessRequest.selected_plan);
      const monthlyPriceByPlan: Record<typeof plan, number> = { starter: 2394, pro: 3588, business: 5988, lifetime: 9999 };
      const annualPriceByPlan: Record<typeof plan, number> = { starter: 1910, pro: 5750, business: 3830, lifetime: 5999 };
      const createAgencyRes = await fetch(`${projectUrl}/rest/v1/agencies`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify([{
          name: agencyName,
          slug: `${slugify(agencyName)}-${Date.now().toString().slice(-5)}`,
          created_by: userId,
          plan,
          billing_status: 'trial',
          subscription_start_date: today.toISOString().slice(0, 10),
          next_payment_due_date: nextDue.toISOString().slice(0, 10),
          billing_type: String(accessRequest.billing_type || (plan === 'lifetime' ? 'lifetime' : 'monthly')),
          monthly_price: monthlyPriceByPlan[plan],
          annual_price: annualPriceByPlan[plan],
        }]),
      });
      const createdAgency = await readRows<{ id: string }>(createAgencyRes);
      agencyId = createdAgency?.[0]?.id || '';
      console.log('repair-approved-profile: agency created', { userId, agencyId });
    }

    if (!agencyId) throw new Error('Agence introuvable.');

    const profilePayload = {
      id: userId,
      email,
      agency_id: agencyId,
      full_name: ownerName,
      phone,
      role: 'owner',
      account_status: 'active',
      is_super_admin: false,
    };

    let profileId = userId;
    let action = 'inserted';

    if (profileById?.id) {
      const updateRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(profilePayload),
      });
      if (!updateRes.ok) throw new Error(await updateRes.text());
      action = profileById.agency_id ? 'updated_existing_profile' : 'linked_existing_profile';
    } else if (legacyProfile?.id && legacyProfile.id !== userId) {
      const deleteLegacyRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(legacyProfile.id)}`, {
        method: 'DELETE',
        headers,
      });
      if (!deleteLegacyRes.ok) throw new Error(await deleteLegacyRes.text());
      const insertRes = await fetch(`${projectUrl}/rest/v1/users_profiles`, {
        method: 'POST',
        headers,
        body: JSON.stringify([profilePayload]),
      });
      if (!insertRes.ok) throw new Error(await insertRes.text());
      action = 'replaced_legacy_profile';
    } else {
      const insertRes = await fetch(`${projectUrl}/rest/v1/users_profiles`, {
        method: 'POST',
        headers,
        body: JSON.stringify([profilePayload]),
      });
      if (!insertRes.ok) throw new Error(await insertRes.text());
    }

    console.log('repair-approved-profile: complete', { userId, profileId, agencyId, action });
    return json(corsHeaders, {
      success: true,
      repaired: true,
      action,
      agency_id: agencyId,
      agencyId,
      profile_id: profileId,
      profileId,
    });
  } catch (error) {
    console.error('repair-approved-profile failed', error instanceof Error ? error.message : error);
    return json(corsHeaders, { success: false, error: error instanceof Error ? error.message : 'Réparation profil impossible.' }, 500);
  }
});
