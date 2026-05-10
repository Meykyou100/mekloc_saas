const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const internalKey = req.headers.get('x-internal-key') || '';
    const anonKey = Deno.env.get('ANON_KEY') || '';
    if (!anonKey || internalKey !== anonKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const projectUrl = Deno.env.get('PROJECT_URL') || '';
    const serviceRole = Deno.env.get('SERVICE_ROLE_KEY') || '';
    if (!projectUrl || !serviceRole) throw new Error('PROJECT_URL or SERVICE_ROLE_KEY missing');

    const { requestId } = (await req.json()) as { requestId?: string };
    if (!requestId) throw new Error('requestId required');

    const adminHeaders = {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
    };

    const res = await fetch(`${projectUrl}/rest/v1/access_requests?id=eq.${encodeURIComponent(requestId)}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

