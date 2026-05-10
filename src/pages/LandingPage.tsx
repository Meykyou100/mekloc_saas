import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  MessageCircle,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { features, plans } from '../data/mockData';
import { useApp } from '../context/AppContext';

function DashboardMockup() {
  const bars = [44, 72, 58, 86, 64, 92, 78];

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 26, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.75, ease: 'easeOut' }}
    >
      <Card className="overflow-hidden rounded-[1.75rem] border-gold-300/20 bg-carbon-900/86 shadow-gold">
        <div className="border-b border-white/10 bg-white/[0.04] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-400" />
            <span className="h-3 w-3 rounded-full bg-gold-400" />
            <span className="h-3 w-3 rounded-full bg-mint-400" />
            <span className="ml-auto text-xs font-semibold text-carbon-300">MekLoc Command</span>
          </div>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-[1fr_1.25fr]">
          <div className="grid gap-3">
            {['Vehicles', 'Active rentals', 'Revenue'].map((label, index) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                <p className="text-xs text-carbon-400">{label}</p>
                <p className="mt-2 text-2xl font-black text-white">
                  {index === 0 ? '64' : index === 1 ? '27' : '184K'}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-carbon-950/60 p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold text-white">Revenue pulse</p>
              <span className="rounded-full bg-gold-400/15 px-3 py-1 text-xs font-bold text-gold-200">
                +18%
              </span>
            </div>
            <div className="flex h-48 items-end gap-2">
              {bars.map((height, index) => (
                <motion.div
                  key={index}
                  className="flex-1 rounded-t-xl bg-gradient-to-t from-gold-700 via-gold-400 to-gold-200"
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ delay: index * 0.08, duration: 0.6 }}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>
      <motion.div
        className="glass-card absolute -left-5 top-12 hidden rounded-2xl p-4 shadow-gold md:block"
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
      >
        <p className="text-xs text-carbon-300">Next return</p>
        <p className="mt-1 font-bold text-white">BMW X5 · 16:30</p>
      </motion.div>
      <motion.div
        className="glass-card absolute -bottom-6 right-8 hidden rounded-2xl p-4 shadow-gold md:block"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 4.8, ease: 'easeInOut' }}
      >
        <p className="text-xs text-carbon-300">Payment captured</p>
        <p className="mt-1 font-bold text-gold-200">9,000 MAD</p>
      </motion.div>
    </motion.div>
  );
}

function LandingHeader() {
  const { t } = useApp();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-carbon-950/70 backdrop-blur-2xl light:bg-white/75">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-400 text-xl font-black text-carbon-950 shadow-gold">
            M
          </span>
          <span>
            <span className="block text-xl font-black text-white light:text-carbon-950">MekLoc</span>
            <span className="hidden text-xs text-carbon-400 sm:block">Smart Rental Management System</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-carbon-300 lg:flex">
          <a href="#features" className="hover:text-white light:hover:text-carbon-950">
            Fonctionnalités
          </a>
          <a href="#pricing" className="hover:text-white light:hover:text-carbon-950">
            Tarifs
          </a>
          <a href="#faq" className="hover:text-white light:hover:text-carbon-950">
            FAQ
          </a>
          <a href="#contact" className="hover:text-white light:hover:text-carbon-950">
            Contact
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" className="block">
            <Button variant="secondary" className="h-10 px-3 sm:px-4">
              Connexion
            </Button>
          </Link>
          <Link to="/auth">
            <Button className="h-10 px-3 sm:px-4">{t('startFree')}</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function LandingPage() {
  const { t } = useApp();

  return (
    <div className="min-h-screen overflow-hidden bg-carbon-950 text-white light:bg-carbon-50 light:text-carbon-950">
      <LandingHeader />
      <main>
        <section className="surface-grid bg-surface-grid">
          <div className="mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-300/20 bg-gold-400/10 px-4 py-2 text-sm font-semibold text-gold-200 light:text-gold-800"
              >
                <Sparkles className="h-4 w-4" />
                Conçu pour les agences de location au Maroc
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="max-w-4xl text-5xl font-black leading-[1.02] text-white light:text-carbon-950 sm:text-6xl lg:text-7xl"
              >
                Gérez votre agence de location <span className="gold-text">plus intelligemment</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="mt-6 max-w-2xl text-lg leading-8 text-carbon-300 light:text-carbon-600"
              >
                Centralize reservations, contracts, payments and fleet management in one powerful
                platform.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24 }}
                className="mt-8 flex flex-col gap-3 sm:flex-row"
              >
                <Link to="/auth">
                  <Button className="w-full sm:w-auto" icon={<ArrowRight className="h-4 w-4" />}>
                    {t('startFree')}
                  </Button>
                </Link>
                <a href="#contact">
                  <Button
                    variant="secondary"
                    className="w-full sm:w-auto"
                    icon={<PlayCircle className="h-4 w-4" />}
                  >
                    {t('bookDemo')}
                  </Button>
                </a>
              </motion.div>
              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {['Contracts in seconds', 'WhatsApp-ready flows', 'MAD revenue tracking'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-carbon-300 light:text-carbon-700">
                    <CheckCircle2 className="h-4 w-4 text-gold-300" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <DashboardMockup />
          </div>
        </section>

        <section id="features" className="border-y border-white/10 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold-300">Platform</p>
              <h2 className="mt-3 text-3xl font-black text-white light:text-carbon-950 sm:text-4xl">
                Everything an agency needs to operate with confidence.
              </h2>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {features.map(({ title, icon: Icon }, index) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Card interactive className="h-full p-5">
                    <div className="mb-5 inline-flex rounded-2xl border border-gold-300/20 bg-gold-400/10 p-3 text-gold-200 light:text-gold-800">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-white light:text-carbon-950">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-carbon-400 light:text-carbon-600">
                      Clean workflows with smart states, reminders, and team visibility.
                    </p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold-300">Tarifs</p>
                <h2 className="mt-3 text-3xl font-black text-white light:text-carbon-950 sm:text-4xl">
                  Start lean, scale into every branch.
                </h2>
              </div>
              <Link to="/pricing">
                <Button variant="secondary">View subscription page</Button>
              </Link>
            </div>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {plans.map((plan) => (
                <Card
                  key={plan.name}
                  className={`p-6 ${plan.featured ? 'border-gold-300/50 bg-gold-400/[0.08] shadow-gold' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-black text-white light:text-carbon-950">{plan.name} Plan</h3>
                      <p className="mt-2 text-sm text-carbon-400 light:text-carbon-600">{plan.note}</p>
                    </div>
                    {plan.featured ? (
                      <span className="rounded-full bg-gold-400 px-3 py-1 text-xs font-black text-carbon-950">
                        Populaire
                      </span>
                    ) : null}
                  </div>
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
                  <Link to="/auth" className="mt-7 block">
                    <Button className="w-full" variant={plan.featured ? 'primary' : 'secondary'}>
                      Choisir {plan.name}
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 py-20">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
            {[
              {
                quote:
                  'MekLoc gives our Marrakech desk one clean place to see cars, clients, contracts, and cash.',
                name: 'Nadia R.',
                role: 'Agency owner',
              },
              {
                quote:
                  'Our handoffs are faster and fewer payments slip through because every reservation has a clear state.',
                name: 'Hamza B.',
                role: 'Operations manager',
              },
              {
                quote:
                  'The UI feels premium enough for our luxury clients and simple enough for daily staff work.',
                name: 'Lina M.',
                role: 'Fleet coordinator',
              },
            ].map((testimonial) => (
              <Card key={testimonial.name} className="p-6">
                <div className="flex gap-1 text-gold-300">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-5 text-base leading-7 text-carbon-200 light:text-carbon-700">
                  “{testimonial.quote}”
                </p>
                <p className="mt-6 font-bold text-white light:text-carbon-950">{testimonial.name}</p>
                <p className="text-sm text-carbon-400">{testimonial.role}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="faq" className="py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold-300">FAQ</p>
              <h2 className="mt-3 text-3xl font-black text-white light:text-carbon-950">Questions fréquentes.</h2>
            </div>
            <div className="mt-10 grid gap-3">
              {[
                ['Comment demander un accès ?', 'Utilisez le bouton “Demander un accès”, puis suivez votre statut de vérification.'],
                ['Does it support Moroccan rental workflows?', 'The interface is designed around MAD pricing, CIN/passport fields, WhatsApp follow-up, insurance, and technical inspection reminders.'],
                ['Can my team use different roles?', 'Yes. Settings include Admin, Manager, and Staff role management UI.'],
              ].map(([question, answer]) => (
                <Card key={question} className="p-5">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-white light:text-carbon-950">
                      {question}
                      <ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
                    </summary>
                    <p className="mt-4 text-sm leading-6 text-carbon-300 light:text-carbon-600">{answer}</p>
                  </details>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="pb-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Card className="grid gap-8 p-6 md:grid-cols-[1fr_0.9fr] md:p-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold-300">Contact</p>
                <h2 className="mt-3 text-3xl font-black text-white light:text-carbon-950">
                  Réservez une session de cadrage.
                </h2>
                <p className="mt-4 max-w-xl text-carbon-300 light:text-carbon-600">
                  Tell us about your fleet, branches, and contract workflow. MekLoc can be shaped to fit your agency before backend integration.
                </p>
                <div className="mt-8 flex items-center gap-3 text-sm text-carbon-300 light:text-carbon-700">
                  <Clock3 className="h-5 w-5 text-gold-300" />
                  Appel de cadrage: 30 minutes
                </div>
              </div>
              <form className="grid gap-3">
                <input className="focus-ring rounded-xl border border-white/10 bg-carbon-950/45 px-4 py-3 text-white light:bg-white light:text-carbon-950" placeholder="Agency name" />
                <input className="focus-ring rounded-xl border border-white/10 bg-carbon-950/45 px-4 py-3 text-white light:bg-white light:text-carbon-950" placeholder="WhatsApp number" />
                <textarea className="focus-ring min-h-28 rounded-xl border border-white/10 bg-carbon-950/45 px-4 py-3 text-white light:bg-white light:text-carbon-950" placeholder="Tell us about your fleet" />
                <Button type="button" icon={<ShieldCheck className="h-4 w-4" />}>Demander une démo</Button>
              </form>
            </Card>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-sm text-carbon-400 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>© 2026 MekLoc. Smart Rental Management System.</p>
          <div className="flex gap-4">
            <Link to="/dashboard" className="hover:text-gold-200">Tableau</Link>
            <Link to="/pricing" className="hover:text-gold-200">Tarifs</Link>
            <Link to="/auth" className="hover:text-gold-200">Connexion</Link>
          </div>
        </div>
      </footer>
      <a
        href="https://wa.me/212600000000"
        target="_blank"
        rel="noreferrer"
        aria-label="Open WhatsApp"
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-[#25D366] text-white shadow-[0_20px_45px_rgba(37,211,102,.32)] transition hover:-translate-y-1"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
    </div>
  );
}
