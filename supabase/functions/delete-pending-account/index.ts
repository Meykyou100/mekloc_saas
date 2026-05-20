import { defaultCorsHeaders, json, requireSuperAdmin, serviceHeaders, sanitizeText } from '../_shared/security.ts';

type ProfileRow = {
  id: string;
  agency_id: string | null;
  email: string | null;
  account_status: string | null;
  is_super_admin: boolean | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: defaultCorsHeaders });

  try {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return json(defaultCorsHeaders, { error: auth.error }, auth.status);

    const { userId } = await req.json() as { userId?: string };
    const targetUserId = sanitizeText(userId, 80);
    if (!targetUserId) return json(defaultCorsHeaders, { error: 'Utilisateur requis.' }, 400);
    if (targetUserId === auth.authUser.id) return json(defaultCorsHeaders, { error: 'Vous ne pouvez pas supprimer votre propre compte.' }, 403);

    const headers = serviceHeaders(auth.serviceRole);
    const profileRes = await fetch(
      `${auth.projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(targetUserId)}&select=id,agency_id,email,account_status,is_super_admin&limit=1`,
      { headers },
    );
    if (!profileRes.ok) {
      const text = await profileRes.text();
      throw new Error(text || 'Lecture profil impossible.');
    }
    const profiles = await profileRes.json() as ProfileRow[];
    const target = profiles?.[0];
    if (!target) return json(defaultCorsHeaders, { error: 'Profil introuvable.' }, 404);
    if (target.is_super_admin) return json(defaultCorsHeaders, { error: 'Impossible de supprimer un super admin.' }, 403);
    if (target.account_status !== 'pending_deletion') {
      return json(defaultCorsHeaders, { error: 'Ce compte n’est pas en cours de suppression.' }, 400);
    }

    await fetch(`${auth.projectUrl}/rest/v1/user_sessions?user_id=eq.${encodeURIComponent(targetUserId)}`, {
      method: 'DELETE',
      headers,
    });

    const deleteAuthRes = await fetch(`${auth.projectUrl}/auth/v1/admin/users/${encodeURIComponent(targetUserId)}`, {
      method: 'DELETE',
      headers,
    });
    const deleteAuthText = await deleteAuthRes.text();
    if (!deleteAuthRes.ok && !/not.?found|missing/i.test(deleteAuthText)) {
      throw new Error(deleteAuthText || 'Suppression Auth impossible.');
    }

    const deleteProfileRes = await fetch(`${auth.projectUrl}/rest/v1/users_profiles?id=eq.${encodeURIComponent(targetUserId)}`, {
      method: 'DELETE',
      headers,
    });
    if (!deleteProfileRes.ok) {
      const text = await deleteProfileRes.text();
      throw new Error(text || 'Suppression profil impossible.');
    }

    return json(defaultCorsHeaders, { success: true, deletedUserId: targetUserId, email: target.email || null });
  } catch (error) {
    return json(defaultCorsHeaders, { error: error instanceof Error ? error.message : 'Suppression impossible.' }, 400);
  }
});
