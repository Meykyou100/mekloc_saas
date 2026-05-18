type AccessRequestEmailInput = {
  ownerName: string;
  email: string;
  selectedPlan: string;
};

export async function sendAccessRequestConfirmationEmail(input: AccessRequestEmailInput) {
  const webhookUrl = import.meta.env.VITE_ACCESS_REQUEST_EMAIL_WEBHOOK as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!webhookUrl) return { sent: false as const, reason: 'missing_webhook' as const };

  const payload = {
    to: input.email,
    ownerName: input.ownerName,
    selectedPlan: input.selectedPlan,
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(supabaseAnonKey ? { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    return { sent: false as const, reason: 'provider_error' as const, details };
  }

  return { sent: true as const };
}
