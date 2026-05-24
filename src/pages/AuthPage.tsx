import { ArrowLeft, BarChart3, BellRing, CalendarDays, DatabaseZap, Eye, EyeOff, Globe2, HelpCircle, LockKeyhole, Mail, MessageCircle, ShieldCheck, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getPostLoginRedirect } from '../lib/authRedirect';
import { supabase } from '../lib/supabase';

function hasPasswordFlowInUrl() {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  return (
    hash.includes('type=recovery') ||
    hash.includes('type=invite') ||
    search.includes('type=recovery') ||
    search.includes('type=invite') ||
    search.includes('mode=set-password')
  );
}

type LoginMemberLookup = {
  found: boolean;
  email: string;
  accountStatus: string;
  agencyName: string;
  agencyPhone: string;
  agencyEmail: string;
};

const rememberedEmailsKey = 'mekloc-remembered-login-emails';

function normalizeWhatsAppPhone(phone: string | null | undefined) {
  const compact = String(phone || '').replace(/[^\d+]/g, '');
  if (!compact) return '';
  if (compact.startsWith('+')) return compact.slice(1);
  if (compact.startsWith('00')) return compact.slice(2);
  if (compact.startsWith('0')) return `212${compact.slice(1)}`;
  return compact;
}

function buildAgencyWhatsAppUrl(member: LoginMemberLookup | null) {
  const phone = normalizeWhatsAppPhone(member?.agencyPhone);
  if (!phone || !member) return '';
  const text = encodeURIComponent(`Bonjour ${member.agencyName}, je n'arrive pas à activer mon compte MekLoc avec ${member.email}. Pouvez-vous m'envoyer le lien d'activation ?`);
  return `https://wa.me/${phone}?text=${text}`;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function readRememberedEmails() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(rememberedEmailsKey) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

function writeRememberedEmails(emails: string[]) {
  window.localStorage.setItem(rememberedEmailsKey, JSON.stringify(emails.slice(0, 5)));
}

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetMode, setResetMode] = useState(() => hasPasswordFlowInUrl());
  const [newPassword, setNewPassword] = useState('');
  const [loginStep, setLoginStep] = useState<'email' | 'password'>('email');
  const [loginEmail, setLoginEmail] = useState(searchParams.get('email') || '');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [memberLoginHint, setMemberLoginHint] = useState<LoginMemberLookup | null>(null);
  const [rememberedEmails, setRememberedEmails] = useState<string[]>(readRememberedEmails);
  const [emailSuggestionsOpen, setEmailSuggestionsOpen] = useState(false);
  const navigate = useNavigate();
  const { notify } = useApp();
  const {
    signIn,
    signInWithGoogle,
    refreshProfile,
    isSupabaseEnabled,
    requestPasswordReset,
    updatePassword,
    getAccessRequestStatusByEmail,
    loading: authLoading,
    profile,
    session,
  } = useAuth();
  const forceLogin = searchParams.get('force') === 'login';

  useEffect(() => {
    if (hasPasswordFlowInUrl()) setResetMode(true);
  }, []);

  useEffect(() => {
    if (forceLogin) return;
    if (resetMode || authLoading || !session) return;
    if (isSupabaseEnabled && !profile) return;
    navigate(getPostLoginRedirect(profile, isSupabaseEnabled), { replace: true });
  }, [authLoading, forceLogin, isSupabaseEnabled, navigate, profile, resetMode, session]);

  useEffect(() => {
    if (searchParams.get('approved') === '1') {
      notify({
        title: 'Accès approuvé',
        message: 'Votre accès est validé. Connectez-vous avec votre email et mot de passe.',
        type: 'success',
      });
    }
    if (searchParams.get('revoked') === '1') {
      notify({
        title: 'Session déconnectée',
        message: 'Votre session a été déconnectée par l’administrateur.',
        type: 'warning',
      });
      window.history.replaceState(null, '', '/auth');
    }
  }, [notify, searchParams]);

  function rememberLoginEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    setRememberedEmails((current) => {
      const next = [normalized, ...current.filter((item) => item !== normalized)].slice(0, 5);
      writeRememberedEmails(next);
      return next;
    });
  }

  function removeRememberedEmail(email: string) {
    setRememberedEmails((current) => {
      const next = current.filter((item) => item !== email);
      writeRememberedEmails(next);
      return next;
    });
  }

  function handleEmailChange(value: string) {
    setLoginEmail(value);
    setMemberLoginHint(null);
    setEmailSuggestionsOpen(true);
  }

  function renderRememberedEmailField() {
    const showSuggestions = emailSuggestionsOpen && rememberedEmails.length > 0;
    return (
      <label className="relative grid gap-2 text-sm font-semibold text-white">
        <span>Email</span>
        <span className="relative block">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/55" />
          <input
            className="h-14 w-full rounded-xl border border-white/10 bg-black/40 pl-12 pr-4 text-base text-white outline-none transition placeholder:text-white/32 focus:border-yellow-500/60 focus:ring-4 focus:ring-yellow-500/20"
            name="email"
            type="email"
            placeholder="votre@email.com"
            value={loginEmail}
            autoComplete="email"
            onFocus={() => setEmailSuggestionsOpen(true)}
            onBlur={() => window.setTimeout(() => setEmailSuggestionsOpen(false), 140)}
            onChange={(e) => handleEmailChange(e.target.value)}
            required
          />
        </span>
        {showSuggestions ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-carbon-950/98 shadow-2xl backdrop-blur light:bg-white">
            {rememberedEmails.map((email) => (
              <button
                key={email}
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-carbon-200 transition hover:bg-white/[0.06] light:text-carbon-800 light:hover:bg-carbon-950/5"
                onPointerDown={(event) => event.preventDefault()}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setLoginEmail(email);
                  setMemberLoginHint(null);
                  setEmailSuggestionsOpen(false);
                }}
              >
                <span className="truncate">{email}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-carbon-400 hover:bg-white/10 hover:text-white light:hover:bg-carbon-950/10 light:hover:text-carbon-950"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeRememberedEmail(email);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </label>
    );
  }

  async function lookupAgencyMemberForLogin(email: string): Promise<LoginMemberLookup | null> {
    const normalized = email.trim().toLowerCase();
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const configuredWebhook = import.meta.env.VITE_LOOKUP_LOGIN_EMAIL_WEBHOOK as string | undefined;
    const endpoint = configuredWebhook || (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/lookup-login-email` : '');
    if (!endpoint || !anonKey || !normalized) return null;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ email: normalized }),
      });
      const payload = await response.json().catch(() => null) as Partial<LoginMemberLookup> | null;
      if (!response.ok || !payload?.found) return null;
      return {
        found: true,
        email: String(payload.email || normalized),
        accountStatus: String(payload.accountStatus || 'pending'),
        agencyName: String(payload.agencyName || 'votre agence'),
        agencyPhone: String(payload.agencyPhone || ''),
        agencyEmail: String(payload.agencyEmail || ''),
      };
    } catch {
      return null;
    }
  }

  function notifyMemberNeedsActivation(member: LoginMemberLookup) {
    notify({
      title: 'Activation requise',
      message: member.agencyPhone
        ? `Ce compte est lié à ${member.agencyName}. Demandez le lien d’activation au ${member.agencyPhone}.`
        : `Ce compte est lié à ${member.agencyName}. Demandez à votre agence de générer le lien d’activation.`,
      type: 'warning',
    });
  }

  async function handleEmailStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = loginEmail.trim().toLowerCase();
    if (!email) return;
    setLoading(true);
    try {
      const request = await getAccessRequestStatusByEmail(email);
      if (request) {
        if (request.status === 'approved') {
          notify({
            title: 'Accès approuvé',
            message: 'Votre demande est approuvée. Saisissez maintenant votre mot de passe.',
            type: 'success',
          });
          setLoginStep('password');
          return;
        }
        if (request.status === 'payment_pending') return navigate('/payment-required', { replace: true });
        if (request.status === 'rejected') return navigate('/account-status', { replace: true });
        if (['pending', 'pending_verification', 'contacted', 'verified'].includes(request.status)) {
          notify({
            title: 'Demande en cours',
            message: 'Votre demande est toujours en traitement. Consultez la page de vérification pour le suivi.',
            type: 'info',
          });
          return navigate(`/verification-en-cours?email=${encodeURIComponent(email)}&agency=${encodeURIComponent(request.agencyName)}&plan=${encodeURIComponent(request.plan)}&created_at=${encodeURIComponent(request.createdAt)}${request.status === 'contacted' ? `&note=${encodeURIComponent('Notre équipe vous a contacté ou vous contactera bientôt.')}` : ''}`, { replace: true });
        }
      }
      const memberLookup = await lookupAgencyMemberForLogin(email);
      if (memberLookup) {
        setMemberLoginHint(memberLookup);
        setLoginStep('password');
        notify({
          title: 'Compte membre trouvé',
          message: `Saisissez votre mot de passe. Si vous ne l’avez pas encore défini, contactez ${memberLookup.agencyName}.`,
          type: 'info',
        });
        return;
      }
      if (supabase) {
        const { data: profileRow } = await supabase
          .from('users_profiles')
          .select('id,email,account_status')
          .eq('email', email)
          .limit(1)
          .maybeSingle();
        if (profileRow) setMemberLoginHint(null);
      }
      setMemberLoginHint(null);
      setLoginStep('password');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const email = loginEmail.trim().toLowerCase();
    const password = String(form.get('password'));

    try {
      const result = await signIn(email, password);

      if (result.needsEmailConfirmation) {
        notify({
          title: 'Compte créé',
          message: 'Vérifiez votre email pour confirmer le compte, puis connectez-vous pour terminer l’onboarding.',
          type: 'success',
        });
        return;
      }
      if (result.approvedProfileRepairNeeded) {
        notify({
          title: 'Profil agence à réparer',
          message: "Votre accès est approuvé, mais le profil agence n’est pas encore lié. Déployez la fonction repair-approved-profile puis reconnectez-vous.",
          type: 'warning',
        });
        return;
      }

      const nextProfile = isSupabaseEnabled ? (result.profile ?? await refreshProfile()) : null;
      if (!nextProfile && isSupabaseEnabled) {
        const request = await getAccessRequestStatusByEmail(email);
        if (import.meta.env.DEV) {
          console.log('MekLoc login redirect decision', {
            email,
            profileFound: false,
            accessRequestStatus: request?.status ?? null,
            reason: request?.status === 'approved' ? 'approved_request_without_profile' : 'missing_profile',
          });
        }
        if (request?.status === 'approved') {
          notify({
            title: 'Profil agence introuvable',
            message: "Votre accès est approuvé, mais MekLoc ne trouve pas encore l’agence liée à ce compte. Réessayez ou contactez l’administrateur.",
            type: 'warning',
          });
          return;
        }
        if (request && ['pending', 'pending_verification', 'contacted', 'payment_pending', 'verified'].includes(request.status)) {
          navigate(`/verification-en-cours?email=${encodeURIComponent(email)}&agency=${encodeURIComponent(request.agencyName)}&plan=${encodeURIComponent(request.plan)}&created_at=${encodeURIComponent(request.createdAt)}${request.status === 'contacted' ? `&note=${encodeURIComponent('Notre équipe vous a contacté ou vous contactera bientôt.')}` : ''}`, { replace: true });
          return;
        }
        notify({
          title: 'Profil introuvable',
          message: "Connexion réussie, mais aucun profil agence n’est lié à ce compte. Vérifiez l’email utilisé ou demandez un nouveau lien d’activation.",
          type: 'warning',
        });
        return;
      }

      if (import.meta.env.DEV) {
        console.log('MekLoc login redirect decision', {
          email,
          userId: nextProfile?.id,
          profileFound: Boolean(nextProfile),
          agencyId: nextProfile?.agencyId,
          agencyFound: Boolean(nextProfile?.agency),
          accountStatus: nextProfile?.accountStatus,
          reason: nextProfile?.agencyId && nextProfile?.accountStatus === 'active' ? 'dashboard' : 'profile_status_or_agency',
        });
      }
      notify({
        title: 'Bon retour sur MekLoc',
        message: isSupabaseEnabled
          ? 'Votre session Supabase est active.'
          : 'Vous entrez en mode démo avec des données exemples.',
        type: 'success',
      });
      rememberLoginEmail(email);
      navigate(getPostLoginRedirect(nextProfile, isSupabaseEnabled), { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentification échouée';
      if (/Invalid login credentials/i.test(message)) {
        const request = await getAccessRequestStatusByEmail(email);
        if (request) {
          if (request.status === 'approved') {
            notify({
              title: 'Mot de passe incorrect',
              message: "Si vous n’avez pas encore défini votre mot de passe, utilisez le lien d’activation envoyé par votre agence.",
              type: 'warning',
            });
            return;
          }
          if (request.status === 'payment_pending') return navigate('/payment-required', { replace: true });
          if (request.status === 'rejected') return navigate('/account-status', { replace: true });
          if (['pending', 'pending_verification', 'contacted', 'payment_pending', 'verified'].includes(request.status)) {
            return navigate(`/verification-en-cours?email=${encodeURIComponent(email)}&agency=${encodeURIComponent(request.agencyName)}&plan=${encodeURIComponent(request.plan)}&created_at=${encodeURIComponent(request.createdAt)}${request.status === 'contacted' ? `&note=${encodeURIComponent('Notre équipe vous a contacté ou vous contactera bientôt.')}` : ''}`, { replace: true });
          }
        }
        if (supabase) {
          const normalized = email.trim().toLowerCase();
          const { data: profileRow } = await supabase
            .from('users_profiles')
            .select('id,account_status,email,agency_id')
            .eq('email', normalized)
            .limit(1)
            .maybeSingle();
          if (profileRow) {
            if (profileRow.account_status === 'active' && profileRow.agency_id) {
              notify({
                title: 'Mot de passe incorrect',
                message: 'Vérifiez votre mot de passe puis réessayez.',
                type: 'warning',
              });
              return;
            }
            notify({
              title: 'Activation requise',
              message: "Votre compte existe, mais le mot de passe n’est pas encore défini ou le compte n’est pas actif. Utilisez le lien d’activation ou contactez votre agence.",
              type: 'warning',
            });
            return;
          }
        }
        const memberLookup = await lookupAgencyMemberForLogin(email);
        if (memberLookup) {
          setMemberLoginHint(memberLookup);
          notifyMemberNeedsActivation(memberLookup);
          return;
        }
        notify({
          title: 'Connexion impossible',
          message: 'Email ou mot de passe incorrect.',
          type: 'warning',
        });
        return;
      }
      notify({
        title: 'Authentification échouée',
        message,
        type: 'warning',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (!isSupabaseEnabled) {
      notify({
        title: 'Mode démo actif',
        message: 'Ajoutez les variables Supabase pour activer Google.',
        type: 'info',
      });
      navigate('/dashboard');
      return;
    }

    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      notify({
        title: 'Connexion Google échouée',
        message: error instanceof Error ? error.message : 'Vérifiez la configuration Google provider dans Supabase.',
        type: 'warning',
      });
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!forgotEmail) return;
    try {
      await requestPasswordReset(forgotEmail);
      notify({ title: 'Email envoyé', message: 'Le lien de réinitialisation a été envoyé à votre adresse Gmail.', type: 'success' });
      setForgotOpen(false);
      setForgotEmail('');
    } catch (error) {
      notify({ title: 'Échec réinitialisation', message: error instanceof Error ? error.message : 'Réessayez plus tard.', type: 'warning' });
    }
  }

  async function handleSetNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) {
      notify({ title: 'Mot de passe trop court', message: 'Utilisez au moins 8 caractères.', type: 'warning' });
      return;
    }
    try {
      await updatePassword(newPassword);
      notify({ title: 'Mot de passe mis à jour', message: 'Vous pouvez vous reconnecter avec votre nouveau mot de passe.', type: 'success' });
      setResetMode(false);
      setNewPassword('');
      window.history.replaceState(null, '', '/auth');
    } catch (error) {
      notify({ title: 'Échec de mise à jour', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    }
  }

  const memberAgencyWhatsAppUrl = buildAgencyWhatsAppUrl(memberLoginHint);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050606] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden border-r border-yellow-500/10 bg-[#050606] px-10 py-8 lg:flex lg:flex-col xl:px-14">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_32%_74%,rgba(227,177,23,.26),transparent_42%),radial-gradient(circle_at_66%_38%,rgba(227,177,23,.14),transparent_34%)]" />
        <img
          src="/mekloc-hero-car.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-8 left-0 w-[92%] max-w-[920px] opacity-75 mix-blend-screen"
        />
        <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black via-black/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/72 to-black/36" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,.58)_78%)]" />
        <div className="relative z-10 flex items-center justify-between">
          <img src="/mekloc-logo-transparent.png" alt="MekLoc" className="h-16 w-auto max-w-[230px] object-contain" />
        </div>

        <div className="relative z-10 mt-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-black text-yellow-400 transition hover:text-yellow-300">
            <ArrowLeft className="h-4 w-4" />
            Retour à l’accueil
          </Link>
        </div>

        <div className="relative z-10 my-auto max-w-3xl py-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-yellow-400">
            <DatabaseZap className="h-4 w-4" />
            Plateforme sécurisée & professionnelle
          </div>
          <h1 className="max-w-3xl text-5xl font-black leading-[1.08] tracking-[-0.02em] text-white xl:text-6xl">
            Pilotez toute votre activité location depuis un espace{' '}
            <span className="bg-gradient-to-r from-yellow-300 via-yellow-500 to-amber-200 bg-clip-text text-transparent">sécurisé.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-300">
            Réservations, véhicules, clients, contrats, paiements, entretien et rapports sont prêts avec des données réalistes et sécurisées.
          </p>

          <div className="mt-16 grid grid-cols-4 gap-5">
            {[
              [CalendarDays, 'Tout centralisé', 'Gérez tout en un seul endroit'],
              [ShieldCheck, 'Données sécurisées', 'Hébergé en Europe & sauvegarde incluse'],
              [BellRing, 'Alertes intelligentes', 'Ne manquez aucun rappel important'],
              [BarChart3, 'Rapports avancés', 'Analysez et développez votre agence'],
            ].map(([Icon, title, text]) => (
              <div key={title as string}>
                <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-yellow-500/20 bg-yellow-500/10 text-yellow-400 shadow-[0_0_30px_rgba(227,177,23,.16)]">
                  <Icon className="h-6 w-6" />
                </div>
                <p className="text-sm font-black text-white">{title as string}</p>
                <p className="mt-2 text-xs leading-5 text-zinc-400">{text as string}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 rounded-2xl border border-white/10 bg-zinc-950/70 p-5 shadow-[0_0_46px_rgba(227,177,23,.08)] backdrop-blur">
          <div className="flex items-center gap-5">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-yellow-500/25 bg-yellow-500/10 text-yellow-400">
              <LockKeyhole className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-black text-white">Votre sécurité est notre priorité</p>
              <p className="mt-1 text-sm text-zinc-400">Vos données sont confidentielles et ne seront jamais partagées.</p>
            </div>
            <span className="hidden rounded-xl border border-yellow-500/15 bg-yellow-500/10 px-4 py-3 text-sm font-semibold text-zinc-300 xl:block">
              Hébergé en Europe — Conforme RGPD
            </span>
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen items-start justify-center px-4 pb-8 pt-5 sm:px-6 lg:items-center lg:px-10 lg:py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(227,177,23,.18),transparent_45%),linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.03)_1px,transparent_1px)] bg-[size:auto,48px_48px,48px_48px] lg:hidden" />
        {/* Place car image at public/images/login-car-bg.png */}
        <div className="absolute inset-x-0 top-[120px] h-[360px] bg-[url('/images/login-car-bg.png')] bg-contain bg-right-bottom bg-no-repeat opacity-45 lg:hidden" />
        <div className="absolute inset-x-0 top-[120px] h-[420px] bg-gradient-to-b from-black/30 via-black/60 to-[#050606] lg:hidden" />
        <div className="absolute right-6 top-5 z-10 hidden items-center gap-5 text-sm text-zinc-300 md:flex">
          <a href="https://wa.me/212762971653" target="_blank" rel="noreferrer" className="font-semibold transition hover:text-yellow-400">Besoin d’aide ?</a>
          <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 font-semibold">
            <Globe2 className="h-4 w-4" />
            FR
          </span>
        </div>

        <div className="relative z-10 w-full max-w-[460px]">
          <div className="mb-7 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <img src="/mekloc-logo-transparent.png" alt="MekLoc" className="h-14 w-auto max-w-[170px] object-contain" />
              <div className="flex items-center gap-2">
                <a href="https://wa.me/212762971653" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-yellow-500/25 bg-black/35 px-3 text-xs font-bold text-white backdrop-blur">
                  <HelpCircle className="h-4 w-4 text-yellow-400" />
                  Aide
                </a>
                <span className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/10 bg-black/35 px-3 text-xs font-bold text-white backdrop-blur">
                  <Globe2 className="h-4 w-4" />
                  FR
                </span>
              </div>
            </div>
            <Link to="/" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-yellow-400 hover:text-yellow-300">
              <ArrowLeft className="h-4 w-4" />
              Retour à l’accueil
            </Link>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-yellow-400">
              <ShieldCheck className="h-4 w-4" />
              Plateforme sécurisée & professionnelle
            </div>
            <h1 className="mt-8 text-4xl font-black leading-tight text-white">
              Espace sécurisé <span className="bg-gradient-to-r from-yellow-300 via-yellow-500 to-amber-200 bg-clip-text text-transparent">MekLoc</span>
            </h1>
            <p className="mt-4 max-w-sm text-lg leading-8 text-zinc-300">
              Connectez-vous pour gérer vos réservations, véhicules et contrats.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500/20 bg-black/35 px-4 py-3 text-sm font-bold text-white backdrop-blur">
                <ShieldCheck className="h-4 w-4 text-yellow-400" />
                Données sécurisées
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500/20 bg-black/35 px-4 py-3 text-sm font-bold text-white backdrop-blur">
                <DatabaseZap className="h-4 w-4 text-yellow-400" />
                100% Cloud
              </span>
            </div>
          </div>
          <div className="rounded-[32px] border border-yellow-500/30 bg-black/70 p-6 shadow-[0_0_70px_rgba(227,177,23,0.16),0_26px_90px_rgba(0,0,0,.42)] ring-1 ring-white/[0.035] backdrop-blur-xl sm:p-9 md:p-10">
            {resetMode ? (
              <form className="grid gap-4" onSubmit={handleSetNewPassword}>
                <div className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full border border-yellow-500/25 bg-yellow-500/15 text-yellow-400">
                  <LockKeyhole className="h-8 w-8" />
                </div>
                <h2 className="text-center text-3xl font-black">Nouveau mot de passe</h2>
                <p className="text-center text-sm text-zinc-400">Définissez votre nouveau mot de passe pour sécuriser votre compte.</p>
                <label className="grid gap-2 text-sm font-semibold text-white">
                  <span>Nouveau mot de passe</span>
                  <div className="relative">
                    <input className="h-14 w-full rounded-xl border border-white/10 bg-black/40 px-4 pr-12 text-base text-white outline-none transition placeholder:text-white/32 focus:border-yellow-500/60 focus:ring-4 focus:ring-yellow-500/20" name="newPassword" type={showResetPassword ? 'text' : 'password'} placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                    <button type="button" className="absolute inset-y-0 right-2 my-auto grid h-9 w-9 place-items-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white" onClick={() => setShowResetPassword((v) => !v)} aria-label={showResetPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                      {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                <Button type="submit" className="h-13 bg-yellow-500 text-black hover:bg-yellow-400" icon={<LockKeyhole className="h-4 w-4" />}>Mettre à jour le mot de passe</Button>
                <Button type="button" variant="secondary" onClick={() => { setResetMode(false); window.history.replaceState(null, '', '/auth'); }}>Retour à la connexion</Button>
              </form>
            ) : (
              <>
                <div className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full border border-yellow-500/25 bg-yellow-500/15 text-yellow-400 shadow-[0_0_45px_rgba(227,177,23,.16)]">
                  <LockKeyhole className="h-8 w-8" />
                </div>
                <h2 className="mt-7 text-center text-3xl font-black text-white">Se connecter</h2>
                <p className="mt-3 text-center text-base text-zinc-400">Accédez à votre espace MekLoc.</p>
                {loginStep === 'email' ? (
                  <form className="mt-9 grid gap-5" onSubmit={handleEmailStep}>
                    {renderRememberedEmailField()}
                    <Button type="submit" loading={loading} className="h-14 w-full rounded-2xl bg-yellow-500 text-base font-black text-black shadow-[0_18px_44px_rgba(227,177,23,.22)] hover:bg-yellow-400" icon={<Mail className="h-5 w-5" />}>Suivant</Button>
                  </form>
                ) : (
                  <form className="mt-9 grid gap-5" onSubmit={handleSubmit}>
                  {renderRememberedEmailField()}
                  <label className="grid gap-2 text-sm font-semibold text-white">
                    <span>Mot de passe</span>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/55" />
                      <input className="h-14 w-full rounded-xl border border-white/10 bg-black/40 pl-12 pr-12 text-base text-white outline-none transition placeholder:text-white/32 focus:border-yellow-500/60 focus:ring-4 focus:ring-yellow-500/20" name="password" type={showLoginPassword ? 'text' : 'password'} placeholder="••••••••" required />
                      <button type="button" className="absolute inset-y-0 right-2 my-auto grid h-9 w-9 place-items-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white" onClick={() => setShowLoginPassword((v) => !v)} aria-label={showLoginPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                  {memberLoginHint ? (
                    <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/10 p-4 text-sm text-zinc-200">
                      <p className="font-semibold text-white">Compte membre chez {memberLoginHint.agencyName}</p>
                      <p className="mt-1 text-zinc-400">
                        Si vous n’avez pas encore reçu le lien d’activation ou défini votre mot de passe, contactez votre agence.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {memberAgencyWhatsAppUrl ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="border-white/10 bg-white/[0.06]"
                            icon={<MessageCircle className="h-4 w-4" />}
                            onClick={() => window.open(memberAgencyWhatsAppUrl, '_blank', 'noopener,noreferrer')}
                          >
                            Contacter l’agence
                          </Button>
                        ) : null}
                        {memberLoginHint.agencyPhone ? (
                          <span className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-3 py-2 font-semibold text-yellow-100">
                            {memberLoginHint.agencyPhone}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-[0.35fr_0.65fr]">
                    <Button type="button" variant="secondary" className="h-14 border-white/10 bg-white/[0.06]" onClick={() => { setLoginStep('email'); setMemberLoginHint(null); }}>Retour</Button>
                    <Button type="submit" loading={loading} className="h-14 rounded-2xl bg-yellow-500 text-base font-black text-black hover:bg-yellow-400" icon={<Mail className="h-5 w-5" />}>Se connecter</Button>
                  </div>
                </form>
                )}
                <div className="my-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  <span className="h-px flex-1 bg-white/10" />
                  OU
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-14 w-full rounded-2xl border-white/10 bg-zinc-900/70 text-base hover:border-yellow-500/30"
                  icon={<GoogleIcon />}
                  loading={loading}
                  onClick={handleGoogleLogin}
                >
                  Connexion avec Google
                </Button>
                <button type="button" className="mt-6 text-sm font-bold text-yellow-400 hover:text-yellow-300" onClick={() => setForgotOpen(true)}>
                  Mot de passe oublié ?
                </button>
                <p className="mt-5 text-sm text-zinc-400">Pas encore client ? <Link to="/demande-acces" className="font-bold text-yellow-400">Demander un accès</Link></p>
              </>
            )}
          </div>
          <div className="mt-7 rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur lg:hidden">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-yellow-500/25 bg-yellow-500/10 text-yellow-400">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-black text-white">Votre sécurité est notre priorité</p>
                <p className="mt-1 text-sm leading-6 text-zinc-400">Vos données sont confidentielles et ne seront jamais partagées.</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-yellow-500/15 bg-yellow-500/10 px-4 py-3 text-sm font-semibold text-zinc-300">
              Hébergé en Europe — Conforme RGPD
            </div>
          </div>
        </div>
      </section>
      </div>
      <Modal open={forgotOpen} onClose={() => setForgotOpen(false)} title="Réinitialiser le mot de passe">
        <div className="space-y-4">
          <p className="text-sm text-carbon-400">
            Entrez votre adresse email professionnelle. Nous vous enverrons un lien sécurisé pour définir un nouveau mot de passe.
          </p>
          <Field
            label="Adresse email"
            name="forgotEmail"
            type="email"
            placeholder="younesmekki100@gmail.com"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setForgotOpen(false)}>Annuler</Button>
            <Button type="button" onClick={handleForgotPassword}>Envoyer le lien</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
