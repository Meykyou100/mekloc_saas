// Supabase Edge Function: send-access-request-email
// Sends access-request confirmation email via Resend.
// Deploy with: supabase functions deploy send-access-request-email

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'MekLoc <no-reply@mekloc.app>';

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { to, subject, text, html } = body as {
      to?: string;
      subject?: string;
      text?: string;
      html?: string;
    };

    if (!to || !subject || (!text && !html)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        text: text || undefined,
        html: html || undefined,
      }),
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      return new Response(JSON.stringify({ error: 'Resend request failed', details: errorBody }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resendResponse.json();
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message || 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
