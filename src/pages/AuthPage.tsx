import { ArrowLeft, Chrome, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getPostLoginRedirect } from '../lib/authRedirect';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const navigate = useNavigate();
  const { notify } = useApp();
  const { signIn, signInWithGoogle, signUp, refreshProfile, isSupabaseEnabled, requestPasswordReset } = useAuth();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));
    const agencyName = String(form.get('agencyName') || 'Atlas Rent Marrakech');
    const phone = String(form.get('phone') || '');

    try {
      const result =
        mode === 'login'
          ? await signIn(email, password)
          : await signUp({ email, password, agencyName, fullName: agencyName, phone });

      if (result.needsEmailConfirmation) {
        notify({
          title: 'Compte créé',
          message: 'Vérifiez votre email pour confirmer le compte, puis connectez-vous pour terminer l’onboarding.',
          type: 'success',
        });
        setMode('login');
        return;
      }

      const nextProfile = isSupabaseEnabled ? await refreshProfile() : null;

      notify({
        title: mode === 'login' ? 'Bon retour sur MekLoc' : 'Espace créé',
        message: isSupabaseEnabled
          ? 'Votre session Supabase est active.'
          : 'Vous entrez en mode démo avec des données exemples.',
        type: 'success',
      });
      navigate(getPostLoginRedirect(nextProfile, isSupabaseEnabled), { replace: true });
    } catch (error) {
      notify({
        title: 'Authentification échouée',
        message: error instanceof Error ? error.message : 'Vérifiez votre configuration Supabase puis réessayez.',
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
            <div className="mb-7 flex rounded-2xl border border-white/10 bg-white/[0.04] p-1">
              {(['login', 'register'] as const).map((item) => (
                <button
                  key={item}
                  className={`focus-ring flex-1 rounded-xl px-4 py-2.5 text-sm font-bold capitalize transition ${
                    mode === item ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300 hover:bg-white/10 light:text-carbon-700'
                  }`}
                  onClick={() => setMode(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <h2 className="text-2xl font-black text-white light:text-carbon-950">
              {mode === 'login' ? 'Connexion MekLoc' : 'Créer votre agence'}
            </h2>
            <p className="mt-2 text-sm text-carbon-400 light:text-carbon-600">
              {mode === 'login'
                ? 'Accédez au tableau de bord et gérez vos opérations de location.'
                : 'Démarrez un espace MekLoc propre pour votre agence.'}
            </p>
            <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
              {mode === 'register' ? (
                <Field label="Nom de l’agence" name="agencyName" placeholder="Atlas Rent Marrakech" required />
              ) : null}
              <Field label="Email" name="email" type="email" placeholder="admin@agency.ma" required />
              <Field label="Mot de passe" name="password" type="password" placeholder="••••••••" required />
              {mode === 'register' ? (
                <Field label="Numéro WhatsApp" name="phone" placeholder="+212 6 00 00 00 00" required />
              ) : null}
              <Button type="submit" loading={loading} icon={mode === 'login' ? <Mail className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}>
                {mode === 'login' ? 'Entrer dans le tableau de bord' : 'Créer le compte'}
              </Button>
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
              Continuer avec Google
            </Button>
            {mode === 'login' ? (
              <button type="button" className="mt-4 text-sm font-semibold text-gold-200 hover:text-gold-100" onClick={() => setForgotOpen(true)}>
                Mot de passe oublié ?
              </button>
            ) : null}
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
