import { ArrowLeft, Building2, CheckCircle2, Sparkles } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field } from '../components/ui/Form';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getPostLoginRedirect } from '../lib/authRedirect';

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { notify } = useApp();
  const { createAgencyProfile, isSupabaseEnabled, profile, user } = useAuth();

  useEffect(() => {
    if (!isSupabaseEnabled) {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (profile?.agencyId) {
      navigate(getPostLoginRedirect(profile, isSupabaseEnabled), { replace: true });
    }
  }, [isSupabaseEnabled, navigate, profile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const agencyName = String(form.get('agencyName') || '').trim();
    const fullName = String(form.get('fullName') || '').trim();
    const phone = String(form.get('phone') || '').trim();

    if (!agencyName) {
      notify({ title: 'Agency name required', message: 'Add your agency name to continue.', type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const nextProfile = await createAgencyProfile(agencyName, fullName || user?.email || agencyName, phone);
      notify({ title: 'Agency created', message: 'Your MekLoc workspace is ready.', type: 'success' });
      navigate(getPostLoginRedirect(nextProfile, isSupabaseEnabled), { replace: true });
    } catch (error) {
      notify({
        title: 'Agency not created',
        message: error instanceof Error ? error.message : 'Check your Supabase setup and try again.',
        type: 'warning',
      });
    } finally {
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
            <Building2 className="h-8 w-8" />
          </div>
          <h1 className="text-6xl font-black leading-none text-white light:text-carbon-950">
            Create your agency workspace.
          </h1>
          <p className="mt-6 text-lg leading-8 text-carbon-300 light:text-carbon-600">
            Google login is active. Add your agency details once, then MekLoc will connect every record to your agency.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <Card className="p-6 sm:p-8">
            <div className="mb-6 inline-flex rounded-2xl border border-gold-300/20 bg-gold-400/10 p-3 text-gold-200">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black text-white light:text-carbon-950">Finish onboarding</h2>
            <p className="mt-2 text-sm leading-6 text-carbon-400 light:text-carbon-600">
              Your account is signed in. Create an agency profile to unlock the protected dashboard.
            </p>
            <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
              <Field label="Agency name" name="agencyName" placeholder="Atlas Rent Marrakech" required />
              <Field
                label="Your name"
                name="fullName"
                placeholder={user?.user_metadata?.full_name || user?.email || 'Agency owner'}
              />
              <Field label="WhatsApp number" name="phone" placeholder="+212 6 00 00 00 00" />
              <Button type="submit" loading={loading} icon={<CheckCircle2 className="h-4 w-4" />}>
                Create agency
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
}
