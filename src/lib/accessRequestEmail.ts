type AccessRequestEmailInput = {
  ownerName: string;
  email: string;
  selectedPlan: string;
};

function buildAccessRequestHtml(input: AccessRequestEmailInput) {
  return `
  <div style="font-family: Inter, Arial, sans-serif; background:#070909; color:#F5F5F5; padding:24px;">
    <div style="max-width:620px; margin:0 auto; border:1px solid rgba(255,255,255,0.12); border-radius:16px; background:#0F1115; overflow:hidden;">
      <div style="padding:18px 22px; border-bottom:1px solid rgba(255,255,255,0.08);">
        <h2 style="margin:0; font-size:20px; color:#D4A017;">MekLoc</h2>
        <p style="margin:6px 0 0; color:#B8BDC7; font-size:13px;">Smart Rental Management System</p>
      </div>
      <div style="padding:22px;">
        <p style="margin:0 0 14px;">Bonjour ${input.ownerName || 'cher client'},</p>
        <p style="margin:0 0 14px; color:#DDE2EA;">
          Nous avons bien reçu votre demande d’accès pour le plan <strong style="color:#F5F5F5;">${input.selectedPlan}</strong>.
        </p>
        <p style="margin:0 0 14px; color:#DDE2EA;">
          Vérifiez votre messagerie et cliquez sur le lien de confirmation pour valider votre demande.
        </p>
        <p style="margin:0 0 14px; color:#DDE2EA;">
          Vérifiez aussi vos spams si vous ne trouvez pas l’email. Le lien expire dans 24h.
        </p>
        <div style="margin-top:20px; font-size:12px; color:#8A8F98;">
          Cet email a été envoyé à ${input.email}
        </div>
      </div>
    </div>
  </div>`;
}

export async function sendAccessRequestConfirmationEmail(input: AccessRequestEmailInput) {
  const webhookUrl = import.meta.env.VITE_ACCESS_REQUEST_EMAIL_WEBHOOK as string | undefined;
  if (!webhookUrl) return { sent: false as const, reason: 'missing_webhook' as const };

  const payload = {
    to: input.email,
    subject: 'Votre demande d’accès MekLoc a été reçue',
    text: `Bonjour ${input.ownerName}, nous avons bien reçu votre demande pour le plan ${input.selectedPlan}.`,
    html: buildAccessRequestHtml(input),
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Échec envoi email de confirmation.');
  }

  return { sent: true as const };
}
