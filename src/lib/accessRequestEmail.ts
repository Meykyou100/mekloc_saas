type AccessRequestEmailInput = {
  agencyName: string;
  ownerName: string;
  address: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  websiteUrl?: string;
  selectedPlan: string;
  planName: string;
  billingType: string;
  vehicleCount: number;
  promoCode?: string;
  emailVerifiedAt?: string;
  termsAccepted: boolean;
};

export async function sendAccessRequestAdminNotification(input: AccessRequestEmailInput) {
  const configuredWebhook = import.meta.env.VITE_SEND_ACCESS_REQUEST_EMAIL_WEBHOOK as string | undefined;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const webhookUrl = configuredWebhook?.trim()
    || (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/send-access-request-email` : '');
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!webhookUrl) return { sent: false as const, reason: 'missing_webhook' as const };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(supabaseAnonKey ? { Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    return { sent: false as const, reason: 'provider_error' as const, details };
  }

  return { sent: true as const };
}
