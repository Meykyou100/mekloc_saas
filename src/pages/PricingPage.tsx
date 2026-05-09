import { ArrowLeft, CheckCircle2, Crown, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { plans } from '../data/mockData';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-8 text-white light:bg-carbon-50 light:text-carbon-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200 light:text-carbon-700">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        <div className="mt-12 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold-300">Subscription</p>
          <h1 className="mt-4 text-4xl font-black text-white light:text-carbon-950 sm:text-6xl">
            Plans for every Moroccan rental agency.
          </h1>
          <p className="mt-5 text-lg leading-8 text-carbon-300 light:text-carbon-600">
            Pick a plan today and upgrade when your fleet, team, or branch count grows.
          </p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`p-6 ${plan.featured ? 'border-gold-300/50 bg-gold-400/[0.08] shadow-gold' : ''}`}
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="rounded-2xl border border-gold-300/20 bg-gold-400/10 p-3 text-gold-200">
                  {plan.name === 'Business' ? <Crown className="h-6 w-6" /> : plan.featured ? <Sparkles className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                </div>
                {plan.featured ? <span className="rounded-full bg-gold-400 px-3 py-1 text-xs font-black text-carbon-950">Most chosen</span> : null}
              </div>
              <h2 className="text-2xl font-black text-white light:text-carbon-950">{plan.name}</h2>
              <p className="mt-2 min-h-12 text-sm text-carbon-400 light:text-carbon-600">{plan.note}</p>
              <p className="mt-6 text-4xl font-black text-white light:text-carbon-950">
                {plan.price}
                <span className="text-base font-semibold text-carbon-400">{plan.cadence}</span>
              </p>
              <div className="mt-6 grid gap-3">
                {plan.features.map((feature) => (
                  <p key={feature} className="flex items-center gap-2 text-sm text-carbon-300 light:text-carbon-700">
                    <CheckCircle2 className="h-4 w-4 text-gold-300" />
                    {feature}
                  </p>
                ))}
              </div>
              <Link to="/auth" className="mt-8 block">
                <Button className="w-full" variant={plan.featured ? 'primary' : 'secondary'}>
                  Start {plan.name}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
