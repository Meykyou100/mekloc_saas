import { ArrowLeft, Mail } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field, SelectField } from '../components/ui/Form';
import { useApp } from '../context/AppContext';
import { sendAccessRequestConfirmationEmail } from '../lib/accessRequestEmail';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const countries = ['Maroc', 'France', 'Espagne', 'Belgique', 'Allemagne', 'Italie', 'Pays-Bas', 'Émirats Arabes Unis', 'Arabie Saoudite', 'Autre'];
const moroccoCities = ['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Fès', 'Meknès', 'Agadir', 'Oujda', 'Tétouan', 'Nador', 'Kénitra', 'El Jadida', 'Safi', 'Essaouira', 'Beni Mellal', 'Khouribga', 'Settat', 'Mohammedia', 'Salé', 'Laâyoune', 'Dakhla', 'Errachidia', 'Ouarzazate', 'Taza', 'Larache', 'Ksar El Kebir', 'Al Hoceima', 'Ifrane', 'Autre'];
const plans = [
  { id: 'gratuit', name: 'Gratuit', monthly: 0, annual: 0 },
  { id: 'starter', name: 'Starter', monthly: 99, annual: 990 },
  { id: 'business', name: 'Business', monthly: 249, annual: 2490 },
] as const;
type PlanId = (typeof plans)[number]['id'];

export default function DemandeAccesPage() {
  const [searchParams] = useSearchParams();
  const { notify } = useApp();
  const normalizeEmail = (email: string) => email.trim().toLowerCase();
  const [country, setCountry] = useState('Maroc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('business');
  const [billingType, setBillingType] = useState<'monthly' | 'annual'>('monthly');
  const prefilledEmail = searchParams.get('email') || '';
  const fromLogin = searchParams.get('from') === 'login';

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acceptedTerms) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      agency_name: String(form.get('agency_name') || ''),
      owner_name: String(form.get('owner_name') || ''),
      address: String(form.get('address') || ''),
      country: String(form.get('country') || 'Maroc'),
      city: String(form.get('city') || ''),
      website_url: String(form.get('website_url') || ''),
      email: normalizeEmail(String(form.get('email') || '')),
      phone_country_code: String(form.get('phone_country_code') || '+212'),
      phone_number: String(form.get('phone_number') || ''),
      vehicle_count: Number(form.get('vehicle_count') || 0),
      selected_plan: selectedPlan,
      billing_type: billingType,
      monthly_price: plans.find((p) => p.id === selectedPlan)?.monthly || 0,
      annual_price: plans.find((p) => p.id === selectedPlan)?.annual || 0,
      promo_code: String(form.get('promo_code') || ''),
      status: 'pending',
    };
    setSubmittedEmail(payload.email);
    setIsSubmitting(true);
    try {
      if (!supabase || !isSupabaseConfigured) throw new Error('Supabase non configuré');
      const { data: row, error: existingError } = await supabase
        .from('access_requests')
        .select('status, agency_name, selected_plan, created_at, email')
        .eq('email', payload.email)
        .in('status', ['pending', 'pending_verification', 'contacted', 'payment_pending', 'verified'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (import.meta.env.DEV) console.log('Access request found:', row);
      if (existingError) throw existingError;
      if (row && ['pending', 'pending_verification', 'contacted', 'payment_pending', 'verified'].includes(row.status)) {
        window.location.href = `/verification-en-cours?email=${encodeURIComponent(payload.email)}&agency=${encodeURIComponent(row.agency_name || payload.agency_name)}&plan=${encodeURIComponent(row.selected_plan || payload.selected_plan)}&created_at=${encodeURIComponent(row.created_at || '')}${row.status === 'contacted' ? `&note=${encodeURIComponent('Notre équipe vous a contacté ou vous contactera bientôt.')}` : ''}`;
        return;
      }
      const { error } = await supabase.from('access_requests').insert(payload);
      if (error) throw error;
      try {
        const emailResult = await sendAccessRequestConfirmationEmail({ ownerName: payload.owner_name, email: payload.email, selectedPlan: payload.selected_plan });
        if (!emailResult.sent) console.warn('email optional failed', emailResult);
      } catch (emailError) {
        console.warn('email optional failed', emailError);
      }
      notify({ title: 'Demande envoyée', message: 'Votre demande a été envoyée. MekLoc vous contactera après vérification.', type: 'success' });
      setIsSuccess(true);
    } catch (error) {
      notify({ title: 'Envoi impossible', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendEmail() {
    const email = submittedEmail || prefilledEmail;
    if (!email) return;
    setResendLoading(true);
    try {
      await sendAccessRequestConfirmationEmail({
        ownerName: 'Client MekLoc',
        email,
        selectedPlan,
      });
      notify({
        title: 'Email renvoyé',
        message: `Un nouvel email de vérification a été envoyé à ${email}.`,
        type: 'success',
      });
      setResendCooldown(45);
    } catch {
      notify({
        title: 'Réessayer plus tard',
        message: "Impossible d'envoyer l'email pour le moment.",
        type: 'warning',
      });
    } finally {
      setResendLoading(false);
    }
  }

  if (isSuccess) {
    const targetEmail = submittedEmail || prefilledEmail || 'votre adresse email';
    return (
      <div className="min-h-screen bg-carbon-950 px-4 py-8 text-white sm:px-6">
        <div className="mx-auto flex min-h-[80vh] w-full max-w-xl items-center">
          <Card className="w-full p-6 sm:p-8">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-carbon-400">MekLoc</p>
            <div className="mx-auto mt-4 mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gold-300/40 bg-gold-400/10 text-gold-200">
              <Mail className="h-6 w-6" />
            </div>
            <h1 className="text-center text-2xl font-black">Vérifiez votre messagerie</h1>
            <div className="mt-3 space-y-2 text-center text-sm text-carbon-300">
              <p>
                Un email de vérification a été envoyé à <span className="font-semibold text-white">{targetEmail}</span>.
                Cliquez sur le lien pour confirmer votre demande.
              </p>
              <p>Vérifiez aussi vos spams si vous ne trouvez pas l’email. Le lien expire dans 24h.</p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={handleResendEmail}
                loading={resendLoading}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : "Renvoyer l'email"}
              </Button>
              <Link to="/auth">
                <Button variant="secondary" className="w-full">Retour à la connexion</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link to="/auth" className="inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 transition hover:text-gold-200"><ArrowLeft className="h-4 w-4" />Retour à la connexion</Link>
        <Card className="mt-4 p-4 sm:mt-6 sm:p-7">
          <h1 className="text-2xl font-black sm:text-3xl">Demande d’accès MekLoc</h1>
          {fromLogin ? <p className="mt-2 text-sm text-gold-200">Votre compte n’est pas encore activé. Remplissez cette demande pour obtenir l’accès.</p> : null}
          <div className="mt-5 inline-flex rounded-xl border border-white/10 bg-[#0f1115] p-1">
            <button type="button" onClick={() => setBillingType('monthly')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${billingType === 'monthly' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300 hover:text-white'}`}>Mensuel</button>
            <button type="button" onClick={() => setBillingType('annual')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${billingType === 'annual' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300 hover:text-white'}`}>Annuel</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {plans.map((plan) => {
              const active = selectedPlan === plan.id;
              const price = billingType === 'annual' ? plan.annual : plan.monthly;
              return (
                <button key={plan.id} type="button" onClick={() => setSelectedPlan(plan.id)} className={`rounded-2xl border bg-[#0f1115] p-4 text-left transition ${active ? 'border-gold-300/45 shadow-[0_0_0_1px_rgba(212,160,23,0.25)]' : 'border-white/10 hover:border-white/20'}`}>
                  <p className="font-bold">{plan.name}</p>
                  <p className="mt-1 text-lg font-black">{price} MAD <span className="text-xs font-semibold text-carbon-400">{billingType === 'annual' ? '/an' : '/mois'}</span></p>
                </button>
              );
            })}
          </div>
          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <Field label="Nom de l’agence *" name="agency_name" required />
            <Field label="Responsable *" name="owner_name" required />
            <Field label="Adresse *" name="address" required />
            <SelectField label="Pays *" name="country" value={country} onChange={(e) => setCountry(e.target.value)} required>{countries.map((c) => <option key={c} value={c}>{c}</option>)}</SelectField>
            {country === 'Maroc' ? <SelectField label="Ville *" name="city" defaultValue="" required><option value="" disabled>Choisir une ville</option>{moroccoCities.map((c) => <option key={c} value={c}>{c}</option>)}</SelectField> : <Field label="Ville *" name="city" required />}
            <Field label="Site web / Instagram / Réseau social" name="website_url" />
            <Field label="Email *" name="email" type="email" defaultValue={prefilledEmail} required />
            <div className="grid gap-3 sm:grid-cols-[120px_1fr]"><Field label="Indicatif" name="phone_country_code" defaultValue="+212" required /><Field label="Numéro de téléphone *" name="phone_number" required /></div>
            <Field label="Nombre de véhicules *" name="vehicle_count" type="number" min={1} required />
            <Field label="Code promo (optionnel)" name="promo_code" />
            <label className="mt-1 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-carbon-300"><input type="checkbox" className="mt-0.5 h-4 w-4 rounded border border-gold-300/70 bg-transparent accent-[#D4A017]" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required /><span>J’ai lu et j’accepte les conditions d’utilisation et la politique de confidentialité.</span></label>
            <Button type="submit" className="mt-1 w-full" loading={isSubmitting}>Envoyer la demande d’accès</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
