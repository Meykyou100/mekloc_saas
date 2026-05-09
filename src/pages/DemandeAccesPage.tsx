import { ArrowLeft, Mail } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field, SelectField } from '../components/ui/Form';
import { useApp } from '../context/AppContext';
import { sendAccessRequestConfirmationEmail } from '../lib/accessRequestEmail';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const countries = ['Maroc', 'France', 'Espagne', 'Belgique', 'Allemagne', 'Italie', 'Pays-Bas', 'Émirats Arabes Unis', 'Arabie Saoudite', 'Autre'];
const moroccoCities = ['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Fès', 'Meknès', 'Agadir', 'Oujda', 'Tétouan', 'Nador', 'Kénitra', 'El Jadida', 'Safi', 'Essaouira', 'Beni Mellal', 'Khouribga', 'Settat', 'Mohammedia', 'Salé', 'Laâyoune', 'Dakhla', 'Errachidia', 'Ouarzazate', 'Taza', 'Larache', 'Ksar El Kebir', 'Al Hoceima', 'Ifrane', 'Autre'];

export default function DemandeAccesPage() {
  const [searchParams] = useSearchParams();
  const { notify } = useApp();
  const [country, setCountry] = useState('Maroc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
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
      email: String(form.get('email') || ''),
      phone_country_code: String(form.get('phone_country_code') || '+212'),
      phone_number: String(form.get('phone_number') || ''),
      vehicle_count: Number(form.get('vehicle_count') || 0),
      selected_plan: 'business',
      billing_type: 'monthly',
      monthly_price: 249,
      annual_price: 2490,
      promo_code: String(form.get('promo_code') || ''),
      status: 'pending',
    };
    setSubmittedEmail(payload.email);
    setIsSubmitting(true);
    try {
      if (!supabase || !isSupabaseConfigured) throw new Error('Supabase non configuré');
      const { error } = await supabase.from('access_requests').insert(payload);
      if (error) throw error;
      const emailResult = await sendAccessRequestConfirmationEmail({ ownerName: payload.owner_name, email: payload.email, selectedPlan: payload.selected_plan });
      if (!emailResult.sent) console.warn('email optional failed', emailResult);
      notify({ title: 'Demande envoyée', message: 'Votre demande a été envoyée. MekLoc vous contactera après vérification.', type: 'success' });
      setIsSuccess(true);
    } catch (error) {
      notify({ title: 'Envoi impossible', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) return <div className="min-h-screen bg-carbon-950 px-4 py-8 text-white sm:px-6"><div className="mx-auto flex min-h-[80vh] w-full max-w-xl items-center"><Card className="w-full p-6 sm:p-8"><p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-carbon-400">AutoLoc</p><div className="mx-auto mt-4 mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gold-300/40 bg-gold-400/10 text-gold-200"><Mail className="h-6 w-6" /></div><h1 className="text-center text-2xl font-black">Vérifiez votre messagerie</h1><div className="mt-3 space-y-2 text-center text-sm text-carbon-300"><p>Un email de vérification a été envoyé à <span className="font-semibold text-white">{submittedEmail || prefilledEmail || 'votre adresse email'}</span>. Cliquez sur le lien pour confirmer votre demande.</p><p>Vérifiez aussi vos spams si vous ne trouvez pas l’email. Le lien expire dans 24h.</p></div><Link to="/auth" className="mt-7 block"><Button variant="secondary" className="w-full">Retour à la connexion</Button></Link></Card></div></div>;

  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-3xl">
        <Link to="/auth" className="inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 transition hover:text-gold-200"><ArrowLeft className="h-4 w-4" />Retour à la connexion</Link>
        <Card className="mt-4 p-4 sm:mt-6 sm:p-7">
          <h1 className="text-2xl font-black sm:text-3xl">Demande d’accès MekLoc</h1>
          {fromLogin ? <p className="mt-2 text-sm text-gold-200">Votre compte n’est pas encore activé. Remplissez cette demande pour obtenir l’accès.</p> : null}
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
