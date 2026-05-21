import { useMemo, useState } from 'react';
import {
  Bell,
  Building2,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  Facebook,
  Gauge,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  PenLine,
  Rocket,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

const whatsappNumber = '212762971653';
const contactEmail = 'younesmekki100@gmail.com';

const benefits = [
  {
    title: 'Réservations centralisées',
    text: 'Gérez vos réservations, départs et retours en quelques clics.',
    icon: CalendarDays,
  },
  {
    title: 'Contrats PDF automatiques',
    text: 'Générez des contrats PDF personnalisés avec votre logo.',
    icon: FileText,
  },
  {
    title: 'Suivi flotte en temps réel',
    text: 'Disponibilités, statuts et historique de chaque véhicule.',
    icon: Car,
  },
  {
    title: 'Paiements & cautions',
    text: 'Suivez paiements, factures et cautions en MAD en toute simplicité.',
    icon: CreditCard,
  },
  {
    title: 'Alertes assurance / visite technique',
    text: 'Assurance, visite technique, vidange... ne rien oublier.',
    icon: Bell,
  },
  {
    title: 'Équipe multi-utilisateur',
    text: 'Travaillez à plusieurs avec des rôles et accès sécurisés.',
    icon: Users,
  },
];

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    note: 'Pour les petites agences',
    price: '249',
    icon: Rocket,
    features: [
      'Jusqu’à 5 véhicules',
      'Réservations',
      'Clients',
      'Contrats PDF',
      'Paiements basic',
      'Entretien basic',
      'Support standard',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    note: 'Pour les agences qui veulent aller plus loin',
    price: '399',
    icon: ShieldCheck,
    recommended: true,
    features: [
      'Véhicules illimités',
      'Réservations illimitées',
      'Clients illimités',
      'Contrats PDF illimités',
      'Paiements & factures',
      'Entretien avancé',
      'Alertes WhatsApp',
      'Équipe / multi-utilisateurs',
      'Rapports',
      'Support prioritaire',
    ],
  },
];

const faqs = [
  [
    'Comment demander un accès ?',
    'Cliquez sur Essai gratuit, remplissez la demande d’accès et vérifiez votre email.',
  ],
  [
    'Est-ce adapté aux agences marocaines ?',
    'Oui. MekLoc est pensé pour les agences de location au Maroc: MAD, cautions, contrats PDF, WhatsApp et échéances véhicules.',
  ],
  [
    'Puis-je gérer plusieurs utilisateurs ?',
    'Oui. Le plan Business permet de travailler à plusieurs avec des rôles et accès sécurisés.',
  ],
  [
    'Les contrats PDF sont-ils personnalisés avec mon logo ?',
    'Oui. Les contrats utilisent les informations de votre agence et votre logo.',
  ],
  [
    'Les alertes WhatsApp sont-elles incluses ?',
    'Oui, les alertes et messages WhatsApp sont inclus dans le plan Business.',
  ],
];

const socialLinks = [
  { label: 'LinkedIn', icon: Linkedin, href: 'https://www.linkedin.com/' },
  { label: 'Instagram', icon: Instagram, href: 'https://www.instagram.com/' },
  { label: 'Facebook', icon: Facebook, href: 'https://www.facebook.com/' },
  { label: 'WhatsApp', icon: MessageCircle, href: `https://wa.me/${whatsappNumber}` },
  { label: 'Email', icon: Mail, href: `mailto:${contactEmail}` },
];

function LogoMark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const boxSize = size === 'lg' ? 'h-16 w-48 sm:h-20 sm:w-64' : 'h-9 w-28 sm:h-10 sm:w-36';

  return (
    <div className={`grid ${boxSize} shrink-0 place-items-center overflow-hidden`}>
      <img src="/mekloc-logo-dark.png" alt="MekLoc" className="h-full w-full object-contain drop-shadow-[0_0_18px_rgba(227,177,23,.22)]" />
    </div>
  );
}

function LandingHeader() {
  return (
    <header className="border-b border-white/[0.08] bg-[#050606]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <LogoMark />
        </Link>

        <nav className="hidden items-center gap-9 text-sm font-semibold text-white/84 lg:flex">
          <a href="#fonctionnalites" className="hover:text-[#F5C542]">Fonctionnalités</a>
          <a href="#tarifs" className="hover:text-[#F5C542]">Tarifs</a>
          <a href="#faq" className="hover:text-[#F5C542]">FAQ</a>
          <a href="#contact" className="hover:text-[#F5C542]">Contact</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="secondary" className="h-10 rounded-xl border-white/20 px-3 text-xs sm:h-11 sm:px-5 sm:text-sm">
              Connexion
            </Button>
          </Link>
          <Link to="/demande-acces">
            <Button className="h-10 rounded-xl bg-[#E3B117] px-3 text-xs text-[#070807] hover:bg-[#F5C542] sm:h-11 sm:px-5 sm:text-sm">
              Essai gratuit
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-[1.65rem] border border-[#E3B117]/32 bg-[#070807] shadow-[0_30px_95px_rgba(0,0,0,.58)]">
      <img
        src="/landing/luxury-dashboard.png"
        alt="Aperçu premium du tableau de bord MekLoc"
        className="block h-auto w-full"
      />
    </div>
  );
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.045] to-white/[0.018] shadow-[0_18px_60px_rgba(0,0,0,.24)] ${className}`}>
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [demoForm, setDemoForm] = useState({ agency: '', phone: '', email: '', need: '' });

  const demoWhatsappUrl = useMemo(() => {
    const message = [
      'Bonjour MekLoc, je souhaite réserver une démo.',
      demoForm.agency ? `Agence : ${demoForm.agency}` : '',
      demoForm.phone ? `WhatsApp : ${demoForm.phone}` : '',
      demoForm.email ? `Email : ${demoForm.email}` : '',
      demoForm.need ? `Besoin : ${demoForm.need}` : '',
    ].filter(Boolean).join('\n');

    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  }, [demoForm]);

  const baseWhatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    'Bonjour MekLoc, je souhaite réserver une démo.'
  )}`;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050606] text-white">
      <LandingHeader />

      <main className="bg-[radial-gradient(circle_at_28%_4%,rgba(227,177,23,.08),transparent_34%),linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:auto,72px_72px,72px_72px]">
        <section className="border-b border-white/[0.08]">
          <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-4 py-9 sm:px-6 lg:grid-cols-[0.76fr_1.24fr] lg:py-8">
            <div className="max-w-[520px]">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E3B117]/28 bg-[#E3B117]/10 px-4 py-2 text-sm font-semibold text-[#F5C542]">
                <Gauge className="h-4 w-4" />
                SaaS de gestion pour agences de location au Maroc
              </div>

              <h1 className="text-4xl font-black leading-[1.03] tracking-[-0.01em] text-white sm:text-5xl lg:text-[4rem]">
                Gérez vos réservations, véhicules et contrats en{' '}
                <span className="text-[#E3B117]">un seul endroit</span>
              </h1>

              <p className="mt-6 text-lg leading-8 text-white/68">
                Centralisez votre flotte, vos clients, vos contrats PDF, vos paiements et vos alertes
                dans une plateforme pensée pour les agences de location au Maroc.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/demande-acces">
                  <Button className="h-14 w-full rounded-xl bg-[#E3B117] px-7 text-[#070807] shadow-[0_16px_36px_rgba(227,177,23,.22)] hover:bg-[#F5C542] sm:w-auto" icon={<MessageCircle className="h-4 w-4" />}>
                    <span>
                      <span className="block text-sm font-black">Essai gratuit</span>
                      <span className="block text-[11px] font-medium opacity-70">14 jours sans engagement</span>
                    </span>
                  </Button>
                </Link>
                <a href={baseWhatsappUrl} target="_blank" rel="noreferrer">
                  <Button variant="secondary" className="h-14 w-full rounded-xl border-white/12 bg-white/[0.07] px-7 sm:w-auto" icon={<MessageCircle className="h-4 w-4" />}>
                    <span>
                      <span className="block text-sm font-black">Réserver une démo</span>
                      <span className="block text-[11px] font-medium text-white/55">Sur WhatsApp</span>
                    </span>
                  </Button>
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-7 text-sm text-white/72">
                {[
                  [FileText, 'Contrats PDF'],
                  [MessageCircle, 'Alertes WhatsApp'],
                  [CircleDollarSign, 'Paiements en MAD'],
                ].map(([Icon, label]) => (
                  <div key={label as string} className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[#E3B117]" />
                    {label as string}
                  </div>
                ))}
              </div>
            </div>

            <DashboardPreview />
          </div>
        </section>

        <section id="fonctionnalites" className="border-b border-white/[0.08] py-16 sm:py-20">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
            <h2 className="mb-5 text-xl font-black text-white">Pourquoi MekLoc ?</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {benefits.map(({ title, text, icon: Icon }) => (
                <SectionCard key={title} className="p-4">
                  <div className="mb-5 grid h-10 w-10 place-items-center rounded-xl border border-[#E3B117]/25 bg-[#E3B117]/12 text-[#F5C542] shadow-[0_0_24px_rgba(227,177,23,.14)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-black text-white">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-white/56">{text}</p>
                </SectionCard>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.08] bg-[#050606]/55 py-14 sm:py-20">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-black text-white sm:text-4xl">Comment ça marche ?</h2>
              <p className="mt-3 text-sm leading-6 text-white/58">
                Un lancement simple pour passer rapidement de la demande d’accès à la gestion quotidienne.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-[1120px] gap-5 md:grid-cols-3">
              {[
                ['Demandez l’accès', 'Remplissez le formulaire d’accès en quelques secondes.'],
                ['Configurez votre agence', 'Ajoutez vos véhicules, tarifs, documents et préférences.'],
                ['Gérez vos locations', 'Réservations, contrats, paiements, alertes... Tout est centralisé.'],
              ].map(([title, text], index) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ delay: index * 0.12, duration: 0.55, ease: 'easeOut' }}
                  className="group"
                >
                  <SectionCard className="h-full overflow-hidden p-0">
                    <div className="h-1 bg-gradient-to-r from-transparent via-[#F5C542] to-transparent opacity-55 transition group-hover:opacity-100" />
                    <div className="p-7">
                      <motion.span
                        className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-[#E3B117]/40 bg-[#E3B117]/18 text-lg font-black text-[#F5C542] shadow-[0_0_28px_rgba(227,177,23,.18)]"
                        animate={{ boxShadow: ['0 0 18px rgba(227,177,23,.12)', '0 0 36px rgba(227,177,23,.28)', '0 0 18px rgba(227,177,23,.12)'] }}
                        transition={{ duration: 2.6, repeat: Infinity, delay: index * 0.35 }}
                      >
                        {index + 1}
                      </motion.span>
                      <h3 className="mt-7 text-xl font-black text-white">{title}</h3>
                      <p className="mt-3 text-sm leading-6 text-white/58">{text}</p>
                      <div className="mt-7 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]/80">
                        <span className="h-px flex-1 bg-[#E3B117]/25" />
                        Étape {index + 1}
                      </div>
                    </div>
                  </SectionCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="tarifs" className="border-b border-white/[0.08] py-14 sm:py-20">
          <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-black text-white sm:text-4xl">Tarifs simples et transparents</h2>
              <p className="mt-3 text-sm leading-6 text-white/58">
                Deux offres claires pour gérer votre agence avec le niveau de puissance adapté.
              </p>
            </div>
            <div className="mx-auto mt-10 grid max-w-[920px] gap-6 md:grid-cols-2">
              {plans.map((plan) => {
                const Icon = plan.icon;
                return (
                  <SectionCard
                    key={plan.id}
                    className={`p-6 sm:p-7 ${plan.recommended ? 'border-[#E3B117]/70 shadow-[0_0_42px_rgba(227,177,23,.13)]' : ''}`}
                  >
                    {plan.recommended ? (
                      <span className="mb-4 inline-flex rounded-full bg-[#E3B117] px-3 py-1 text-xs font-black text-[#070807]">
                        Recommandé
                      </span>
                    ) : null}
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-[#F5C542]" />
                      <div>
                        <h3 className="font-black text-white">{plan.name}</h3>
                        <p className="text-[11px] text-white/48">{plan.note}</p>
                      </div>
                    </div>
                    <p className="mt-5 text-4xl font-black text-white">
                      {plan.price}
                      <span className="ml-1 text-base font-semibold text-white/66">MAD</span>
                      <span className="ml-1 text-sm font-medium text-white/48">/mois</span>
                    </p>
                    <div className="mt-6 space-y-2.5">
                      {plan.features.map((feature) => (
                        <p key={feature} className="flex items-center gap-2 text-sm text-white/72">
                          <Check className="h-3.5 w-3.5 text-[#F5C542]" />
                          {feature}
                        </p>
                      ))}
                    </div>
                    <Link to={`/demande-acces?plan=${plan.id}`} className="mt-6 block">
                      <Button
                        className={`h-10 w-full rounded-lg ${plan.recommended ? 'bg-[#E3B117] text-[#070807] hover:bg-[#F5C542]' : 'border-[#E3B117]/45 bg-transparent text-[#F5C542] hover:bg-[#E3B117]/10'}`}
                        variant={plan.recommended ? 'primary' : 'secondary'}
                      >
                        Choisir {plan.name}
                      </Button>
                    </Link>
                  </SectionCard>
                );
              })}
            </div>
          </div>
        </section>

        <section id="faq" className="border-b border-white/[0.08] bg-[#050606]/55 py-14 sm:py-20">
          <div className="mx-auto max-w-[760px] px-4 sm:px-6">
            <h2 className="text-center text-3xl font-black text-white sm:text-4xl">Questions fréquentes</h2>
            <div className="mt-10 space-y-3">
              {faqs.map(([question, answer]) => (
                <details key={question} className="group rounded-xl border border-white/[0.08] bg-white/[0.035]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-sm font-bold text-white">
                    {question}
                    <ChevronDown className="h-4 w-4 shrink-0 text-white/70 transition group-open:rotate-180" />
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-6 text-white/56">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="border-b border-white/[0.08] bg-[#050606] py-16 sm:py-24">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[360px_1fr] lg:items-start">
              <div className="flex min-h-[540px] flex-col justify-between gap-10 rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.015))] p-6 sm:p-8">
                <div>
                  <div className="flex items-center gap-4">
                    <LogoMark size="lg" />
                  </div>
                  <h2 className="mt-10 max-w-md text-3xl font-black leading-tight text-white sm:text-4xl">
                    La plateforme tout-en-un pour les agences de location automobile au Maroc.
                  </h2>
                  <p className="mt-6 max-w-md text-base leading-8 text-white/68">
                    MekLoc centralise vos réservations, véhicules, contrats, paiements et alertes
                    dans un seul outil pensé pour simplifier votre quotidien et accélérer votre croissance.
                  </p>
                </div>

                <div>
                  <p className="mb-4 font-black text-[#F5C542]">Suivez MekLoc</p>
                  <div className="flex flex-wrap gap-3">
                    {socialLinks.map(({ label, icon: Icon, href }) => (
                      <a
                        key={label}
                        href={href}
                        target={href.startsWith('http') ? '_blank' : undefined}
                        rel={href.startsWith('http') ? 'noreferrer' : undefined}
                        aria-label={label}
                        className="grid h-12 w-12 place-items-center rounded-xl border border-[#E3B117]/22 bg-white/[0.035] text-[#F5C542] transition hover:border-[#E3B117]/55 hover:bg-[#E3B117]/10"
                      >
                        <Icon className="h-5 w-5" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <SectionCard className="overflow-hidden rounded-[1.75rem] p-0">
                <div className="h-px bg-gradient-to-r from-transparent via-[#F5C542] to-transparent" />
                <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.82fr_1fr] lg:p-12">
                  <div className="flex flex-col justify-between gap-8 border-white/[0.08] lg:border-r lg:pr-10">
                    <div>
                      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#E3B117]/35 bg-[#E3B117]/10 text-[#F5C542] shadow-[0_0_28px_rgba(227,177,23,.16)]">
                        <CalendarDays className="h-7 w-7" />
                      </span>
                      <h2 className="mt-8 text-3xl font-black leading-tight text-white sm:text-4xl">
                        Réservez une session de cadrage
                      </h2>
                      <p className="mt-6 text-base leading-8 text-white/68">
                        Partagez votre besoin (taille flotte, ville, opérations). Nous vous aidons à lancer MekLoc rapidement.
                      </p>
                    </div>
                    <p className="flex items-center gap-3 text-sm font-bold text-[#F5C542]">
                      <Zap className="h-5 w-5" />
                      Réponse rapide sous 24h
                    </p>
                  </div>

                  <div className="space-y-4">
                    <label className="flex h-16 items-center gap-4 rounded-xl border border-white/[0.1] bg-white/[0.055] px-5 text-white/72">
                      <Building2 className="h-5 w-5 text-white/56" />
                      <input
                        className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/42"
                        placeholder="Nom de l’agence"
                        value={demoForm.agency}
                        onChange={(event) => setDemoForm((current) => ({ ...current, agency: event.target.value }))}
                      />
                    </label>
                    <label className="flex h-16 items-center gap-4 rounded-xl border border-white/[0.1] bg-white/[0.055] px-5 text-white/72">
                      <MessageCircle className="h-5 w-5 text-white/56" />
                      <input
                        className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/42"
                        placeholder="Numéro WhatsApp"
                        value={demoForm.phone}
                        onChange={(event) => setDemoForm((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </label>
                    <label className="flex h-16 items-center gap-4 rounded-xl border border-white/[0.1] bg-white/[0.055] px-5 text-white/72">
                      <Mail className="h-5 w-5 text-white/56" />
                      <input
                        className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/42"
                        placeholder="Votre email"
                        type="email"
                        value={demoForm.email}
                        onChange={(event) => setDemoForm((current) => ({ ...current, email: event.target.value }))}
                      />
                    </label>
                    <label className="flex min-h-36 items-start gap-4 rounded-xl border border-white/[0.1] bg-white/[0.055] px-5 py-4 text-white/72">
                      <PenLine className="mt-1 h-5 w-5 shrink-0 text-white/56" />
                      <textarea
                        className="min-h-24 min-w-0 flex-1 resize-none bg-transparent text-base text-white outline-none placeholder:text-white/42"
                        placeholder="Décrivez votre besoin"
                        value={demoForm.need}
                        onChange={(event) => setDemoForm((current) => ({ ...current, need: event.target.value }))}
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <a href={demoWhatsappUrl} target="_blank" rel="noreferrer">
                        <Button className="h-14 w-full rounded-xl bg-[#E3B117] text-base text-[#070807] shadow-[0_16px_36px_rgba(227,177,23,.2)] hover:bg-[#F5C542]" icon={<CalendarDays className="h-5 w-5" />}>
                          Demander une démo
                        </Button>
                      </a>
                      <a href={`mailto:${contactEmail}?subject=${encodeURIComponent('Démo MekLoc')}`}>
                        <Button variant="secondary" className="h-14 w-full rounded-xl border-white/14 bg-white/[0.06] text-base" icon={<Mail className="h-5 w-5" />}>
                          Envoyer un email
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                [MessageCircle, 'WhatsApp direct', 'Réponse rapide', '+212 6 00 00 00 00'],
                [Mail, 'Par email', 'Écrivez-nous', contactEmail],
                [Clock3, 'Appel de cadrage', '30 minutes', 'Échange personnalisé'],
              ].map(([Icon, title, subtitle, value]) => (
                <SectionCard key={title as string} className="flex items-center gap-5 p-6">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#E3B117]/20 bg-[#E3B117]/10 text-[#F5C542]">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="text-lg font-black text-white">{title as string}</h3>
                    <p className="mt-1 text-sm text-white/55">{subtitle as string}</p>
                    <p className="mt-2 font-black text-[#F5C542]">{value as string}</p>
                  </div>
                </SectionCard>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#050606] px-4 pb-8 sm:px-6">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8 rounded-t-[1.75rem] border border-white/[0.08] border-b-0 bg-[linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.015))] px-6 py-8 text-sm text-white/54 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size="lg" />
          </div>
          <p>© 2026 MekLoc. Tous droits réservés.</p>
          <div className="flex flex-wrap gap-6">
            <a href="#fonctionnalites" className="hover:text-[#F5C542]">Fonctionnalités</a>
            <a href="#tarifs" className="hover:text-[#F5C542]">Tarifs</a>
            <a href="#faq" className="hover:text-[#F5C542]">FAQ</a>
            <Link to="/conditions-utilisation" className="hover:text-[#F5C542]">Conditions</Link>
            <Link to="/politique-confidentialite" className="hover:text-[#F5C542]">Confidentialité</Link>
            <Link to="/annulation-remboursement" className="hover:text-[#F5C542]">Annulation & remboursement</Link>
          </div>
          <div className="flex gap-3">
            {socialLinks.map(({ label, icon: Icon, href }) => (
              <a
                key={label}
                href={label === 'WhatsApp' ? baseWhatsappUrl : href}
                target={href.startsWith('http') || label === 'WhatsApp' ? '_blank' : undefined}
                rel={href.startsWith('http') || label === 'WhatsApp' ? 'noreferrer' : undefined}
                aria-label={label}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-white transition hover:border-[#E3B117]/35 hover:text-[#F5C542]"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
