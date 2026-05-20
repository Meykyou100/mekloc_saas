import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field, SelectField } from '../components/ui/Form';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { normalizeText, sanitizeText, validateEmail, validatePhone, validatePositiveNumber } from '../lib/security';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const countries = ['Maroc', 'France', 'Espagne', 'Belgique', 'Allemagne', 'Italie', 'Pays-Bas', 'Émirats Arabes Unis', 'Arabie Saoudite', 'Autre'];
const countryDialCode: Record<string, string> = {
  Maroc: '+212',
  France: '+33',
  Espagne: '+34',
  Belgique: '+32',
  Allemagne: '+49',
  Italie: '+39',
  'Pays-Bas': '+31',
  'Émirats Arabes Unis': '+971',
  'Arabie Saoudite': '+966',
  Autre: '+000',
};
const moroccoCities = ['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Fès', 'Meknès', 'Agadir', 'Oujda', 'Tétouan', 'Nador', 'Kénitra', 'El Jadida', 'Safi', 'Essaouira', 'Beni Mellal', 'Khouribga', 'Settat', 'Mohammedia', 'Salé', 'Laâyoune', 'Dakhla', 'Errachidia', 'Ouarzazate', 'Taza', 'Larache', 'Ksar El Kebir', 'Al Hoceima', 'Ifrane', 'Autre'];
const plans = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 99,
    annual: 990,
    note: 'Pour les petites agences',
    features: ['Jusqu’à 5 véhicules', 'Réservations limitées', 'Gestion clients'],
    cta: 'Choisir Starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 250,
    annual: 2500,
    note: 'Pour les agences actives',
    features: ['Véhicules illimités', 'Réservations illimitées', 'Contrats PDF'],
    cta: 'Choisir Pro',
  },
  {
    id: 'business',
    name: 'Business',
    monthly: 499,
    annual: 4990,
    note: 'Le plus populaire',
    features: ['Tout le plan Pro', 'Multi-agences / multi-branches', 'Analytics avancés'],
    cta: 'Choisir Business',
  },
] as const;
type PlanId = (typeof plans)[number]['id'];

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { message?: string; details?: string; hint?: string; code?: string };
    if (maybe.message) return maybe.message;
    if (maybe.details) return maybe.details;
    if (maybe.hint) return maybe.hint;
    if (maybe.code) return `Erreur Supabase (${maybe.code})`;
  }
  return 'Réessayez.';
}

export default function DemandeAccesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useApp();
  const { signOut, session } = useAuth();
  const normalizeEmail = (email: string) => normalizeText(email, 254).toLowerCase();
  const [country, setCountry] = useState('Maroc');
  const [phoneCountryCode, setPhoneCountryCode] = useState(countryDialCode.Maroc);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('pro');
  const [billingType, setBillingType] = useState<'monthly' | 'annual'>('monthly');
  const prefilledEmail = searchParams.get('email') || '';
  const fromLogin = searchParams.get('from') === 'login';

  async function returnToLogin() {
    if (session) {
      await signOut().catch(() => undefined);
    }
    navigate('/auth?force=login', { replace: true });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acceptedTerms) {
      notify({
        title: 'Validation requise',
        message: 'Veuillez accepter les conditions avant d’envoyer la demande.',
        type: 'warning',
      });
      return;
    }
    const form = new FormData(event.currentTarget);
    const payload = {
      agency_name: sanitizeText(String(form.get('agency_name') || ''), 120),
      owner_name: sanitizeText(String(form.get('owner_name') || ''), 120),
      address: sanitizeText(String(form.get('address') || ''), 220),
      country: sanitizeText(String(form.get('country') || 'Maroc'), 80),
      city: sanitizeText(String(form.get('city') || ''), 80),
      website_url: sanitizeText(String(form.get('website_url') || ''), 220),
      email: normalizeEmail(String(form.get('email') || '')),
      phone_country_code: normalizeText(String(form.get('phone_country_code') || '+212'), 8),
      phone_number: normalizeText(String(form.get('phone_number') || ''), 16).replace(/\D/g, ''),
      vehicle_count: Number(form.get('vehicle_count') || 0),
      selected_plan: selectedPlan,
      billing_type: billingType,
      monthly_price: plans.find((p) => p.id === selectedPlan)?.monthly || 0,
      annual_price: plans.find((p) => p.id === selectedPlan)?.annual || 0,
      promo_code: sanitizeText(String(form.get('promo_code') || ''), 60),
      status: 'pending',
    };
    const selectedPlanDb = selectedPlan === 'pro' ? 'starter' : selectedPlan;
    if (!payload.agency_name || !payload.owner_name || !payload.address || !payload.city) {
      notify({ title: 'Champ obligatoire', message: 'Veuillez remplir les champs obligatoires.', type: 'warning' });
      setIsSubmitting(false);
      return;
    }
    if (!validateEmail(payload.email)) {
      notify({ title: 'Email invalide', message: 'Veuillez saisir une adresse email valide.', type: 'warning' });
      setIsSubmitting(false);
      return;
    }
    if (!validatePhone(`${payload.phone_country_code}${payload.phone_number}`)) {
      notify({ title: 'Numéro invalide', message: 'Le numéro de téléphone doit contenir uniquement des chiffres.', type: 'warning' });
      setIsSubmitting(false);
      return;
    }
    if (!validatePositiveNumber(payload.vehicle_count)) {
      notify({ title: 'Nombre invalide', message: 'Le nombre de véhicules doit être supérieur à 0.', type: 'warning' });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
    try {
      if (!supabase || !isSupabaseConfigured) throw new Error('Supabase non configuré');
      const { data: row, error: existingError } = await supabase
        .from('access_requests')
        .select('status, agency_name, selected_plan, created_at, email')
        .eq('email', payload.email)
        .in('status', ['pending', 'pending_verification', 'contacted', 'payment_pending', 'verified', 'approved', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (import.meta.env.DEV) console.log('Access request found:', row);
      if (existingError) throw existingError;
      if (row?.status === 'approved') {
        notify({
          title: 'Accès déjà approuvé',
          message: 'Votre demande est déjà validée. Connectez-vous pour accéder à MekLoc.',
          type: 'success',
        });
        navigate(`/auth?email=${encodeURIComponent(payload.email)}`, { replace: true });
        return;
      }
      if (row && ['pending', 'pending_verification', 'contacted', 'payment_pending', 'verified'].includes(row.status)) {
        navigate(`/verification-en-cours?email=${encodeURIComponent(payload.email)}&agency=${encodeURIComponent(row.agency_name || payload.agency_name)}&plan=${encodeURIComponent(row.selected_plan || payload.selected_plan)}&created_at=${encodeURIComponent(row.created_at || '')}&status=${encodeURIComponent(row.status || 'pending')}${row.status === 'contacted' ? `&note=${encodeURIComponent('Notre équipe vous a contacté ou vous contactera bientôt.')}` : ''}`, { replace: true });
        return;
      }
      const { error } = await supabase.from('access_requests').insert({
        ...payload,
        selected_plan: selectedPlanDb,
      });
      if (error) throw error;
      navigate(`/verification-en-cours?email=${encodeURIComponent(payload.email)}&agency=${encodeURIComponent(payload.agency_name)}&plan=${encodeURIComponent(payload.selected_plan)}&status=pending`, { replace: true });
    } catch (error) {
      const maybePostgrest = typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined;
      if (maybePostgrest === '23505') {
        navigate(`/verification-en-cours?email=${encodeURIComponent(payload.email)}&agency=${encodeURIComponent(payload.agency_name)}&plan=${encodeURIComponent(payload.selected_plan)}&status=pending`, { replace: true });
        return;
      }
      notify({ title: 'Envoi impossible', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setIsSubmitting(false);
    }
  }


  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-3xl">
        <button type="button" onClick={returnToLogin} className="inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 transition hover:text-gold-200"><ArrowLeft className="h-4 w-4" />Retour à la connexion</button>
        <Card className="mt-4 p-4 sm:mt-6 sm:p-7">
          <h1 className="text-2xl font-black sm:text-3xl">Demande d’accès MekLoc</h1>
          {fromLogin ? <p className="mt-2 text-sm text-gold-200">Votre compte n’est pas encore activé. Remplissez cette demande pour obtenir l’accès.</p> : null}
          <div className="mt-5 inline-flex rounded-xl border border-white/10 bg-[#0f1115] p-1">
            <button type="button" onClick={() => setBillingType('monthly')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${billingType === 'monthly' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300 hover:text-white'}`}>Mensuel</button>
            <button type="button" onClick={() => setBillingType('annual')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${billingType === 'annual' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300 hover:text-white'}`}>Annuel</button>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const active = selectedPlan === plan.id;
              const price = billingType === 'annual' ? plan.annual : plan.monthly;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative rounded-2xl border bg-[#0f1115] p-5 text-left transition ${active ? 'border-gold-300/45 bg-gold-400/[0.07] shadow-[0_0_0_1px_rgba(212,160,23,0.25)]' : 'border-white/10 hover:border-white/20'}`}
                >
                  {plan.id === 'business' ? (
                    <span className="absolute right-4 top-4 rounded-full bg-gold-400 px-2.5 py-1 text-[11px] font-black text-carbon-950">
                      Populaire
                    </span>
                  ) : null}
                  <p className="text-xl font-black text-white">{plan.name}</p>
                  <p className="mt-1 text-sm text-carbon-400">{plan.note}</p>
                  <p className="mt-4 text-4xl font-black text-white">
                    {price} MAD
                    <span className="ml-1 text-base font-semibold text-carbon-400">
                      {billingType === 'annual' ? '/an' : '/mois'}
                    </span>
                  </p>
                  <div className="mt-4 space-y-2.5">
                    {plan.features.map((feature) => (
                      <p key={feature} className="flex items-center gap-2 text-sm text-carbon-200">
                        <CheckCircle2 className="h-4 w-4 text-gold-300" />
                        {feature}
                      </p>
                    ))}
                  </div>
                  <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center text-sm font-bold text-white">
                    {plan.cta}
                  </div>
                </button>
              );
            })}
          </div>
          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <Field label="Nom de l’agence *" name="agency_name" required />
            <Field label="Responsable *" name="owner_name" required />
            <Field label="Adresse *" name="address" required />
            <SelectField
              label="Pays *"
              name="country"
              value={country}
              onChange={(e) => {
                const nextCountry = e.target.value;
                setCountry(nextCountry);
                setPhoneCountryCode(countryDialCode[nextCountry] || '+000');
              }}
              required
            >
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectField>
            {country === 'Maroc' ? <SelectField label="Ville *" name="city" defaultValue="" required><option value="" disabled>Choisir une ville</option>{moroccoCities.map((c) => <option key={c} value={c}>{c}</option>)}</SelectField> : <Field label="Ville *" name="city" required />}
            <Field label="Site web / Instagram / Réseau social" name="website_url" />
            <Field
              label="Email *"
              name="email"
              type="email"
              defaultValue={prefilledEmail}
              required
              onInvalid={(event) => event.currentTarget.setCustomValidity('Veuillez saisir une adresse email valide.')}
              onInput={(event) => event.currentTarget.setCustomValidity('')}
            />
            <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3">
              <Field label="Indicatif" name="phone_country_code" value={phoneCountryCode} onChange={(e) => setPhoneCountryCode(e.target.value)} required />
              <Field
                label="Numéro de téléphone *"
                name="phone_number"
                required
                inputMode="numeric"
                pattern="[0-9]{6,15}"
                maxLength={15}
                onInput={(event) => {
                  const target = event.currentTarget;
                  target.value = target.value.replace(/\D/g, '');
                  target.setCustomValidity('');
                }}
                onInvalid={(event) => event.currentTarget.setCustomValidity('Le numéro doit contenir uniquement des chiffres (6 à 15).')}
              />
            </div>
            <Field label="Nombre de véhicules *" name="vehicle_count" type="number" min={1} required />
            <Field label="Code promo (optionnel)" name="promo_code" />
            <label className="mt-1 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-carbon-300">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border border-gold-300/70 bg-transparent accent-[#D4A017]" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required />
              <span>
                J’ai lu et j’accepte les{' '}
                <Link to="/conditions-utilisation" target="_blank" className="font-semibold text-gold-200 hover:text-gold-100">conditions d’utilisation</Link>{' '}
                et la{' '}
                <Link to="/politique-confidentialite" target="_blank" className="font-semibold text-gold-200 hover:text-gold-100">politique de confidentialité</Link>,
                ainsi que la{' '}
                <Link to="/annulation-remboursement" target="_blank" className="font-semibold text-gold-200 hover:text-gold-100">politique d’annulation et de remboursement</Link>.
              </span>
            </label>
            <Button type="submit" className="mt-1 w-full" loading={isSubmitting}>Envoyer la demande d’accès</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
