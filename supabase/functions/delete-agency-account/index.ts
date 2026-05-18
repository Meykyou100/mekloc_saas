import { defaultCorsHeaders as corsHeaders, json, requireSuperAdmin, serviceHeaders } from '../_shared/security.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return json(corsHeaders, { error: auth.error }, auth.status);

    const { agencyId } = (await req.json()) as { agencyId?: string };
    if (!agencyId) return json(corsHeaders, { error: 'Paramètres invalides.' }, 400);

    const adminHeaders = serviceHeaders(auth.serviceRole);
    const profilesRes = await fetch(
      `${auth.projectUrl}/rest/v1/users_profiles?agency_id=eq.${encodeURIComponent(agencyId)}&select=id,email`,
      { method: 'GET', headers: adminHeaders },
    );
    const profiles = profilesRes.ok ? ((await profilesRes.json()) as Array<{ id: string; email: string | null }>) : [];

    for (const table of ['payments', 'contracts', 'reservations', 'maintenance', 'clients', 'vehicles', 'users_profiles']) {
      const res = await fetch(`${auth.projectUrl}/rest/v1/${table}?agency_id=eq.${encodeURIComponent(agencyId)}`, {
        method: 'DELETE',
        headers: adminHeaders,
      });
      if (!res.ok) console.error(`delete-agency-account ${table} cleanup failed`, await res.text());
    }

    const agencyRes = await fetch(`${auth.projectUrl}/rest/v1/agencies?id=eq.${encodeURIComponent(agencyId)}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (!agencyRes.ok) {
      console.error('delete-agency-account agency delete failed', await agencyRes.text());
      return json(corsHeaders, { error: 'Suppression agence impossible.' }, 400);
    }

    for (const p of profiles) {
      const res = await fetch(`${auth.projectUrl}/auth/v1/admin/users/${p.id}`, {
        method: 'DELETE',
        headers: adminHeaders,
      });
      if (!res.ok) console.error('delete-agency-account auth cleanup failed', await res.text());
    }

    return json(corsHeaders, { success: true, deletedAuthUsers: profiles.length });
  } catch (error) {
    console.error('delete-agency-account failed', error);
    return json(corsHeaders, { error: 'Suppression agence impossible.' }, 500);
  }
});
