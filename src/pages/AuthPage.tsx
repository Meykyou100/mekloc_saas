import { ArrowLeft, Chrome, Eye, EyeOff, LockKeyhole, Mail, MessageCircle } from 'lucide-react';
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

  useEffect(() => {
    if (hasPasswordFlowInUrl()) setResetMode(true);
  }, []);

  useEffect(() => {
    if (resetMode || authLoading || !session) return;
    navigate(getPostLoginRedirect(profile, isSupabaseEnabled), { replace: true });
  }, [authLoading, isSupabaseEnabled, navigate, profile, resetMode, session]);

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

      const nextProfile = isSupabaseEnabled ? (result.profile ?? await refreshProfile()) : null;
      if (!nextProfile && isSupabaseEnabled) {
        const request = await getAccessRequestStatusByEmail(email);
        if (request && ['pending', 'pending_verification', 'contacted', 'payment_pending', 'verified'].includes(request.status)) {
          navigate(`/verification-en-cours?email=${encodeURIComponent(email)}&agency=${encodeURIComponent(request.agencyName)}&plan=${encodeURIComponent(request.plan)}&created_at=${encodeURIComponent(request.createdAt)}${request.status === 'contacted' ? `&note=${encodeURIComponent('Notre équipe vous a contacté ou vous contactera bientôt.')}` : ''}`, { replace: true });
          return;
        }
        navigate(`/demande-acces?email=${encodeURIComponent(email)}&from=login`, { replace: true });
        return;
      }

      notify({
        title: 'Bon retour sur MekLoc',
        message: isSupabaseEnabled
          ? 'Votre session Supabase est active.'
          : 'Vous entrez en mode démo avec des données exemples.',
        type: 'success',
      });
      navigate(getPostLoginRedirect(nextProfile, isSupabaseEnabled), { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentification échouée';
      if (/Invalid login credentials/i.test(message)) {
        const request = await getAccessRequestStatusByEmail(email);
        if (request) {
          if (request.status === 'approved') {
            notify({
              title: 'Connexion impossible',
              message: 'Email ou mot de passe incorrect.',
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
            .select('id,account_status,email')
            .eq('email', normalized)
            .limit(1)
            .maybeSingle();
          if (profileRow) {
            notify({
              title: 'Activation requise',
              message: "Votre compte existe mais n’est pas encore activé côté connexion. Utilisez votre lien d’activation ou contactez votre agence.",
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
        navigate(`/demande-acces?email=${encodeURIComponent(email)}&from=login`, { replace: true });
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
    <div className="grid min-h-screen bg-carbon-950 text-white light:bg-carbon-50 light:text-carbon-950 lg:grid-cols-[1fr_0.85fr]">
      <section className="hidden border-r border-white/10 bg-surface-grid bg-[length:34px_34px] px-10 py-8 lg:flex lg:flex-col">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200">
          <ArrowLeft className="h-4 w-4" />
          Retour à l’accueil
        </Link>
        <div className="my-auto max-w-2xl">
          <div className="mb-8 inline-flex rounded-3xl bg-gold-400 p-4 text-carbon-950 shadow-gold">
            <LockKeyhole className="h-8 w-8" />
          </div>
          <h1 className="text-6xl font-black leading-none text-white light:text-carbon-950">
            Pilotez toute votre activité location depuis un espace sécurisé.
          </h1>
          <p className="mt-6 text-lg leading-8 text-carbon-300 light:text-carbon-600">
            Réservations, véhicules, clients, contrats, paiements, entretien et rapports sont prêts avec des données réalistes.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200 lg:hidden">
            <ArrowLeft className="h-4 w-4" />
            Retour à l’accueil
          </Link>
          <Card className="p-6 sm:p-8">
            {resetMode ? (
              <form className="grid gap-4" onSubmit={handleSetNewPassword}>
                <h2 className="text-2xl font-black">Nouveau mot de passe</h2>
                <p className="text-sm text-carbon-400">Définissez votre nouveau mot de passe pour sécuriser votre compte.</p>
                <label className="grid gap-2 text-sm font-medium text-carbon-200 light:text-carbon-700">
                  <span>Nouveau mot de passe</span>
                  <div className="relative">
                    <input className="form-control focus-ring w-full pr-12" name="newPassword" type={showResetPassword ? 'text' : 'password'} placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                    <button type="button" className="absolute inset-y-0 right-2 my-auto grid h-8 w-8 place-items-center rounded-lg text-carbon-300 hover:bg-white/10 hover:text-white" onClick={() => setShowResetPassword((v) => !v)} aria-label={showResetPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                      {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
                <Button type="submit" icon={<LockKeyhole className="h-4 w-4" />}>Mettre à jour le mot de passe</Button>
                <Button type="button" variant="secondary" onClick={() => { setResetMode(false); window.history.replaceState(null, '', '/auth'); }}>Retour à la connexion</Button>
              </form>
            ) : (
              <>
                <h2 className="text-2xl font-black text-white light:text-carbon-950">Se connecter</h2>
                <p className="mt-2 text-sm text-carbon-400 light:text-carbon-600">Accédez à votre espace MekLoc.</p>
                {loginStep === 'email' ? (
                  <form className="mt-7 grid gap-4" onSubmit={handleEmailStep}>
                    <Field
                      label="Email"
                      name="email"
                      type="email"
                      placeholder="admin@agency.ma"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        setMemberLoginHint(null);
                      }}
                      required
                    />
                    <Button type="submit" loading={loading} icon={<Mail className="h-4 w-4" />}>Suivant</Button>
                  </form>
                ) : (
                  <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    placeholder="admin@agency.ma"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      setMemberLoginHint(null);
                    }}
                    required
                  />
                  <label className="grid gap-2 text-sm font-medium text-carbon-200 light:text-carbon-700">
                    <span>Mot de passe</span>
                    <div className="relative">
                      <input className="form-control focus-ring w-full pr-12" name="password" type={showLoginPassword ? 'text' : 'password'} placeholder="••••••••" required />
                      <button type="button" className="absolute inset-y-0 right-2 my-auto grid h-8 w-8 place-items-center rounded-lg text-carbon-300 hover:bg-white/10 hover:text-white" onClick={() => setShowLoginPassword((v) => !v)} aria-label={showLoginPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                  {memberLoginHint ? (
                    <div className="rounded-2xl border border-gold-300/25 bg-gold-400/10 p-4 text-sm text-carbon-200">
                      <p className="font-semibold text-white light:text-carbon-950">Compte membre chez {memberLoginHint.agencyName}</p>
                      <p className="mt-1 text-carbon-300 light:text-carbon-700">
                        Si vous n’avez pas encore reçu le lien d’activation ou défini votre mot de passe, contactez votre agence.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {memberAgencyWhatsAppUrl ? (
                          <Button
                            type="button"
                            variant="secondary"
                            icon={<MessageCircle className="h-4 w-4" />}
                            onClick={() => window.open(memberAgencyWhatsAppUrl, '_blank', 'noopener,noreferrer')}
                          >
                            Contacter l’agence
                          </Button>
                        ) : null}
                        {memberLoginHint.agencyPhone ? (
                          <span className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-3 py-2 font-semibold text-gold-100">
                            {memberLoginHint.agencyPhone}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => { setLoginStep('email'); setMemberLoginHint(null); }}>Retour</Button>
                    <Button type="submit" loading={loading} icon={<Mail className="h-4 w-4" />}>Se connecter</Button>
                  </div>
                </form>
                )}
                <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-carbon-500">
                  <span className="h-px flex-1 bg-white/10" />
                  ou
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  icon={<Chrome className="h-4 w-4" />}
                  loading={loading}
                  onClick={handleGoogleLogin}
                >
                  Connexion avec Google
                </Button>
                <button type="button" className="mt-4 text-sm font-semibold text-gold-200 hover:text-gold-100" onClick={() => setForgotOpen(true)}>
                  Mot de passe oublié ?
                </button>
                <p className="mt-4 text-sm text-carbon-400">Pas encore client ? <Link to="/demande-acces" className="font-semibold text-gold-200">Demander un accès</Link></p>
              </>
            )}
          </Card>
        </div>
      </section>
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
