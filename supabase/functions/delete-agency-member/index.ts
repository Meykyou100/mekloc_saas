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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Session manquante.' }, 401);

    const projectUrl = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL') || '';
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (!projectUrl || !serviceRole || !anonKey) throw new Error('Configuration Supabase manquante.');

    const { memberId } = await req.json() as { memberId?: string };
    if (!memberId) throw new Error('memberId requis.');

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
    if (authUser.id === memberId) return json({ error: 'Vous ne pouvez pas supprimer votre propre accès.' }, 403);

    const callerRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,agency_id,role,account_status,is_super_admin&limit=1`, {
      headers: serviceHeaders,
    });
    const callerRows = await callerRes.json() as ProfileRow[];
    const caller = callerRows?.[0];
    const callerRole = normalizeRole(caller?.role);
    if (!caller?.agency_id || caller.account_status !== 'active') return json({ error: 'Compte agence inactif.' }, 403);
    if (!caller.is_super_admin && callerRole !== 'owner' && callerRole !== 'manager') return json({ error: 'Accès refusé.' }, 403);

    const targetRes = await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(memberId)}&select=id,agency_id,role,account_status,is_super_admin,full_name,email&limit=1`, {
      headers: serviceHeaders,
    });
    const targetRows = await targetRes.json() as ProfileRow[];
    const target = targetRows?.[0];
    if (!target) return json({ error: 'Utilisateur introuvable.' }, 404);
    if (target.agency_id !== caller.agency_id) return json({ error: 'Cet utilisateur ne fait pas partie de votre agence.' }, 403);
    if (target.is_super_admin) return json({ error: 'Impossible de supprimer un super admin.' }, 403);

    const targetRole = normalizeRole(target.role);
    if (targetRole === 'owner' && callerRole !== 'owner' && !caller.is_super_admin) {
      return json({ error: 'Seul un propriétaire peut supprimer un propriétaire.' }, 403);
    }

    await fetch(`${projectUrl}/rest/v1/user_sessions?user_id=eq.${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
      headers: serviceHeaders,
    });

    const deleteAuthRes = await fetch(`${projectUrl}/auth/v1/admin/users/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
      headers: serviceHeaders,
    });
    const deleteAuthText = await deleteAuthRes.text();
    if (!deleteAuthRes.ok && !/not.?found|missing/i.test(deleteAuthText)) {
      throw new Error(deleteAuthText || 'Suppression Auth impossible.');
    }

    await fetch(`${projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
      headers: serviceHeaders,
    });

    return json({ success: true, deletedUserId: memberId, email: target.email || null });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Suppression impossible.' }, 400);
  }
});
