import { defaultCorsHeaders as corsHeaders, getAuthUser, getSupabaseConfig, json, serviceHeaders } from '../_shared/security.ts';

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function normalizePlan(rawPlan: unknown): 'starter' | 'pro' | 'business' {
  const value = String(rawPlan || '').trim().toLowerCase();
  if (value === 'pro') return 'pro';
  if (value === 'business') return 'business';
  return 'starter';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { projectUrl, serviceRole, anonKey } = getSupabaseConfig();
    const authUser = await getAuthUser(projectUrl, anonKey, req.headers.get('Authorization') || '');
    const userId = authUser?.id || '';
    const email = String((authUser as { email?: string } | null)?.email || '').trim().toLowerCase();
    if (!userId || !email) return json(corsHeaders, { success: false, error: 'Session utilisateur introuvable.' }, 401);

    const headers = serviceHeaders(serviceRole);
    const requestRes = await fetch(
      `${projectUrl}/rest/v1/access_requests?email=eq.${encodeURIComponent(email)}&status=eq.approved&select=*&order=created_at.desc&limit=1`,
      { headers },
    );
    if (!requestRes.ok) return json(corsHeaders, { success: false, error: 'Demande approuvée introuvable.' }, 404);
    const requestRows = await requestRes.json() as Array<Record<string, unknown>>;
    const accessRequest = requestRows?.[0];
    if (!accessRequest) return json(corsHeaders, { success: false, error: 'Demande approuvée introuvable.' }, 404);

    const existingByIdRes = await fetch(
      `${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(userId)}&select=id,agency_id&limit=1`,
      { headers },
    );
    const existingById = (await existingByIdRes.json() as Array<{ id: string; agency_id: string | null }>)?.[0];
    if (existingById?.agency_id) {
      return json(corsHeaders, { success: true, repaired: false, reason: 'profile_already_linked' });
    }

    const legacyProfileRes = await fetch(
      `${projectUrl}/rest/v1/users_profiles?email=eq.${encodeURIComponent(email)}&select=id,agency_id&limit=1`,
      { headers },
    );
    const legacyProfile = (await legacyProfileRes.json() as Array<{ id: string; agency_id: string | null }>)?.[0];
    let agencyId = existingById?.agency_id || legacyProfile?.agency_id || '';

    if (!agencyId) {
      const agencyName = String(accessRequest.agency_name || 'Agence MekLoc');
      const agencyRes = await fetch(
        `${projectUrl}/rest/v1/agencies?name=eq.${encodeURIComponent(agencyName)}&select=id&order=created_at.desc&limit=1`,
        { headers },
      );
      const agency = (await agencyRes.json() as Array<{ id: string }>)?.[0];
      agencyId = agency?.id || '';
    }

    if (!agencyId) {
      const agencyName = String(accessRequest.agency_name || 'Agence MekLoc');
      const today = new Date();
      const nextDue = new Date(today);
      nextDue.setDate(nextDue.getDate() + 30);
      const createAgencyRes = await fetch(`${projectUrl}/rest/v1/agencies`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify([{
          name: agencyName,
          slug: `${slugify(agencyName)}-${Date.now().toString().slice(-5)}`,
          created_by: userId,
          plan: normalizePlan(accessRequest.selected_plan),
          billing_status: 'trial',
          subscription_start_date: today.toISOString().slice(0, 10),
          next_payment_due_date: nextDue.toISOString().slice(0, 10),
        }]),
      });
      const createAgencyText = await createAgencyRes.text();
      if (!createAgencyRes.ok) throw new Error(createAgencyText || 'Création agence impossible.');
      agencyId = (JSON.parse(createAgencyText) as Array<{ id: string }>)?.[0]?.id || '';
    }

    if (!agencyId) throw new Error('Agence introuvable.');

    const profilePayload = {
      id: userId,
      email,
      agency_id: agencyId,
      full_name: String(accessRequest.owner_name || email),
      role: 'Admin',
      account_status: 'active',
      is_super_admin: false,
    };

    if (existingById?.id) {
      const updateRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(profilePayload),
      });
      if (!updateRes.ok) throw new Error(await updateRes.text());
    } else if (legacyProfile?.id && legacyProfile.id !== userId) {
      const updateLegacyRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(legacyProfile.id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(profilePayload),
      });
      if (!updateLegacyRes.ok) throw new Error(await updateLegacyRes.text());
    } else {
      const insertRes = await fetch(`${projectUrl}/rest/v1/users_profiles`, {
        method: 'POST',
        headers,
        body: JSON.stringify([profilePayload]),
      });
      if (!insertRes.ok) throw new Error(await insertRes.text());
    }

    return json(corsHeaders, { success: true, repaired: true, agencyId });
  } catch (error) {
    console.error('repair-approved-profile failed', error);
    return json(corsHeaders, { success: false, error: error instanceof Error ? error.message : 'Réparation profil impossible.' }, 500);
  }
});
