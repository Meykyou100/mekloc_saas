import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field } from '../components/ui/Form';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export default function SetPasswordPage() {
  const { updatePassword } = useAuth();
  const { notify } = useApp();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const hasRecovery = hash.includes('type=recovery') || hash.includes('type=invite') || search.includes('type=recovery') || search.includes('type=invite');
    if (!hasRecovery) {
      notify({
        title: 'Lien invalide ou expiré',
        message: 'Demandez un nouveau lien de réinitialisation.',
        type: 'warning',
      });
    }
  }, [notify]);

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
        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <Field
            label="Nouveau mot de passe"
            name="newPassword"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Field
            label="Confirmer le mot de passe"
            name="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <Button type="submit" loading={loading} icon={<LockKeyhole className="h-4 w-4" />}>
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

