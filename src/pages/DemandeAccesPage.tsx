import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Field, SelectField } from '../components/ui/Form';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';

type Plan = { key: 'gratuit' | 'starter' | 'business'; price: number; features: string[]; popular?: boolean };
const plans: Plan[] = [
  { key: 'gratuit', price: 0, features: ['Jusqu’à 5 véhicules', '1 utilisateur', 'Jusqu’à 40 réservations/mois', 'Formation gratuite', 'Disponible sur ordinateur & mobile'] },
  { key: 'starter', price: 99, features: ['Jusqu’à 10 véhicules', '2 utilisateurs', 'Jusqu’à 100 réservations/mois', 'Formation gratuite', 'Disponible sur ordinateur & mobile'] },
  { key: 'business', price: 249, popular: true, features: ['Jusqu’à 30 véhicules', '2 utilisateurs', 'Jusqu’à 350 réservations/mois', 'Contrats PDF', 'Paiements & factures', 'Entretien véhicules', 'Support prioritaire'] },
];

export default function DemandeAccesPage() {
  const { notify } = useApp();
  const [selectedPlan, setSelectedPlan] = useState<Plan['key']>('starter');
  const [billingType, setBillingType] = useState<'monthly' | 'annual'>('monthly');
  const [done, setDone] = useState(false);
  const selected = plans.find((p) => p.key === selectedPlan)!;
  const annual = selected.price * 10;
  const monthlyYear = selected.price * 12;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      agency_name: String(f.get('agency_name')),
      owner_name: String(f.get('owner_name')),
      address: String(f.get('address')),
      country: String(f.get('country') || 'Maroc'),
      city: String(f.get('city')),
      website_url: String(f.get('website_url') || ''),
      email: String(f.get('email')),
      phone_country_code: String(f.get('phone_country_code') || '+212'),
      phone_number: String(f.get('phone_number')),
      vehicle_count: Number(f.get('vehicle_count') || 0),
      selected_plan: selectedPlan,
      billing_type: billingType,
      monthly_price: selected.price,
      annual_price: annual,
      promo_code: String(f.get('promo_code') || ''),
      status: 'pending',
    };
    if (supabase) {
      const { error } = await supabase.from('access_requests').insert(payload);
      if (error) return notify({ title: 'Envoi impossible', message: error.message, type: 'warning' });
    }
    notify({ title: 'Demande reçue', message: 'Votre demande d’accès MekLoc a été reçue.', type: 'success' });
    setDone(true);
  }

  if (done) return <div className="min-h-screen grid place-items-center bg-carbon-950 text-white p-6"><Card className="p-8 max-w-xl text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-gold-300" /><h1 className="mt-4 text-2xl font-bold">Votre demande a été envoyée.</h1><p className="mt-2 text-carbon-400">Nous vous contacterons après vérification.</p></Card></div>;

  return (
    <div className="min-h-screen bg-carbon-950 text-white p-4 sm:p-6">
      <div className="mx-auto max-w-6xl grid gap-6">
        <Card className="p-5">
          <h1 className="text-2xl font-black">Demander un accès</h1>
          <div className="mt-4 inline-flex rounded-xl border border-white/10 p-1">
            <button className={`px-3 py-1.5 rounded-lg text-sm ${billingType === 'monthly' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300'}`} onClick={() => setBillingType('monthly')}>Mensuel</button>
            <button className={`px-3 py-1.5 rounded-lg text-sm ${billingType === 'annual' ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300'}`} onClick={() => setBillingType('annual')}>Annuel</button>
          </div>
          {billingType === 'annual' ? <p className="mt-2 text-sm text-emerald-300">2 mois offerts · Vous économisez {monthlyYear - annual} MAD</p> : null}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {plans.map((p) => <button key={p.key} onClick={() => setSelectedPlan(p.key)} className={`text-left rounded-2xl border p-4 ${selectedPlan === p.key ? 'border-gold-300 bg-white/[0.04]' : 'border-white/10'}`}><div className="flex items-center justify-between"><p className="font-bold capitalize">{p.key}</p>{p.popular ? <span className="text-xs bg-gold-400 text-carbon-950 px-2 py-1 rounded-full">Le plus populaire</span> : null}</div><p className="mt-2 text-xl font-black">{billingType === 'annual' ? `${p.price * 10} MAD/an` : `${p.price} MAD/mois`}</p><ul className="mt-3 text-sm text-carbon-300 space-y-1">{p.features.map((x) => <li key={x}>• {x}</li>)}</ul></button>)}
          </div>
        </Card>
        <Card className="p-5">
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
            <Field label="Nom de l’agence *" name="agency_name" required />
            <Field label="Responsable *" name="owner_name" required />
            <Field label="Adresse *" name="address" required />
            <Field label="Pays *" name="country" defaultValue="Maroc" required />
            <SelectField label="Ville *" name="city" required><option>Casablanca</option><option>Rabat</option><option>Marrakech</option><option>Tanger</option><option>Fès</option><option>Agadir</option><option>Oujda</option><option>Autre</option></SelectField>
            <Field label="Site web / Instagram / Réseau social" name="website_url" />
            <Field label="Email *" name="email" type="email" required />
            <Field label="Indicatif" name="phone_country_code" defaultValue="+212" />
            <Field label="Numéro de téléphone *" name="phone_number" required />
            <Field label="Nombre de véhicules *" name="vehicle_count" type="number" required />
            <Field label="Code promo" name="promo_code" />
            <label className="sm:col-span-2 text-sm"><input type="checkbox" required className="mr-2" />J’accepte les conditions d’utilisation.</label>
            <div className="sm:col-span-2"><Button type="submit">Envoyer la demande d’accès</Button></div>
          </form>
        </Card>
      </div>
    </div>
  );
}
