import { ArrowLeft, Check, CheckCircle2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field, SelectField } from '../components/ui/Form';
import { useApp } from '../context/AppContext';
import { sendAccessRequestConfirmationEmail } from '../lib/accessRequestEmail';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type PlanId = 'gratuit' | 'starter' | 'business';
type BillingType = 'monthly' | 'annual';

const planConfig = {
  gratuit: { name: 'Gratuit', monthly: 0, color: 'border-emerald-400/35', popular: false },
  starter: { name: 'Starter', monthly: 99, color: 'border-violet-400/35', popular: false },
  business: { name: 'Business', monthly: 249, color: 'border-gold-300/45', popular: true },
} as const;

const planFeatures: Record<PlanId, string[]> = {
  gratuit: ['Jusqu’à 5 véhicules', '1 utilisateur', 'Jusqu’à 40 réservations/mois', 'Formation gratuite', 'Disponible sur ordinateur & mobile'],
  starter: ['Jusqu’à 10 véhicules', '2 utilisateurs', 'Jusqu’à 100 réservations/mois', 'Formation gratuite', 'Disponible sur ordinateur & mobile'],
  business: ['Jusqu’à 30 véhicules', '2 utilisateurs', 'Jusqu’à 350 réservations/mois', 'Contrats PDF', 'Paiements & factures', 'Entretien véhicules', 'Support prioritaire'],
};

function formatMAD(value: number) {
  return `${value.toLocaleString('fr-MA')} MAD`;
}

export default function DemandeAccesPage() {
  const { notify } = useApp();
  const [billingType, setBillingType] = useState<BillingType>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('business');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const selectedPricing = useMemo(() => {
    const monthly = planConfig[selectedPlan].monthly;
    const annual = monthly * 10;
    const saving = monthly * 2;
    return { monthly, annual, saving };
  }, [selectedPlan]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acceptedTerms) {
      notify({ title: 'Validation requise', message: 'Veuillez accepter les conditions pour continuer.', type: 'warning' });
      return;
    }

    const form = new FormData(event.currentTarget);
    const payload = {
      agency_name: String(form.get('agency_name') || ''),
      owner_name: String(form.get('owner_name') || ''),
      address: String(form.get('address') || ''),
      country: String(form.get('country') || 'Maroc'),
      city: String(form.get('city') || ''),
      website_url: String(form.get('website_url') || ''),
      email: String(form.get('email') || ''),
      phone_country_code: String(form.get('phone_country_code') || '+212'),
      phone_number: String(form.get('phone_number') || ''),
      vehicle_count: Number(form.get('vehicle_count') || 0),
      selected_plan: selectedPlan,
      billing_type: billingType,
      monthly_price: selectedPricing.monthly,
      annual_price: selectedPricing.annual,
      promo_code: String(form.get('promo_code') || ''),
      status: 'pending',
    };
    setSubmittedEmail(payload.email);

    setIsSubmitting(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('access_requests').insert(payload);
        if (error) {
          // Fallback local if Supabase table/RLS is not ready yet.
          const localQueueKey = 'mekloc-access-requests-fallback';
          const current = JSON.parse(localStorage.getItem(localQueueKey) || '[]') as unknown[];
          localStorage.setItem(localQueueKey, JSON.stringify([{ ...payload, created_at: new Date().toISOString() }, ...current]));
          notify({
            title: 'Demande enregistrée localement',
            message: 'La base Supabase n’est pas encore prête. Votre demande est conservée dans ce navigateur.',
            type: 'info',
          });
          setIsSuccess(true);
          return;
        }
      }

      try {
        const emailResult = await sendAccessRequestConfirmationEmail({
          ownerName: payload.owner_name,
          email: payload.email,
          selectedPlan: planConfig[selectedPlan].name,
        });

        if (!emailResult.sent) {
          notify({
            title: 'Demande envoyée',
            message: 'Demande enregistrée. Activez le service email pour envoyer automatiquement la confirmation.',
            type: 'info',
          });
        }
      } catch {
        notify({
          title: 'Demande envoyée',
          message: 'Demande enregistrée, mais l’email de confirmation n’a pas pu être envoyé.',
          type: 'warning',
        });
      }

      notify({
        title: 'Demande envoyée',
        message: 'Votre demande a bien été enregistrée. Notre équipe vous contactera rapidement.',
        type: 'success',
      });
      setIsSuccess(true);
    } catch (error) {
      notify({
        title: 'Envoi impossible',
        message: error instanceof Error ? error.message : 'Une erreur est survenue. Réessayez dans quelques instants.',
        type: 'warning',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-carbon-950 px-4 py-8 text-white sm:px-6">
        <div className="mx-auto flex min-h-[80vh] w-full max-w-xl items-center">
          <Card className="w-full p-6 sm:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/35 bg-emerald-500/10 text-emerald-200">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-center text-2xl font-black">Votre demande a été envoyée</h1>
            <div className="mt-3 space-y-2 text-center text-sm text-carbon-300">
              <p>
                Vérifiez votre messagerie. Un email a été envoyé à{' '}
                <span className="font-semibold text-white">{submittedEmail || 'votre adresse email'}</span>.
              </p>
              <p>Cliquez sur le lien pour confirmer votre demande.</p>
              <p>Vérifiez aussi vos spams si vous ne trouvez pas l’email. Le lien expire dans 24h.</p>
            </div>
            <Link to="/auth" className="mt-7 block">
              <Button className="w-full">Retour à la connexion</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link to="/auth" className="inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 transition hover:text-gold-200">
          <ArrowLeft className="h-4 w-4" />
          Retour à la connexion
        </Link>

        <Card className="mt-4 p-4 sm:mt-6 sm:p-7">
          <div className="mb-5 sm:mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-300/90">Demande d’accès MekLoc</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">Choisissez votre plan et envoyez votre demande</h1>
          </div>

          <div className="mb-5 inline-flex rounded-xl border border-white/10 bg-[#0f1115] p-1">
            <button type="button" onClick={() => setBillingType('monthly')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${billingType === 'monthly' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300 hover:text-white'}`}>Mensuel</button>
            <button type="button" onClick={() => setBillingType('annual')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${billingType === 'annual' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300 hover:text-white'}`}>Annuel</button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.keys(planConfig) as PlanId[]).map((planId) => {
              const plan = planConfig[planId];
              const price = billingType === 'annual' ? plan.monthly * 10 : plan.monthly;
              const cadence = billingType === 'annual' ? '/an' : '/mois';
              const active = selectedPlan === planId;

              return (
                <button
                  key={planId}
                  type="button"
                  onClick={() => setSelectedPlan(planId)}
                  className={`rounded-2xl border bg-[#0f1115] p-4 text-left transition ${active ? `${plan.color} shadow-[0_0_0_1px_rgba(212,160,23,0.2)]` : 'border-white/10 hover:border-white/20'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{plan.name}</p>
                    {plan.popular ? <span className="rounded-full bg-gold-400/20 px-2 py-0.5 text-[10px] font-bold text-gold-200">Le plus populaire</span> : null}
                  </div>
                  <p className="mt-2 text-lg font-black">{formatMAD(price)} <span className="text-xs font-semibold text-carbon-400">{cadence}</span></p>
                  {billingType === 'annual' && plan.monthly > 0 ? (
                    <p className="mt-1 text-xs text-emerald-300">2 mois offerts</p>
                  ) : null}
                  <ul className="mt-3 space-y-1.5">
                    {planFeatures[planId].slice(0, 3).map((feature) => (
                      <li key={feature} className="flex items-start gap-1.5 text-xs text-carbon-300">
                        <Check className="mt-0.5 h-3.5 w-3.5 text-gold-300" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {billingType === 'annual' && selectedPricing.monthly > 0 ? (
            <div className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              Vous économisez {formatMAD(selectedPricing.saving)} par an avec la facturation annuelle.
            </div>
          ) : null}

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <Field label="Nom complet de l’agence *" name="agency_name" placeholder="Ex: Agence MekLoc Casablanca" required />
            <Field label="Responsable *" name="owner_name" placeholder="Ex: Younes Mekki" required />
            <Field label="Adresse *" name="address" placeholder="Ex: 123 Rue Mohammed V" required />
            <SelectField label="Pays *" name="country" defaultValue="Maroc" required>
              <option value="Maroc">Maroc</option>
            </SelectField>
            <SelectField label="Ville *" name="city" required defaultValue="">
              <option value="" disabled>Choisir une ville</option>
              <option value="Casablanca">Casablanca</option>
              <option value="Rabat">Rabat</option>
              <option value="Marrakech">Marrakech</option>
              <option value="Tanger">Tanger</option>
              <option value="Fès">Fès</option>
              <option value="Agadir">Agadir</option>
              <option value="Oujda">Oujda</option>
              <option value="Autre">Autre</option>
            </SelectField>
            <Field label="Site web / Instagram / Réseau social" name="website_url" placeholder="Ex: https://instagram.com/votre_agence (optionnel)" />
            <Field label="Email *" name="email" type="email" placeholder="contact@votre-agence.ma" required />
            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
              <Field label="Indicatif" name="phone_country_code" defaultValue="+212" required />
              <Field label="Numéro de téléphone *" name="phone_number" placeholder="6XX XXX XXX" required />
            </div>
            <Field label="Nombre de véhicules *" name="vehicle_count" type="number" min={1} placeholder="Ex: 12" required />
            <Field label="Code promo (optionnel)" name="promo_code" placeholder="Ex: MEKLOC2026" />

            <label className="mt-1 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-carbon-300">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border border-gold-300/70 bg-transparent accent-[#D4A017]"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                required
              />
              <span>J’ai lu et j’accepte les conditions d’utilisation et la politique de confidentialité.</span>
            </label>

            <Button type="submit" className="mt-1 w-full" loading={isSubmitting}>Envoyer la demande d’accès</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
