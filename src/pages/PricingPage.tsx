import { ArrowLeft, CheckCircle2, Crown, Infinity, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import Card from '../components/ui/Card';
import SEO, { baseStructuredData } from '../components/system/SEO';
import { WHATSAPP_URL } from '../config/app';
import { getPricingOffers, MEKLOC_PLANS, type MekLocBillingChoice } from '../config/pricing';

export default function PricingPage() {
  const [billingChoice, setBillingChoice] = useState<MekLocBillingChoice>('six_months');
  const offers = getPricingOffers(billingChoice);
  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-8 text-white light:bg-carbon-50 light:text-carbon-950 sm:px-6 lg:px-8">
      <SEO
        title="Tarifs MekLoc – Logiciel location voiture Maroc"
        description="Consultez les tarifs MekLoc pour gérer une agence de location de voitures au Maroc : réservations, flotte, contrats PDF, paiements et entretien."
        canonical="/tarifs"
        jsonLd={baseStructuredData()}
      />
      <div className="mx-auto max-w-7xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200 light:text-carbon-700">
          <ArrowLeft className="h-4 w-4" />
          Retour à l’accueil
        </Link>
        <div className="mt-12 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold-300">Abonnements</p>
          <h1 className="mt-4 text-4xl font-black text-white light:text-carbon-950 sm:text-6xl">Tarifs MekLoc</h1>
          <p className="mt-5 text-lg leading-8 text-carbon-300 light:text-carbon-600">
            Tous les plans incluent 7 jours d’essai gratuit. Choisissez une durée claire selon votre agence.
          </p>
        </div>
        <div className="mt-8 inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] p-1 light:border-carbon-200 light:bg-white">
          {([['six_months', '6 mois'], ['annual', '12 mois'], ['lifetime', 'Lifetime']] as Array<[MekLocBillingChoice, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setBillingChoice(value)} className={`h-10 shrink-0 rounded-xl px-4 text-sm font-black transition ${billingChoice === value ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300 hover:text-white light:text-carbon-600 light:hover:text-carbon-950'}`}>{label}</button>)}
        </div>
        <div className={`mt-8 grid gap-5 ${billingChoice === 'lifetime' ? 'mx-auto max-w-md' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
          {offers.map((offer) => {
            const plan = MEKLOC_PLANS[offer.planId];
            const featured = offer.planId === 'pro' || offer.planId === 'lifetime';
            const price = `${offer.price.toLocaleString('fr-FR')} MAD`;
            return (
            <Card
              key={`${offer.planId}-${offer.billingChoice}`}
              className={`p-6 ${featured ? 'border-gold-300/50 bg-gold-400/[0.08] shadow-gold' : ''}`}
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="rounded-2xl border border-gold-300/20 bg-gold-400/10 p-3 text-gold-200">
                  {plan.name === 'Lifetime' ? <Infinity className="h-6 w-6" /> : plan.name === 'Business' || plan.name === 'Pro' ? <Crown className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                </div>
                {offer.badge ? <span className="rounded-full bg-gold-400 px-3 py-1 text-xs font-black text-carbon-950">{offer.badge}</span> : null}
              </div>
              <h2 className="text-2xl font-black text-white light:text-carbon-950">{offer.name}</h2>
              <p className="mt-2 min-h-12 text-sm text-carbon-400 light:text-carbon-600">{plan.note}</p>
              <p className="mt-6 text-4xl font-black text-white light:text-carbon-950">
                {price}
                <span className="text-base font-semibold text-carbon-400"> {offer.packageLabel}</span>
              </p>
              <p className="mt-2 text-sm font-bold text-gold-300">{offer.equivalentLabel}</p>
              <p className="mt-4 text-sm font-bold text-carbon-200 light:text-carbon-800">{plan.usersLabel} · {plan.vehiclesLabel}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-carbon-500">{offer.commitment}</p>
              <div className="mt-6 grid gap-3">
                {plan.features.map((feature) => (
                  <p key={feature} className="flex items-center gap-2 text-sm text-carbon-300 light:text-carbon-700">
                    <CheckCircle2 className="h-4 w-4 text-gold-300" />
                    {feature}
                  </p>
                ))}
              </div>
              <a
                href={offer.planId === 'lifetime' ? WHATSAPP_URL : `/demande-acces?plan=${offer.planId}&billing=${offer.billingChoice}`}
                target={offer.planId === 'lifetime' ? '_blank' : undefined}
                rel={offer.planId === 'lifetime' ? 'noreferrer' : undefined}
                className={`mt-8 flex h-12 w-full items-center justify-center rounded-2xl border text-sm font-black transition duration-300 hover:-translate-y-0.5 active:translate-y-0 ${
                  featured
                    ? 'border-gold-300/60 bg-gold-400 text-carbon-950 shadow-gold hover:bg-gold-300'
                    : 'border-white/15 bg-white/[0.06] text-white hover:border-gold-300/40 hover:bg-gold-400/10 hover:text-gold-200 light:border-carbon-200 light:bg-white light:text-carbon-950 light:hover:border-gold-300/60 light:hover:bg-gold-50'
                }`}
              >
                {offer.planId === 'lifetime' ? 'Nous contacter' : 'Demander votre accès'}
              </a>
              {offer.planId !== 'lifetime' ? <p className="mt-3 text-center text-xs font-bold text-gold-300">7 jours gratuits · Sans carte bancaire</p> : null}
            </Card>
          )})}
        </div>
        <div className="mt-8 text-center text-sm font-semibold text-carbon-300 light:text-carbon-600">
          <p>Tous les plans incluent 7 jours d’essai gratuit.</p>
          <p className="mt-1 font-bold text-gold-300">Engagement minimum: 6 mois.</p>
        </div>
      </div>
    </div>
  );
}
