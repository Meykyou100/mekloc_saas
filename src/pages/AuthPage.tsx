import { ArrowLeft, Chrome, Eye, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field } from '../components/ui/Form';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getPostLoginRedirect } from '../lib/authRedirect';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { notify } = useApp();
  const { signIn, signInWithGoogle, signUp, refreshProfile, isSupabaseEnabled } = useAuth();

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
          title: 'Account created',
          message: 'Check your email to confirm the account, then login to finish onboarding.',
          type: 'success',
        });
        setMode('login');
        return;
      }

      const nextProfile = isSupabaseEnabled ? await refreshProfile() : null;

      notify({
        title: mode === 'login' ? 'Welcome back to MekLoc' : 'Workspace created',
        message: isSupabaseEnabled
          ? 'Your Supabase session is active.'
          : 'You are entering the demo dashboard with mock data.',
        type: 'success',
      });
      navigate(getPostLoginRedirect(nextProfile, isSupabaseEnabled), { replace: true });
    } catch (error) {
      notify({
        title: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Check your Supabase settings and try again.',
        type: 'warning',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (!isSupabaseEnabled) {
      notify({
        title: 'Demo mode active',
        message: 'Add Supabase env variables to use Google login.',
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
        title: 'Google login failed',
        message: error instanceof Error ? error.message : 'Check your Google provider settings in Supabase.',
        type: 'warning',
      });
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-carbon-950 text-white light:bg-carbon-50 light:text-carbon-950 lg:grid-cols-[1fr_0.85fr]">
      <section className="hidden border-r border-white/10 bg-surface-grid bg-[length:34px_34px] px-10 py-8 lg:flex lg:flex-col">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        <div className="my-auto max-w-2xl">
          <div className="mb-8 inline-flex rounded-3xl bg-gold-400 p-4 text-carbon-950 shadow-gold">
            <LockKeyhole className="h-8 w-8" />
          </div>
          <h1 className="text-6xl font-black leading-none text-white light:text-carbon-950">
            Run every rental workflow from one secure cockpit.
          </h1>
          <p className="mt-6 text-lg leading-8 text-carbon-300 light:text-carbon-600">
            Reservations, vehicles, clients, contracts, payments, maintenance, and reports are ready to explore with realistic demo data.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200 lg:hidden">
            <ArrowLeft className="h-4 w-4" />
            Back to home
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
              {mode === 'login' ? 'Login to MekLoc' : 'Create your agency'}
            </h2>
            <p className="mt-2 text-sm text-carbon-400 light:text-carbon-600">
              {mode === 'login'
                ? 'Access the demo dashboard and manage your rental operations.'
                : 'Start a clean MekLoc workspace for your agency.'}
            </p>
            <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
              {mode === 'register' ? (
                <Field label="Agency name" name="agencyName" placeholder="Atlas Rent Marrakech" required />
              ) : null}
              <Field label="Email" name="email" type="email" placeholder="admin@agency.ma" required />
              <Field label="Password" name="password" type="password" placeholder="••••••••" required />
              {mode === 'register' ? (
                <Field label="WhatsApp number" name="phone" placeholder="+212 6 00 00 00 00" required />
              ) : null}
              <Button type="submit" loading={loading} icon={mode === 'login' ? <Mail className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}>
                {mode === 'login' ? 'Enter dashboard' : 'Create account'}
              </Button>
            </form>
            <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-carbon-500">
              <span className="h-px flex-1 bg-white/10" />
              or
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
              Continue with Google
            </Button>
            <button className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-carbon-400 hover:text-gold-200">
              <Eye className="h-4 w-4" />
              Preview dashboard without account
            </button>
          </Card>
        </div>
      </section>
    </div>
  );
}
