import { ArrowLeft, CheckCircle2, LockKeyhole, MessageCircle, Send, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import { Field, SelectField } from '../components/ui/Form';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { MEKLOC_PLAN_LIST, MEKLOC_PLANS, getPlanConfig, getPlanOffer, type MekLocBillingChoice, type MekLocPlanId } from '../config/pricing';
import { sendAccessRequestAdminNotification } from '../lib/accessRequestEmail';
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
const plans = MEKLOC_PLAN_LIST;
type PlanId = MekLocPlanId;
type BillingType = MekLocBillingChoice;

function isProductionHost() {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'mekloc.com' || hostname === 'www.mekloc.com';
}

function canShowEmailTestCode() {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  return !isProductionHost() && (import.meta.env.DEV || isLocalhost || import.meta.env.VITE_ENABLE_EMAIL_TEST_MODE === 'true');
}

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
  const prefilledEmail = searchParams.get('email') || '';
  const fromLogin = searchParams.get('from') === 'login';
  const isEmailTestMode = canShowEmailTestCode();
  const requestedPlan = searchParams.get('plan') === 'starter' || searchParams.get('plan') === 'business' || searchParams.get('plan') === 'pro' || searchParams.get('plan') === 'lifetime'
    ? (searchParams.get('plan') as PlanId)
    : 'pro';
  const requestedBilling: BillingType = requestedPlan === 'lifetime' || searchParams.get('billing') === 'lifetime'
    ? 'lifetime'
    : searchParams.get('billing') === '6-months' || searchParams.get('billing') === 'six_months'
      ? 'six_months'
      : 'annual';
  const [email, setEmail] = useState(normalizeEmail(prefilledEmail));
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [emailVerificationStatus, setEmailVerificationStatus] = useState<'idle' | 'sent' | 'verified'>('idle');
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [verifiedAt, setVerifiedAt] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [country, setCountry] = useState('Maroc');
  const [phoneCountryCode, setPhoneCountryCode] = useState(countryDialCode.Maroc);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(requestedPlan);
  const [billingType, setBillingType] = useState<BillingType>(requestedBilling);
  const [requestedVehicleCount, setRequestedVehicleCount] = useState(1);
  const [requestedUserCount, setRequestedUserCount] = useState(1);
  const selectedPlanConfig = getPlanConfig(selectedPlan);
  const selectedOffer = getPlanOffer(selectedPlan, billingType);

  useEffect(() => {
    if (selectedPlan === 'lifetime') {
      setBillingType('lifetime');
    } else if (billingType === 'lifetime') {
      setBillingType(selectedPlan === 'starter' ? 'six_months' : 'annual');
    }
  }, [billingType, selectedPlan]);

  function isBlockedEmailDomain(value: string) {
    const domain = value.split('@')[1] || '';
    const blocked = new Set(['example.com', 'test.com', 'fake.com', 'mailinator.com', 'tempmail.com', '10minutemail.com', 'yopmail.com', 'invalid.com']);
    return blocked.has(domain) || domain.endsWith('.test') || domain.endsWith('.invalid') || domain.includes('fake');
  }

  function emailStatusBadge() {
    if (emailVerificationStatus === 'verified' && verifiedEmail === email) return 'Vérifié';
    if (emailVerificationStatus === 'sent') return 'Code envoyé';
    return 'Non vérifié';
  }

  async function requestEmailVerification() {
    const normalized = normalizeEmail(email);
    if (!validateEmail(normalized)) {
      notify({ title: 'Email invalide', message: 'Veuillez saisir une adresse email valide.', type: 'warning' });
      return;
    }
    if (isBlockedEmailDomain(normalized)) {
      notify({ title: 'Email invalide', message: 'Ce domaine email n’est pas accepté.', type: 'warning' });
      return;
    }
    if (!supabase || !isSupabaseConfigured) {
      notify({ title: 'Supabase indisponible', message: 'Impossible d’envoyer le code.', type: 'warning' });
      return;
    }
    setSendingCode(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      const webhookUrl = (import.meta.env.VITE_ACCESS_REQUEST_EMAIL_WEBHOOK as string | undefined)?.trim()
        || (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/request-email-verification` : '');
      if (!webhookUrl) throw new Error('Configuration email manquante.');
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(anonKey ? { apikey: anonKey } : {}),
        },
        body: JSON.stringify({ email: normalized }),
      });
      const rawBody = await response.text();
      let payload: { ok?: boolean; success?: boolean; test_mode?: boolean; otp_code?: string; error?: string; details?: string } = {};
      try {
        payload = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        payload = { ok: false, error: rawBody || 'Réponse Edge Function invalide.' };
      }
      if (import.meta.env.DEV) console.log('request-email-verification response', { status: response.status, body: payload });
      const readableError = payload.error === 'Attendez une minute avant de renvoyer un code.'
        ? 'Un code vient déjà d’être envoyé. Patientez une minute avant de renvoyer.'
        : payload.error;
      if (!response.ok) throw new Error(readableError || payload.details || `HTTP ${response.status}`);
      if (payload?.ok === false || payload?.error) throw new Error(readableError || 'Envoi code impossible.');
      const canUseReturnedOtp = isEmailTestMode && payload?.test_mode && payload.otp_code;
      setEmail(normalized);
      setEmailVerificationStatus('sent');
      setEmailVerificationCode(canUseReturnedOtp ? payload.otp_code || '' : '');
      notify({
        title: canUseReturnedOtp ? 'Code généré en test' : 'Code envoyé',
        message: canUseReturnedOtp ? `Mode test: utilisez le code ${payload.otp_code}.` : 'Code envoyé. Vérifiez votre boîte mail.',
        type: 'success',
      });
    } catch (error) {
      notify({ title: 'Envoi code impossible', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setSendingCode(false);
    }
  }

  async function verifyEmailCode() {
    const normalized = normalizeEmail(email);
    const code = emailVerificationCode.replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) {
      notify({ title: 'Code incorrect', message: 'Entrez le code à 6 chiffres.', type: 'warning' });
      return;
    }
    if (!supabase || !isSupabaseConfigured) return;
    setVerifyingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-email-code', { body: { email: normalized, code } });
      if (error) throw error;
      const payload = data as { success?: boolean; verifiedAt?: string; error?: string };
      if (!payload?.success) throw new Error(payload?.error || 'Code incorrect');
      setVerifiedEmail(normalized);
      setVerifiedAt(payload.verifiedAt || new Date().toISOString());
      setEmailVerificationStatus('verified');
      notify({ title: 'Email vérifié', message: 'Vous pouvez envoyer la demande d’accès.', type: 'success' });
    } catch (error) {
      notify({ title: 'Vérification impossible', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setVerifyingCode(false);
    }
  }

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
      requested_vehicle_count: Number(form.get('vehicle_count') || 0),
      requested_user_count: Number(form.get('requested_user_count') || 1),
      selected_plan: selectedPlan,
      billing_type: billingType === 'six_months' ? 'monthly' : billingType,
      monthly_price: selectedOffer.price,
      annual_price: selectedOffer.price,
      plan_price: selectedOffer.price,
      plan_duration: selectedOffer.commitment,
      plan_vehicle_limit: MEKLOC_PLANS[selectedPlan].vehicleLimit,
      plan_user_limit: MEKLOC_PLANS[selectedPlan].userLimit,
      promo_code: sanitizeText(String(form.get('promo_code') || ''), 60),
      status: 'pending',
    };
    const selectedPlanDb = selectedPlan;
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
    if (isBlockedEmailDomain(payload.email)) {
      notify({ title: 'Email invalide', message: 'Ce domaine email n’est pas accepté.', type: 'warning' });
      setIsSubmitting(false);
      return;
    }
    if (emailVerificationStatus !== 'verified' || verifiedEmail !== payload.email) {
      notify({ title: 'Email non vérifié', message: 'Cliquez sur “Vérifier email” puis validez le code reçu.', type: 'warning' });
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
        email_verified: true,
        email_verified_at: verifiedAt || new Date().toISOString(),
      });
      if (error) throw error;
      const selectedPlanInfo = plans.find((plan) => plan.id === selectedPlanDb);
      sendAccessRequestAdminNotification({
        agencyName: payload.agency_name,
        ownerName: payload.owner_name,
        address: payload.address,
        city: payload.city,
        country: payload.country,
        email: payload.email,
        phone: `${payload.phone_country_code} ${payload.phone_number}`,
        websiteUrl: payload.website_url,
        selectedPlan: selectedPlanDb,
        planName: selectedPlanInfo?.name || selectedPlanDb,
        billingType: billingType === 'six_months' ? 'monthly' : billingType,
        vehicleCount: payload.vehicle_count,
        promoCode: payload.promo_code,
        emailVerifiedAt: verifiedAt || new Date().toISOString(),
        termsAccepted: acceptedTerms,
      }).then((result) => {
        if (!result.sent && import.meta.env.DEV) console.warn('Admin access request email not sent', result);
      }).catch((notificationError) => {
        if (import.meta.env.DEV) console.warn('Admin access request email failed', notificationError);
      });
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


  const inputClass = '!h-12 !rounded-xl !border-white/10 !bg-black/40 !text-white placeholder:!text-zinc-500 focus:!border-[#E3B117]/60 focus:!ring-[#E3B117]/20';
  const fieldLabelClass = 'text-sm font-semibold text-zinc-200';

  return (
    <div className="min-h-[100svh] max-w-full overflow-x-hidden overscroll-x-none bg-[#050606] pb-[env(safe-area-inset-bottom)] text-white [-webkit-tap-highlight-color:transparent]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_76%_8%,rgba(227,177,23,.17),transparent_34%),radial-gradient(circle_at_36%_44%,rgba(227,177,23,.10),transparent_36%),linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:auto,auto,64px_64px,64px_64px]" />

      <div className="relative mx-auto w-full max-w-[1200px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pb-10 md:py-10 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="min-w-0">
            <img src="/mekloc-logo-transparent.png" alt="MekLoc" className="h-12 w-auto max-w-[165px] object-contain" />
          </Link>
          <button type="button" onClick={returnToLogin} className="inline-flex items-center gap-2 rounded-full border border-[#E3B117]/20 bg-[#E3B117]/8 px-3 py-2 text-sm font-black text-[#F5C542] transition hover:border-[#E3B117]/40 hover:bg-[#E3B117]/12">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Retour à la connexion</span>
            <span className="sm:hidden">Connexion</span>
          </button>
        </header>

        <div className="mx-auto mt-9 max-w-3xl text-center sm:mt-12">
          <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-[#F5C542]/35 bg-[#E3B117]/12 px-4 py-2 text-xs font-black text-[#F5C542] shadow-[0_0_35px_rgba(227,177,23,.12)]">
            <Sparkles className="h-4 w-4" />
            7 jours gratuits · Sans carte bancaire
          </div>
          <span className="inline-flex rounded-full border border-[#E3B117]/30 bg-[#E3B117]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#F5C542]">
            Demande d’accès
          </span>
          <h1 className="mt-5 text-[34px] font-black leading-tight text-white sm:text-5xl">Créez votre accès MekLoc</h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-zinc-400">
            Choisissez votre plan et envoyez votre demande. Notre équipe valide votre accès rapidement.
          </p>
          {fromLogin ? <p className="mt-3 text-sm font-semibold text-[#F5C542]">Votre compte n’est pas encore activé. Remplissez cette demande pour obtenir l’accès.</p> : null}
        </div>

        <div className="mt-9 grid min-w-0 gap-6 lg:grid-cols-[0.38fr_0.62fr] lg:items-start">
          <aside className="grid min-w-0 gap-5">
            <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,.42)] backdrop-blur-xl sm:p-6">
              <h2 className="text-lg font-black">1. Choisissez votre plan</h2>
              <div className="mt-5 grid grid-cols-3 rounded-2xl border border-white/10 bg-black/40 p-1">
                <button type="button" onClick={() => { setBillingType('six_months'); setSelectedPlan('starter'); }} className={`rounded-xl px-3 py-2.5 text-sm font-black transition ${billingType === 'six_months' ? 'bg-[#E3B117] text-[#070807]' : 'text-zinc-400 hover:text-white'}`}>6 mois</button>
                <button type="button" onClick={() => { setBillingType('annual'); if (selectedPlan === 'starter' || selectedPlan === 'lifetime') setSelectedPlan('pro'); }} className={`rounded-xl px-3 py-2.5 text-sm font-black transition ${billingType === 'annual' ? 'bg-[#E3B117] text-[#070807]' : 'text-zinc-400 hover:text-white'}`}>12 mois</button>
                <button type="button" onClick={() => setSelectedPlan('lifetime')} className={`rounded-xl px-3 py-2.5 text-sm font-black transition ${billingType === 'lifetime' ? 'bg-[#E3B117] text-[#070807]' : 'text-zinc-400 hover:text-white'}`}>Lifetime</button>
              </div>

              <div className="mt-5 grid gap-3">
                {plans.filter((plan) => billingType === 'lifetime' ? plan.id === 'lifetime' : plan.id !== 'lifetime').map((plan) => {
                  const active = selectedPlan === plan.id;
                  const isLifetime = plan.id === 'lifetime';
                  const offer = getPlanOffer(plan.id, billingType);
                  const price = offer.price;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlan(plan.id);
                        if (plan.id === 'lifetime') setBillingType('lifetime');
                        if (plan.id === 'starter') setBillingType('six_months');
                        if (plan.id === 'pro' || plan.id === 'business') setBillingType('annual');
                      }}
                      className={`relative rounded-2xl border p-5 text-left transition ${
                        active
                          ? 'border-[#E3B117]/60 bg-[#E3B117]/5 shadow-[0_0_50px_rgba(227,177,23,0.12)]'
                          : 'border-white/10 bg-black/30 hover:border-white/20'
                      }`}
                    >
                      <span className={`absolute right-4 top-4 grid h-5 w-5 place-items-center rounded-full border ${active ? 'border-[#E3B117] bg-[#E3B117] text-[#070807]' : 'border-white/20 text-transparent'}`}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                      {offer.badge ? <span className="absolute right-12 top-4 rounded-full bg-[#E3B117] px-2.5 py-1 text-[10px] font-black text-[#070807]">{offer.badge}</span> : null}
                      <h3 className="text-xl font-black">{offer.name}</h3>
                      <p className="mt-1 text-sm text-zinc-400">{plan.note}</p>
                      <p className="mt-5 text-4xl font-black">
                        {price.toLocaleString('fr-FR')} MAD
                        <span className="ml-1 text-base font-semibold text-zinc-500">{offer.packageLabel}</span>
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[#F5C542]">{offer.equivalentLabel}</p>
                      <p className="mt-1 text-xs font-bold text-zinc-500">{offer.commitment}</p>
                      <p className="mt-3 text-sm font-bold text-zinc-200">{plan.usersLabel} · {plan.vehiclesLabel}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-zinc-500">{plan.commitment}</p>
                      <div className="mt-5 space-y-2.5">
                        {plan.features.map((feature) => (
                          <p key={feature} className="flex items-center gap-2 text-sm text-zinc-300">
                            <CheckCircle2 className="h-4 w-4 text-[#F5C542]" />
                            {feature}
                          </p>
                        ))}
                      </div>
                      <span className={`mt-5 block rounded-xl px-4 py-3 text-center text-sm font-black ${active ? 'bg-[#E3B117] text-[#070807]' : 'border border-white/10 bg-white/[0.04] text-white'}`}>
                        {isLifetime ? 'Nous contacter' : `Choisir ${plan.name}`}
                      </span>
                      {!isLifetime ? <span className="mt-2 block text-center text-xs font-bold text-[#F5C542]">Inclut 7 jours d’essai gratuit</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-zinc-950/75 p-6 shadow-[0_24px_80px_rgba(0,0,0,.34)] backdrop-blur-xl">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#E3B117]/25 bg-[#E3B117]/10 text-[#F5C542]">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-lg font-black">Validation rapide</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">Après l’envoi, nous vérifions votre demande et activons votre espace.</p>
              <div className="mt-5 grid gap-3 text-sm font-semibold text-zinc-300">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#F5C542]" />Engagement minimum 6 mois</span>
                <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-[#F5C542]" />Support WhatsApp</span>
                <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-[#F5C542]" />Données sécurisées</span>
              </div>
              <a href="https://wa.me/212762971653" target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#F5C542] hover:text-[#F8D766]">
                <MessageCircle className="h-4 w-4" />
                Besoin d’aide ? Contactez-nous sur WhatsApp
              </a>
            </div>
          </aside>

          <form className="min-w-0 rounded-3xl border border-white/10 bg-zinc-950/80 shadow-[0_0_80px_rgba(0,0,0,0.45)] backdrop-blur-xl" onSubmit={handleSubmit}>
            <div className="border-b border-white/10 p-5 sm:p-7 md:p-8">
              <h2 className="text-xl font-black">2. Informations de l’agence</h2>

              <div className="mt-8">
                <div className="flex items-center gap-4">
                  <h3 className="shrink-0 text-base font-black">Agence</h3>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Field label="Nom de l’agence *" name="agency_name" required placeholder="Ex: MekLoc Location" className={inputClass} />
                  <Field label="Responsable *" name="owner_name" required placeholder="Ex: Younes Mekki" className={inputClass} />
                  <Field label="Adresse *" name="address" required placeholder="Ex: 123, Avenue Hassan II" className={`${inputClass} md:col-span-2`} />
                  <SelectField
                    label="Pays *"
                    name="country"
                    value={country}
                    className={inputClass}
                    onChange={(e) => {
                      const nextCountry = e.target.value;
                      setCountry(nextCountry);
                      setPhoneCountryCode(countryDialCode[nextCountry] || '+000');
                    }}
                    required
                  >
                    {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </SelectField>
                  {country === 'Maroc' ? (
                    <SelectField label="Ville *" name="city" defaultValue="" required className={inputClass}>
                      <option value="" disabled>Choisir une ville</option>
                      {moroccoCities.map((c) => <option key={c} value={c}>{c}</option>)}
                    </SelectField>
                  ) : (
                    <Field label="Ville *" name="city" required placeholder="Ex: Casablanca" className={inputClass} />
                  )}
                  <Field label="Site web / Instagram / Réseau social" name="website_url" placeholder="https://votre-site.com ou @votrecompte" className={`${inputClass} md:col-span-2`} />
                </div>
              </div>

              <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-5">
                <div className="flex items-center gap-4">
                  <h3 className="shrink-0 text-base font-black">Contact</h3>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <div className="mt-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className={fieldLabelClass}>Email *</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${
                      emailVerificationStatus === 'verified' && verifiedEmail === email
                        ? 'bg-emerald-400/15 text-emerald-200'
                        : emailVerificationStatus === 'sent'
                          ? 'bg-[#E3B117]/15 text-[#F5C542]'
                          : 'bg-rose-400/15 text-rose-100'
                    }`}>
                      {emailStatusBadge()}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      className={`form-control focus-ring w-full text-base sm:text-sm ${inputClass}`}
                      name="email"
                      type="email"
                      value={email}
                      placeholder="votre@email.com"
                      required
                      onChange={(event) => {
                        const nextEmail = normalizeEmail(event.target.value);
                        setEmail(nextEmail);
                        setEmailVerificationCode('');
                        if (nextEmail !== verifiedEmail) setEmailVerificationStatus('idle');
                      }}
                      onInvalid={(event) => event.currentTarget.setCustomValidity('Veuillez saisir une adresse email valide.')}
                      onInput={(event) => event.currentTarget.setCustomValidity('')}
                    />
                    <Button type="button" variant="secondary" className="h-12 rounded-xl border-white/10 bg-white/[0.06] px-5" loading={sendingCode} onClick={requestEmailVerification}>
                      Vérifier email
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    {isEmailTestMode
                      ? 'Mode test : le code est affiché ici, aucun email n’est envoyé.'
                      : 'Un code à 6 chiffres sera envoyé à cette adresse.'}
                  </p>
                  {emailVerificationStatus === 'sent' || emailVerificationStatus === 'verified' ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <input
                        className={`form-control focus-ring w-full text-base tracking-[0.18em] sm:text-sm ${inputClass}`}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Code à 6 chiffres"
                        value={emailVerificationCode}
                        disabled={emailVerificationStatus === 'verified' && verifiedEmail === email}
                        onChange={(event) => setEmailVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      />
                      <Button
                        type="button"
                        className="h-12 rounded-xl px-5"
                        loading={verifyingCode}
                        disabled={emailVerificationStatus === 'verified' && verifiedEmail === email}
                        onClick={verifyEmailCode}
                      >
                        Valider le code
                      </Button>
                    </div>
                  ) : null}
                  {isEmailTestMode && emailVerificationStatus === 'sent' && emailVerificationCode ? (
                    <p className="mt-3 rounded-xl border border-[#E3B117]/20 bg-[#E3B117]/10 px-3 py-2 text-xs font-semibold text-[#F5C542]">
                      Mode test uniquement — ne pas utiliser en production.
                    </p>
                  ) : null}
                </div>

                <div className="mt-6 grid grid-cols-[104px_minmax(0,1fr)] gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <Field label="Indicatif *" name="phone_country_code" value={phoneCountryCode} onChange={(e) => setPhoneCountryCode(e.target.value)} required className={inputClass} />
                  <Field
                    label="Numéro de téléphone *"
                    name="phone_number"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{6,15}"
                    maxLength={15}
                    placeholder="6 12 34 56 78"
                    className={inputClass}
                    onInput={(event) => {
                      const target = event.currentTarget;
                      target.value = target.value.replace(/\D/g, '');
                      target.setCustomValidity('');
                    }}
                    onInvalid={(event) => event.currentTarget.setCustomValidity('Le numéro doit contenir uniquement des chiffres (6 à 15).')}
                  />
                </div>
              </div>

              <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-5">
                <div className="flex items-center gap-4">
                  <h3 className="shrink-0 text-base font-black">Détails</h3>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Field label="Nombre de véhicules *" name="vehicle_count" type="number" min={1} required placeholder="Ex: 10" className={inputClass} onChange={(event) => setRequestedVehicleCount(Number(event.target.value) || 0)} />
                  <Field label="Nombre d’utilisateurs souhaité *" name="requested_user_count" type="number" min={1} required value={String(requestedUserCount)} onChange={(event) => setRequestedUserCount(Number(event.target.value) || 1)} className={inputClass} />
                  <Field label="Code promo (optionnel)" name="promo_code" placeholder="Ex: MEKLOC10" className={inputClass} />
                </div>
                <div className="mt-4 rounded-2xl border border-[#E3B117]/25 bg-[#E3B117]/10 p-4 text-sm text-zinc-200">
                  <div className="grid gap-2 sm:grid-cols-2"><span>Prix : <strong className="text-white">{selectedOffer.price.toLocaleString('fr-FR')} MAD {selectedOffer.packageLabel}</strong></span><span>Engagement : <strong className="text-white">{selectedOffer.commitment}</strong></span><span>Véhicules : <strong className="text-white">jusqu’à {selectedPlanConfig.vehicleLimit}</strong></span><span>Utilisateurs : <strong className="text-white">{selectedPlanConfig.userLimit ?? 'illimités'}</strong></span></div>
                  {requestedVehicleCount > selectedPlanConfig.vehicleLimit ? <p className="mt-3 font-semibold text-amber-200">{selectedPlan === 'starter' ? 'Le plan Starter inclut jusqu’à 7 véhicules. Pour plus de véhicules, choisissez Pro ou contactez MekLoc.' : selectedPlan === 'pro' ? 'Le plan Pro inclut jusqu’à 20 véhicules. Pour plus de véhicules, choisissez Business.' : selectedPlan === 'business' ? 'Le plan Business inclut jusqu’à 50 véhicules. Pour plus de véhicules, contactez MekLoc.' : 'Le plan Lifetime inclut jusqu’à 100 véhicules. Contactez MekLoc pour une flotte plus importante.'}</p> : null}
                </div>
              </div>
            </div>

            <div className="p-5 pb-4 sm:p-7 md:p-8">
              <h2 className="text-xl font-black">3. Conditions</h2>
              <label className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-4 text-sm leading-6 text-zinc-300">
                <input type="checkbox" className="mt-1 h-4 w-4 rounded border border-[#E3B117]/70 bg-transparent accent-[#E3B117]" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required />
                <span>
                  J’ai lu et j’accepte les{' '}
                  <Link to="/conditions-utilisation" target="_blank" className="font-semibold text-[#F5C542] hover:text-[#F8D766]">conditions d’utilisation</Link>, la{' '}
                  <Link to="/politique-confidentialite" target="_blank" className="font-semibold text-[#F5C542] hover:text-[#F8D766]">politique de confidentialité</Link>,
                  ainsi que la{' '}
                  <Link to="/annulation-remboursement" target="_blank" className="font-semibold text-[#F5C542] hover:text-[#F8D766]">politique d’annulation et de remboursement</Link>.
                </span>
              </label>
            </div>

            <div className="relative z-10 border-t border-[#E3B117]/20 bg-[#090a0b] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_35px_rgba(0,0,0,.5)] sm:border-t-0 sm:bg-transparent sm:px-7 sm:pb-7 sm:pt-0 sm:shadow-none md:px-8 md:pb-8">
              <Button
                type="submit"
                className="h-14 w-full rounded-2xl !border-[#f2cd59] !bg-[#E3B117] text-base font-black !text-[#070807] shadow-[0_14px_38px_rgba(227,177,23,.28)] hover:!bg-[#F5C542] active:scale-[0.99] disabled:!cursor-wait disabled:!opacity-100"
                loading={isSubmitting}
                icon={<Send className="h-5 w-5" />}
              >
                Envoyer la demande d’accès
              </Button>
              {emailVerificationStatus !== 'verified' || verifiedEmail !== email ? (
                <p className="mt-2 text-center text-xs font-semibold text-[#e7c65a]">
                  Vérifiez votre email avant l’envoi final.
                </p>
              ) : null}
              <p className="mt-2 flex items-center justify-center gap-2 text-center text-xs text-zinc-500 sm:mt-4">
                <LockKeyhole className="h-4 w-4" />
                Vos données sont sécurisées et ne seront jamais partagées.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
