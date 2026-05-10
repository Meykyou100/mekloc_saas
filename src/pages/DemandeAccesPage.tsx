import { ArrowLeft } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field, SelectField } from '../components/ui/Form';
import { useApp } from '../context/AppContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const countries = ['Maroc', 'France', 'Espagne', 'Belgique', 'Allemagne', 'Italie', 'Pays-Bas', 'Émirats Arabes Unis', 'Arabie Saoudite', 'Autre'];
const moroccoCities = ['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Fès', 'Meknès', 'Agadir', 'Oujda', 'Tétouan', 'Nador', 'Kénitra', 'El Jadida', 'Safi', 'Essaouira', 'Beni Mellal', 'Khouribga', 'Settat', 'Mohammedia', 'Salé', 'Laâyoune', 'Dakhla', 'Errachidia', 'Ouarzazate', 'Taza', 'Larache', 'Ksar El Kebir', 'Al Hoceima', 'Ifrane', 'Autre'];
const plans = [
  { id: 'gratuit', name: 'Gratuit', monthly: 0, annual: 0 },
  { id: 'starter', name: 'Starter', monthly: 99, annual: 990 },
  { id: 'business', name: 'Business', monthly: 249, annual: 2490 },
] as const;
type PlanId = (typeof plans)[number]['id'];

export default function DemandeAccesPage() {
  const [searchParams] = useSearchParams();
  const { notify } = useApp();
  const normalizeEmail = (email: string) => email.trim().toLowerCase();
  const [country, setCountry] = useState('Maroc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('business');
  const [billingType, setBillingType] = useState<'monthly' | 'annual'>('monthly');
  const prefilledEmail = searchParams.get('email') || '';
  const fromLogin = searchParams.get('from') === 'login';


  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acceptedTerms) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      agency_name: String(form.get('agency_name') || ''),
      owner_name: String(form.get('owner_name') || ''),
      address: String(form.get('address') || ''),
      country: String(form.get('country') || 'Maroc'),
      city: String(form.get('city') || ''),
      website_url: String(form.get('website_url') || ''),
      email: normalizeEmail(String(form.get('email') || '')),
      phone_country_code: String(form.get('phone_country_code') || '+212'),
      phone_number: String(form.get('phone_number') || ''),
      vehicle_count: Number(form.get('vehicle_count') || 0),
      selected_plan: selectedPlan,
      billing_type: billingType,
      monthly_price: plans.find((p) => p.id === selectedPlan)?.monthly || 0,
      annual_price: plans.find((p) => p.id === selectedPlan)?.annual || 0,
      promo_code: String(form.get('promo_code') || ''),
      status: 'pending',
    };
    setIsSubmitting(true);
    try {
      if (!supabase || !isSupabaseConfigured) throw new Error('Supabase non configuré');
      const { data: row, error: existingError } = await supabase
        .from('access_requests')
        .select('status, agency_name, selected_plan, created_at, email')
        .eq('email', payload.email)
        .in('status', ['pending', 'pending_verification', 'contacted', 'payment_pending', 'verified'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (import.meta.env.DEV) console.log('Access request found:', row);
      if (existingError) throw existingError;
      if (row && ['pending', 'pending_verification', 'contacted', 'payment_pending', 'verified'].includes(row.status)) {
        window.location.href = `/verification-en-cours?email=${encodeURIComponent(payload.email)}&agency=${encodeURIComponent(row.agency_name || payload.agency_name)}&plan=${encodeURIComponent(row.selected_plan || payload.selected_plan)}&created_at=${encodeURIComponent(row.created_at || '')}${row.status === 'contacted' ? `&note=${encodeURIComponent('Notre équipe vous a contacté ou vous contactera bientôt.')}` : ''}`;
        return;
      }
      const { error } = await supabase.from('access_requests').insert(payload);
      if (error) throw error;
      window.location.href = `/verification-en-cours?email=${encodeURIComponent(payload.email)}`;
    } catch (error) {
      notify({ title: 'Envoi impossible', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    } finally {
      setIsSubmitting(false);
    }
  }


  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link to="/auth" className="inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 transition hover:text-gold-200"><ArrowLeft className="h-4 w-4" />Retour à la connexion</Link>
        <Card className="mt-4 p-4 sm:mt-6 sm:p-7">
          <h1 className="text-2xl font-black sm:text-3xl">Demande d’accès MekLoc</h1>
          {fromLogin ? <p className="mt-2 text-sm text-gold-200">Votre compte n’est pas encore activé. Remplissez cette demande pour obtenir l’accès.</p> : null}
          <div className="mt-5 inline-flex rounded-xl border border-white/10 bg-[#0f1115] p-1">
            <button type="button" onClick={() => setBillingType('monthly')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${billingType === 'monthly' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300 hover:text-white'}`}>Mensuel</button>
            <button type="button" onClick={() => setBillingType('annual')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${billingType === 'annual' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300 hover:text-white'}`}>Annuel</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {plans.map((plan) => {
              const active = selectedPlan === plan.id;
              const price = billingType === 'annual' ? plan.annual : plan.monthly;
              return (
                <button key={plan.id} type="button" onClick={() => setSelectedPlan(plan.id)} className={`rounded-2xl border bg-[#0f1115] p-4 text-left transition ${active ? 'border-gold-300/45 shadow-[0_0_0_1px_rgba(212,160,23,0.25)]' : 'border-white/10 hover:border-white/20'}`}>
                  <p className="font-bold">{plan.name}</p>
                  <p className="mt-1 text-lg font-black">{price} MAD <span className="text-xs font-semibold text-carbon-400">{billingType === 'annual' ? '/an' : '/mois'}</span></p>
                </button>
              );
            })}
          </div>
          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <Field label="Nom de l’agence *" name="agency_name" required />
            <Field label="Responsable *" name="owner_name" required />
            <Field label="Adresse *" name="address" required />
            <SelectField label="Pays *" name="country" value={country} onChange={(e) => setCountry(e.target.value)} required>{countries.map((c) => <option key={c} value={c}>{c}</option>)}</SelectField>
            {country === 'Maroc' ? <SelectField label="Ville *" name="city" defaultValue="" required><option value="" disabled>Choisir une ville</option>{moroccoCities.map((c) => <option key={c} value={c}>{c}</option>)}</SelectField> : <Field label="Ville *" name="city" required />}
            <Field label="Site web / Instagram / Réseau social" name="website_url" />
            <Field label="Email *" name="email" type="email" defaultValue={prefilledEmail} required />
            <div className="grid gap-3 sm:grid-cols-[120px_1fr]"><Field label="Indicatif" name="phone_country_code" defaultValue="+212" required /><Field label="Numéro de téléphone *" name="phone_number" required /></div>
            <Field label="Nombre de véhicules *" name="vehicle_count" type="number" min={1} required />
            <Field label="Code promo (optionnel)" name="promo_code" />
            <label className="mt-1 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-carbon-300"><input type="checkbox" className="mt-0.5 h-4 w-4 rounded border border-gold-300/70 bg-transparent accent-[#D4A017]" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required /><span>J’ai lu et j’accepte les conditions d’utilisation et la politique de confidentialité.</span></label>
            <Button type="submit" className="mt-1 w-full" loading={isSubmitting}>Envoyer la demande d’accès</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
