import { ArrowLeft, Chrome, LockKeyhole, Mail } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getPostLoginRedirect } from '../lib/authRedirect';

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const navigate = useNavigate();
  const { notify } = useApp();
  const { signIn, signInWithGoogle, refreshProfile, isSupabaseEnabled, requestPasswordReset, updatePassword, getAccessRequestStatusByEmail } = useAuth();

  useEffect(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    if (
      hash.includes('type=recovery') ||
      hash.includes('type=invite') ||
      search.includes('type=recovery') ||
      search.includes('type=invite') ||
      search.includes('mode=set-password')
    ) {
      setResetMode(true);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim().toLowerCase();
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
                <Field label="Nouveau mot de passe" name="newPassword" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                <Button type="submit" icon={<LockKeyhole className="h-4 w-4" />}>Mettre à jour le mot de passe</Button>
                <Button type="button" variant="secondary" onClick={() => { setResetMode(false); window.history.replaceState(null, '', '/auth'); }}>Retour à la connexion</Button>
              </form>
            ) : (
              <>
            <h2 className="text-2xl font-black text-white light:text-carbon-950">Se connecter</h2>
            <p className="mt-2 text-sm text-carbon-400 light:text-carbon-600">Accédez à votre espace MekLoc.</p>
            <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
              <Field label="Email" name="email" type="email" placeholder="admin@agency.ma" required />
              <Field label="Mot de passe" name="password" type="password" placeholder="••••••••" required />
              <Button type="submit" loading={loading} icon={<Mail className="h-4 w-4" />}>Se connecter</Button>
            </form>
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
