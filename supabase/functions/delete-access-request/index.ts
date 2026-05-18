import { defaultCorsHeaders as corsHeaders, json, requireSuperAdmin, serviceHeaders } from '../_shared/security.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = await requireSuperAdmin(req);
    if (!auth.ok) return json(corsHeaders, { error: auth.error }, auth.status);

    const { requestId } = (await req.json()) as { requestId?: string };
    if (!requestId) return json(corsHeaders, { error: 'Paramètres invalides.' }, 400);

    const res = await fetch(`${auth.projectUrl}/rest/v1/access_requests?id=eq.${encodeURIComponent(requestId)}`, {
      method: 'DELETE',
      headers: serviceHeaders(auth.serviceRole),
    });
    if (!res.ok) {
      console.error('delete-access-request failed', await res.text());
      return json(corsHeaders, { error: 'Suppression impossible.' }, 400);
    }

    return json(corsHeaders, { success: true });
  } catch (error) {
    console.error('delete-access-request failed', error);
    return json(corsHeaders, { error: 'Suppression impossible.' }, 500);
  }
});
