import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export default function SetPasswordPage() {
  const { recoverActivationSession, updatePassword } = useAuth();
  const { notify } = useApp();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    recoverActivationSession()
      .then((ready) => {
        if (cancelled) return;
        setSessionReady(ready);
        setSessionError(ready ? '' : "Session d’activation introuvable. Ouvrez le lien le plus récent ou demandez un nouveau lien.");
      })
      .catch((error) => {
        if (cancelled) return;
        setSessionReady(false);
        setSessionError(error instanceof Error ? error.message : "Session d’activation introuvable.");
      })
      .finally(() => {
        if (!cancelled) setSessionChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recoverActivationSession]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      notify({ title: 'Mot de passe trop court', message: 'Utilisez au moins 8 caractères.', type: 'warning' });
      return;
    }
    if (password !== confirmPassword) {
      notify({ title: 'Confirmation incorrecte', message: 'Les mots de passe ne correspondent pas.', type: 'warning' });
      return;
    }
    if (!sessionReady) {
      notify({
        title: 'Lien non prêt',
        message: sessionError || "Ouvrez le lien d’activation le plus récent et réessayez.",
        type: 'warning',
      });
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      notify({ title: 'Mot de passe défini', message: 'Votre compte est prêt. Connectez-vous maintenant.', type: 'success' });
      window.history.replaceState(null, '', '/auth');
      navigate('/auth', { replace: true });
    } catch (error) {
      notify({ title: 'Échec de mise à jour', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-carbon-950 px-4 py-10 text-white">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-gold-300/35 bg-gold-400/10 text-gold-200">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-black">Définir votre mot de passe</h1>
        <p className="mt-2 text-center text-sm text-carbon-300">
          Choisissez un mot de passe sécurisé pour activer votre accès MekLoc.
        </p>
        <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
          sessionChecking
            ? 'border-gold-300/25 bg-gold-400/10 text-gold-100'
            : sessionReady
              ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
              : 'border-red-300/25 bg-red-400/10 text-red-100'
        }`}>
          {sessionChecking
            ? 'Vérification du lien d’activation...'
            : sessionReady
              ? 'Lien vérifié. Vous pouvez définir votre mot de passe.'
              : sessionError}
        </div>
        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-medium text-carbon-200 light:text-carbon-700">
            <span>Nouveau mot de passe</span>
            <div className="relative">
              <input className="form-control focus-ring w-full pr-12" name="newPassword" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" className="absolute inset-y-0 right-2 my-auto grid h-8 w-8 place-items-center rounded-lg text-carbon-300 hover:bg-white/10 hover:text-white" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <label className="grid gap-2 text-sm font-medium text-carbon-200 light:text-carbon-700">
            <span>Confirmer le mot de passe</span>
            <div className="relative">
              <input className="form-control focus-ring w-full pr-12" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              <button type="button" className="absolute inset-y-0 right-2 my-auto grid h-8 w-8 place-items-center rounded-lg text-carbon-300 hover:bg-white/10 hover:text-white" onClick={() => setShowConfirmPassword((v) => !v)} aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <Button type="submit" loading={loading || sessionChecking} disabled={!sessionReady} icon={<LockKeyhole className="h-4 w-4" />}>
            Enregistrer le mot de passe
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/auth')}>
            Retour à la connexion
          </Button>
        </form>
      </Card>
    </div>
  );
}
