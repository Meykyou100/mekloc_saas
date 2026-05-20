import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

type ActivationState = {
  loading: boolean;
  valid: boolean;
  email: string;
  error: string;
};

function reasonMessage(reason: string) {
  if (reason === 'used') return 'Ce lien a déjà été utilisé.';
  if (reason === 'expired') return 'Ce lien a expiré. Demandez un nouveau lien à votre administrateur.';
  if (reason === 'not_found') return 'Lien d’activation introuvable.';
  return 'Lien d’activation invalide.';
}

export default function ActivationPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useApp();
  const [state, setState] = useState<ActivationState>({ loading: true, valid: false, email: '', error: '' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function validate() {
      if (!supabase || !token) {
        setState({ loading: false, valid: false, email: '', error: 'Lien d’activation invalide.' });
        return;
      }
      const { data, error } = await supabase.functions.invoke('validate-activation-link', { body: { token } });
      if (cancelled) return;
      const payload = data as { valid?: boolean; email?: string; reason?: string } | null;
      if (error || !payload?.valid) {
        setState({ loading: false, valid: false, email: '', error: reasonMessage(payload?.reason || '') });
        return;
      }
      setState({ loading: false, valid: true, email: payload.email || '', error: '' });
    }
    validate();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
    if (!supabase) return;

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('complete-activation', {
        body: { token, password },
      });
      const payload = data as { success?: boolean; error?: string; email?: string } | null;
      if (error || !payload?.success) throw new Error(payload?.error || error?.message || 'Activation impossible.');
      notify({ title: 'Compte activé', message: 'Votre mot de passe est défini. Connectez-vous maintenant.', type: 'success' });
      navigate(`/auth?email=${encodeURIComponent(payload.email || state.email)}&force=login`, { replace: true });
    } catch (error) {
      notify({ title: 'Activation impossible', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-carbon-950 px-4 py-10 text-white">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-gold-300/35 bg-gold-400/10 text-gold-200">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-black">Créer votre mot de passe</h1>
        <p className="mt-2 text-center text-sm text-carbon-300">
          Activez votre accès MekLoc avec un mot de passe sécurisé.
        </p>

        {state.loading ? (
          <div className="mt-6 rounded-2xl border border-gold-300/25 bg-gold-400/10 px-4 py-3 text-sm text-gold-100">
            Vérification du lien d’activation...
          </div>
        ) : null}

        {!state.loading && !state.valid ? (
          <div className="mt-6 rounded-2xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {state.error}
          </div>
        ) : null}

        {!state.loading && state.valid ? (
          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              Lien vérifié pour {state.email}.
            </div>
            <label className="grid gap-2 text-sm font-medium text-carbon-200">
              <span>Nouveau mot de passe</span>
              <div className="relative">
                <input className="form-control focus-ring w-full pr-12" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button type="button" className="absolute inset-y-0 right-2 my-auto grid h-8 w-8 place-items-center rounded-lg text-carbon-300 hover:bg-white/10 hover:text-white" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <label className="grid gap-2 text-sm font-medium text-carbon-200">
              <span>Confirmer le mot de passe</span>
              <div className="relative">
                <input className="form-control focus-ring w-full pr-12" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                <button type="button" className="absolute inset-y-0 right-2 my-auto grid h-8 w-8 place-items-center rounded-lg text-carbon-300 hover:bg-white/10 hover:text-white" onClick={() => setShowConfirmPassword((value) => !value)}>
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <Button type="submit" loading={saving} icon={<LockKeyhole className="h-4 w-4" />}>
              Activer mon compte
            </Button>
          </form>
        ) : null}

        <Link to="/auth?force=login" className="mt-5 block text-center text-sm font-semibold text-carbon-300 hover:text-gold-200">
          Retour à la connexion
        </Link>
      </Card>
    </div>
  );
}
