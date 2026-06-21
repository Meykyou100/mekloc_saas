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
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(227,177,23,.13),transparent_30%),#050606] px-4 py-5 text-white light:bg-[radial-gradient(circle_at_50%_0%,rgba(227,177,23,.12),transparent_30%),#f8f5ed] light:text-carbon-950 sm:px-6 sm:py-10 lg:px-8">
      <SEO
        title="Tarifs MekLoc – Logiciel location voiture Maroc"
        description="Consultez les tarifs MekLoc pour gérer une agence de location de voitures au Maroc : réservations, flotte, contrats PDF, paiements et entretien."
        canonical="/tarifs"
        jsonLd={baseStructuredData()}
      />
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200 light:text-carbon-700">
          <ArrowLeft className="h-4 w-4" />
          Retour à l’accueil
        </Link>
        <div className="mx-auto mt-8 max-w-3xl text-center sm:mt-14">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-gold-300 sm:text-xs sm:tracking-[0.28em]">Plans & abonnement</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white light:text-carbon-950 sm:mt-3 sm:text-5xl">Tarifs MekLoc</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-carbon-300 light:text-carbon-600 sm:text-base sm:leading-7">
            Tous les plans incluent 7 jours d’essai gratuit. Choisissez une durée claire selon votre agence.
          </p>
          <p className="mt-2 text-sm font-black text-gold-300 sm:mt-3">Engagement minimum : 6 mois</p>
        </div>
        <div className="mx-auto mt-7 flex w-full max-w-md gap-1 rounded-2xl border border-white/10 bg-black/35 p-1.5 shadow-[0_12px_30px_rgba(0,0,0,.22)] light:border-carbon-200 light:bg-white light:shadow-[0_10px_25px_rgba(68,52,20,.08)] sm:mt-8">
          {([['six_months', '6 mois'], ['annual', '12 mois'], ['lifetime', 'Lifetime']] as Array<[MekLocBillingChoice, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setBillingChoice(value)} className={`h-10 min-w-0 flex-1 rounded-xl px-2 text-sm font-black transition sm:px-4 ${billingChoice === value ? 'bg-gold-400 text-carbon-950 shadow-[0_3px_12px_rgba(227,177,23,.2)]' : 'text-carbon-300 hover:text-white light:text-carbon-600 light:hover:text-carbon-950'}`}>{label}</button>)}
        </div>
        <div className={`mx-auto mt-8 grid justify-items-center gap-5 sm:mt-10 sm:gap-6 ${billingChoice === 'lifetime' ? 'max-w-md' : 'max-w-5xl md:grid-cols-2 lg:grid-cols-3'}`}>
          {offers.map((offer) => {
            const plan = MEKLOC_PLANS[offer.planId];
            const featured = offer.planId === 'pro' || offer.planId === 'lifetime';
            const price = `${offer.price.toLocaleString('fr-FR')} MAD`;
            return (
            <Card
              key={`${offer.planId}-${offer.billingChoice}`}
              className={`relative flex w-full max-w-[22rem] min-h-full flex-col overflow-hidden rounded-[26px] border p-5 shadow-[0_20px_55px_rgba(0,0,0,.22)] sm:max-w-none sm:rounded-[28px] sm:p-6 ${featured ? 'border-gold-300/50 bg-[linear-gradient(155deg,rgba(227,177,23,.15),rgba(15,16,18,.96)_28%,rgba(6,7,8,1))] shadow-[0_20px_65px_rgba(227,177,23,.12)]' : 'border-white/10 bg-[linear-gradient(155deg,rgba(255,255,255,.055),rgba(15,16,18,.96)_28%,rgba(6,7,8,1))]'} light:bg-white`}
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="rounded-2xl border border-gold-300/25 bg-gold-400/10 p-3 text-gold-200">
                  {plan.name === 'Lifetime' ? <Infinity className="h-6 w-6" /> : plan.name === 'Business' || plan.name === 'Pro' ? <Crown className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                </div>
                {offer.badge ? <span className="rounded-full bg-gold-400 px-3 py-1 text-xs font-black text-carbon-950">{offer.badge}</span> : null}
              </div>
              <h2 className="text-[1.65rem] font-black leading-none text-white light:text-carbon-950 sm:text-2xl">{offer.name}</h2>
              <p className="mt-1 text-sm font-bold text-gold-300">{plan.persona}</p>
              <p className="mt-2 min-h-10 text-sm leading-5 text-carbon-400 light:text-carbon-600">{plan.note}</p>
              <div className="mt-5 border-y border-white/10 py-4 light:border-carbon-100"><p className="text-3xl font-black tracking-tight text-white light:text-carbon-950 sm:text-4xl">
                {price}
                <span className="text-base font-semibold text-carbon-400"> {offer.packageLabel}</span>
              </p><p className="mt-2 text-sm font-bold text-gold-300">{offer.equivalentLabel}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-carbon-500">{offer.commitment}</p></div>
              <p className="mt-4 text-sm font-bold text-carbon-200 light:text-carbon-800">{plan.usersLabel} <span className="mx-1 text-gold-300">·</span> {plan.vehiclesLabel}</p>
              <div className="mt-5 grid grow gap-2.5 border-t border-white/10 pt-5 light:border-carbon-100">
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
                className={`mt-6 flex h-12 w-full items-center justify-center rounded-2xl border text-sm font-black transition duration-300 hover:-translate-y-0.5 active:translate-y-0 sm:h-[3.25rem] ${
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
        <p className="mx-auto mt-7 max-w-sm text-center text-sm leading-6 font-semibold text-carbon-300 light:text-carbon-600 sm:mt-8">Tous les plans incluent 7 jours d’essai gratuit.</p>
      </div>
    </div>
  );
}
