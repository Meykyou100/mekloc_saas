import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  CircleDollarSign,
  Cloud,
  Facebook,
  FileCheck2,
  FileText,
  Gauge,
  HelpCircle,
  Instagram,
  Linkedin,
  LogIn,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MonitorCog,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import SEO, { baseStructuredData, faqStructuredData } from '../components/system/SEO';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY, WHATSAPP_URL } from '../config/app';
import { MEKLOC_PLANS } from '../config/pricing';
import { DEFAULT_DESCRIPTION, DEFAULT_KEYWORDS, DEFAULT_TITLE } from '../config/seo';

const whatsappNumber = SUPPORT_PHONE.replace(/^\+/, '');
const contactEmail = SUPPORT_EMAIL;

const navItems = [
  ['Fonctionnalités', '#fonctionnalites'],
  ['Tarifs', '#tarifs'],
  ['FAQ', '#faq'],
  ['Contact', '#contact'],
];

const choiceCards = [
  ['Moins de papier', 'Générez des contrats propres en quelques secondes.', FileText],
  ['Moins d’erreurs', 'Clients, véhicules, dates et montants sont remplis automatiquement.', ShieldCheck],
  ['Plus de contrôle', 'Suivez réservations, cautions, paiements et alertes depuis un seul espace.', Gauge],
];

const beforeItems = [
  'Contrats Word / PDF dispersés',
  'Réservations suivies sur WhatsApp',
  'Paiements difficiles à vérifier',
  'Visites techniques oubliées',
  'Données éparpillées et non sécurisées',
];

const afterItems = [
  'Réservations centralisées',
  'Contrats PDF professionnels',
  'Paiements et cautions suivis',
  'Alertes assurance / visite technique',
  'Historique clair et accessible partout',
];

const steps = [
  ['Demandez votre accès', 'Remplissez le formulaire et notre équipe vous contacte rapidement.', Users],
  ['Ajoutez vos véhicules', 'Importez votre flotte, photos, infos techniques et documents.', Car],
  ['Créez vos réservations', 'Ajoutez vos clients, dates, options et montants en quelques clics.', CalendarDays],
  ['Générez vos contrats PDF', 'Contrats propres, envoyables ou téléchargeables en un instant.', FileCheck2],
];

const previewCards = [
  ['Tableau de bord', 'Vue globale de votre activité en temps réel.', Gauge],
  ['Véhicules', 'Gérez votre flotte, disponibilités, entretien et documents facilement.', Car],
  ['Contrats PDF', 'Générez, personnalisez et envoyez des contrats professionnels.', FileText],
];

const interfaceBenefits = [
  [CalendarDays, 'Réservations centralisées', 'Suivez les départs, retours et disponibilités.'],
  [Car, 'Flotte maîtrisée', 'Gardez une vue claire sur chaque véhicule.'],
  [FileText, 'Contrats PDF propres', 'Préparez des documents cohérents avec votre logo.'],
  [BellRing, 'Alertes importantes', 'Ne manquez plus assurance, visite ou paiement.'],
];

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: MEKLOC_PLANS.starter.monthlyPrice,
    annualPrice: MEKLOC_PLANS.starter.annualPrice,
    annualBillingLabel: MEKLOC_PLANS.starter.annualBillingLabel,
    note: 'Pour les petites agences',
    features: ['Jusqu’à 15 véhicules', 'Réservations illimitées', 'Contrats PDF', 'Paiements & cautions', 'Alertes & rappels', 'Support standard'],
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: MEKLOC_PLANS.business.monthlyPrice,
    annualPrice: MEKLOC_PLANS.business.annualPrice,
    annualBillingLabel: MEKLOC_PLANS.business.annualBillingLabel,
    note: 'Pour les agences en croissance',
    recommended: true,
    features: ['Véhicules illimités', 'Réservations illimitées', 'Contrats illimités', 'Paiements & cautions', 'Alertes & WhatsApp', 'Rapports avancés', 'Support prioritaire'],
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    monthlyPrice: MEKLOC_PLANS.lifetime.lifetimePrice,
    annualPrice: MEKLOC_PLANS.lifetime.lifetimePrice,
    annualBillingLabel: MEKLOC_PLANS.lifetime.annualBillingLabel,
    note: 'Paiement unique',
    lifetime: true,
    features: ['Accès à vie MekLoc', 'Véhicules illimités', 'Réservations illimitées', 'Contrats PDF illimités', 'Paiements & cautions', 'Rapports financiers', 'Support prioritaire'],
  },
];

const faqs: Array<[string, string]> = [
  ['Comment demander un accès ?', 'Réservez une session de cadrage : notre équipe qualifie votre besoin et vous guide vers le bon accès MekLoc.'],
  ['Est-ce adapté aux agences marocaines ?', 'Oui. MekLoc est pensé pour les agences de location au Maroc avec MAD, cautions, contrats PDF et alertes véhicules.'],
  ['Puis-je gérer plusieurs utilisateurs ?', 'Oui. Le plan Business permet de travailler à plusieurs avec des rôles et accès sécurisés.'],
  ['Les contrats PDF sont-ils personnalisés avec mon logo ?', 'Oui. Les contrats utilisent les informations, logo et identité de votre agence.'],
  ['Les alertes WhatsApp sont-elles incluses ?', 'Oui. Les alertes et rappels WhatsApp sont inclus dans l’offre Business.'],
  ['Mes données sont-elles sécurisées ?', 'Oui. Vos données sont isolées par agence, protégées par authentification et accessibles depuis le cloud.'],
];

const socialLinks = [
  ['LinkedIn', Linkedin, 'https://www.linkedin.com/'],
  ['Instagram', Instagram, 'https://www.instagram.com/'],
  ['Facebook', Facebook, 'https://www.facebook.com/'],
  ['WhatsApp', MessageCircle, WHATSAPP_URL],
  ['Email', Mail, `mailto:${contactEmail}`],
];

function whatsappUrl(message: string) {
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

const quickCadrageUrl = whatsappUrl('Bonjour MekLoc, je souhaite réserver une session de cadrage.');

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <img
        src="/mekloc-logo-transparent.png"
        alt="MekLoc"
        className={compact ? 'h-11 w-auto max-w-[142px] object-contain sm:h-10 sm:max-w-[132px]' : 'h-12 w-auto max-w-[168px] object-contain'}
      />
    </span>
  );
}

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-4xl text-center">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5C542] sm:text-sm sm:tracking-[0.2em]">{eyebrow}</p>
      <h2 className="mt-3 text-[28px] font-black leading-tight text-white md:text-4xl">{title}</h2>
      {subtitle ? <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-400">{subtitle}</p> : null}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`landing-card rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900/85 via-zinc-950/82 to-black/90 shadow-[0_22px_70px_rgba(0,0,0,.34)] transition ${className}`}>
      {children}
    </div>
  );
}

function LandingMotionStyles() {
  return (
    <style>{`
      @keyframes mekloc-gradient-shift {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: .82; }
        50% { transform: translate3d(4%, -3%, 0) scale(1.08); opacity: 1; }
      }

      @keyframes mekloc-orb-drift {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
        50% { transform: translate3d(18px, -22px, 0) scale(1.06); }
      }

      @keyframes mekloc-float {
        0%, 100% { transform: translate3d(0, 0, 0); }
        50% { transform: translate3d(0, -10px, 0); }
      }

      @keyframes mekloc-shine {
        0% { transform: translateX(-140%) skewX(-18deg); opacity: 0; }
        30% { opacity: .5; }
        100% { transform: translateX(150%) skewX(-18deg); opacity: 0; }
      }

      .landing-ambient::before,
      .landing-ambient::after {
        content: '';
        position: absolute;
        pointer-events: none;
        border-radius: 9999px;
        filter: blur(56px);
        transform: translateZ(0);
      }

      .landing-ambient::before {
        width: 420px;
        height: 420px;
        left: -110px;
        top: 120px;
        background: rgba(227, 177, 23, .16);
        animation: mekloc-orb-drift 14s ease-in-out infinite;
      }

      .landing-ambient::after {
        width: 480px;
        height: 480px;
        right: -160px;
        top: 210px;
        background: radial-gradient(circle, rgba(245, 197, 66, .18), rgba(227, 177, 23, .05) 42%, transparent 72%);
        animation: mekloc-gradient-shift 18s ease-in-out infinite;
      }

      .landing-gradient-motion {
        background-size: 140% 140%, auto, auto, auto;
        animation: mekloc-gradient-shift 22s ease-in-out infinite;
      }

      .landing-mockup-float {
        animation: mekloc-float 7s ease-in-out infinite;
        will-change: transform;
      }

      .landing-cta-shine {
        position: relative;
        overflow: hidden;
      }

      .landing-cta-shine::after {
        content: '';
        position: absolute;
        inset: -40% auto -40% -55%;
        width: 42%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .52), transparent);
        transform: translateX(-140%) skewX(-18deg);
      }

      .landing-cta-shine:hover::after {
        animation: mekloc-shine .9s ease-out;
      }

      .landing-card {
        transform: translateZ(0);
      }

      .landing-card:hover {
        transform: translate3d(0, -3px, 0);
        box-shadow: 0 26px 82px rgba(0, 0, 0, .38), 0 0 38px rgba(227, 177, 23, .08);
      }

      .landing-reveal {
        opacity: 0;
        transform: translate3d(0, 22px, 0);
        transition: opacity .7s ease, transform .7s ease;
      }

      .landing-reveal.is-visible {
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }

      .landing-stagger > .landing-reveal:nth-child(2) { transition-delay: 90ms; }
      .landing-stagger > .landing-reveal:nth-child(3) { transition-delay: 180ms; }
      .landing-stagger > .landing-reveal:nth-child(4) { transition-delay: 270ms; }

      @media (max-width: 767px) {
        .landing-ambient::before,
        .landing-ambient::after {
          width: 260px;
          height: 260px;
          filter: blur(42px);
          opacity: .72;
        }

        .landing-card:hover {
          transform: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .landing-ambient::before,
        .landing-ambient::after,
        .landing-gradient-motion,
        .landing-mockup-float,
        .landing-cta-shine:hover::after {
          animation: none !important;
        }

        .landing-reveal {
          opacity: 1;
          transform: none;
          transition: none;
        }

        .landing-card,
        .landing-card:hover {
          transform: none;
        }
      }
    `}</style>
  );
}

function LandingHeader() {
  const [open, setOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const mobileNavItems = [
    { label: 'Fonctionnalités', href: '#fonctionnalites', icon: Sparkles },
    { label: 'Tarifs', href: '#tarifs', icon: CircleDollarSign },
    { label: 'FAQ', href: '#faq', icon: HelpCircle },
    { label: 'Contact', href: '#contact', icon: MessageCircle },
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-300 ease-out ${
        isScrolled
          ? 'border-[#E3B117]/10 bg-black/60 shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl'
          : 'border-white/5 bg-black/70 backdrop-blur-xl'
      }`}
    >
      <div className="mx-auto grid h-[72px] w-full max-w-[1440px] grid-cols-[1fr_auto_auto] items-center gap-2 px-4 sm:h-20 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:px-8 xl:px-10">
        <Link to="/" onClick={() => setOpen(false)}><Logo compact /></Link>
        <nav className="hidden items-center gap-10 text-sm font-semibold text-white/80 lg:flex">
          {navItems.map(([label, href]) => (
            <a key={href} href={href} className="transition hover:text-[#F5C542]">{label}</a>
          ))}
        </nav>
        <div className="hidden items-center justify-end gap-3 lg:flex">
          <Link
            to="/login"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.055] px-6 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition hover:border-[#E3B117]/35 hover:bg-white/[0.08]"
          >
            Connexion
          </Link>
          <a
            href={quickCadrageUrl}
            target="_blank"
            rel="noreferrer"
            className="landing-cta-shine inline-flex h-11 items-center justify-center rounded-xl border border-[#F5C542]/40 bg-[#E3B117] px-6 text-sm font-black text-[#070807] shadow-[0_12px_30px_rgba(227,177,23,.22),inset_0_1px_0_rgba(255,255,255,.28)] transition hover:-translate-y-0.5 hover:bg-[#F5C542] active:translate-y-0"
          >
            Réserver une session
          </a>
        </div>
        <a href={quickCadrageUrl} target="_blank" rel="noreferrer" className="lg:hidden">
          <Button className="h-10 rounded-xl border border-[#F5C542]/40 bg-[#E3B117] px-3 text-xs font-black text-[#070807] hover:bg-[#F5C542] sm:px-4">
            Session cadrage
          </Button>
        </a>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={`grid h-10 w-10 place-items-center rounded-xl border text-white transition duration-200 lg:hidden ${
            open ? 'border-[#E3B117]/35 bg-[#E3B117]/10 shadow-[0_0_24px_rgba(227,177,23,.14)]' : 'border-white/10 bg-white/[0.05]'
          }`}
          aria-label="Menu"
          aria-expanded={open}
        >
          <span className="relative grid h-5 w-5 place-items-center">
            <Menu className={`absolute h-5 w-5 transition duration-200 ${open ? 'scale-75 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'}`} />
            <X className={`absolute h-5 w-5 transition duration-200 ${open ? 'scale-100 rotate-0 opacity-100' : 'scale-75 -rotate-90 opacity-0'}`} />
          </span>
        </button>
      </div>

      <div className={`fixed inset-x-0 bottom-0 top-[72px] z-40 transition duration-[250ms] sm:top-20 lg:hidden ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />
        <div
          className={`relative mx-auto mt-3 w-[calc(100%-24px)] max-w-md rounded-3xl border border-[#E3B117]/20 bg-zinc-950/95 p-4 shadow-[0_0_60px_rgba(227,177,23,0.14)] backdrop-blur-xl transition duration-[250ms] ease-out ${
            open ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-3 scale-[0.98] opacity-0'
          }`}
        >
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_80%_0%,rgba(227,177,23,.16),transparent_42%)]" />
          <div className="relative">
            <p className="px-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#F5C542]">Navigation MekLoc</p>
            <div className="mt-4 grid gap-2">
              {mobileNavItems.map(({ label, href, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="group flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-bold text-white transition hover:border-[#E3B117]/30 hover:bg-[#E3B117]/10"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#E3B117]/20 bg-[#E3B117]/10 text-[#F5C542]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">{label}</span>
                  <ArrowRight className="h-4 w-4 text-[#F5C542] transition group-hover:translate-x-0.5" />
                </a>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              <Link to="/login" onClick={() => setOpen(false)}>
                <Button
                  variant="secondary"
                  className="h-14 w-full rounded-2xl border-white/10 bg-white/[0.045] font-black hover:border-[#E3B117]/30"
                  icon={<LogIn className="h-4 w-4" />}
                >
                  Connexion
                </Button>
              </Link>
              <a href={quickCadrageUrl} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
                <Button
                  className="landing-cta-shine h-14 w-full rounded-2xl bg-[#E3B117] font-black text-[#070807] shadow-[0_14px_34px_rgba(227,177,23,.20)] transition hover:-translate-y-0.5 hover:bg-[#F5C542] active:translate-y-0"
                  icon={<CalendarDays className="h-4 w-4" />}
                >
                  Réserver une session
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function DashboardVisual() {
  return (
    <div className="landing-mockup-float relative w-full max-w-[820px] justify-self-end">
      <div className="absolute -left-10 top-8 z-10 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,.45)] backdrop-blur-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F5C542]">Aujourd’hui</p>
        <p className="mt-1 text-sm font-black text-white">12 réservations suivies</p>
      </div>
      <div className="absolute -bottom-6 right-8 z-10 rounded-2xl border border-[#E3B117]/25 bg-[#0b0b09]/80 px-4 py-3 shadow-[0_18px_50px_rgba(227,177,23,.16)] backdrop-blur-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F5C542]">Alertes</p>
        <p className="mt-1 text-sm font-black text-white">Paiements, contrats, flotte</p>
      </div>
      <div className="relative rounded-[2.15rem] border border-[#E3B117]/32 bg-[#070807] p-2.5 shadow-[0_42px_130px_rgba(0,0,0,.66),0_0_90px_rgba(227,177,23,.12)]">
        <div className="absolute -inset-8 -z-10 rounded-full bg-[#E3B117]/16 blur-3xl" />
        <div className="absolute -inset-px -z-10 rounded-[2.15rem] bg-gradient-to-r from-[#E3B117]/50 via-transparent to-[#F5C542]/24 blur-sm" />
        <div className="absolute inset-2 rounded-[1.7rem] border border-white/10" />
        <img src="/landing/luxury-dashboard.png" alt="Aperçu MekLoc" className="block w-full rounded-[1.55rem] object-contain" />
      </div>
    </div>
  );
}

function MobileCommandHero() {
  const commandCards = [
    { icon: CalendarDays, title: 'Réservations', value: '12 aujourd’hui', text: 'Départs & retours suivis', highlighted: true },
    { icon: Car, title: 'Véhicules', value: '34 disponibles', text: 'Flotte prête', highlighted: false },
    { icon: FileText, title: 'Contrats', value: '8 prêts', text: 'PDF générés', highlighted: false },
    { icon: CircleDollarSign, title: 'Paiements', value: '42 800 MAD', text: 'Suivi clair', highlighted: true },
  ];

  return (
    <div className="relative mt-8 overflow-hidden rounded-[28px] border border-[#E3B117]/20 bg-gradient-to-br from-zinc-950/90 via-black to-zinc-950/95 p-4 shadow-[0_0_70px_rgba(227,177,23,.12)] lg:hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,rgba(227,177,23,.20),transparent_38%),linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:auto,38px_38px,38px_38px]" />
      <img
        src="/mekloc-hero-car.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-7 -right-10 w-[86%] opacity-25 mix-blend-screen"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/80 to-transparent" />
      <div className="pointer-events-none absolute -bottom-16 left-1/2 h-36 w-[125%] -translate-x-1/2 rounded-[50%] border border-[#E3B117]/25" />
      <div className="pointer-events-none absolute -bottom-20 left-1/2 h-44 w-[150%] -translate-x-1/2 rounded-[50%] border border-[#F5C542]/10" />

      <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F5C542]">Votre activité en un coup d’œil</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {commandCards.map(({ icon: Icon, title, value, text, highlighted }) => (
            <div
              key={title}
              className={`rounded-2xl border bg-zinc-950/80 p-4 backdrop-blur-md ${
                highlighted
                  ? 'border-[#E3B117]/30 shadow-[0_0_34px_rgba(227,177,23,.10)]'
                  : 'border-white/10'
              }`}
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#E3B117]/20 bg-[#E3B117]/10 text-[#F5C542]">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-bold text-zinc-300">{title}</p>
              <p className="mt-1 text-lg font-black leading-tight text-white">{value}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-500">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-[11px] font-bold text-zinc-300">
          {['Contrats PDF', 'Alertes', 'Paiements', 'Cloud'].map((label) => (
            <span key={label} className="inline-flex min-h-9 items-center justify-center rounded-xl border border-white/10 bg-black/45 px-2 text-center">
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function InterfaceDashboardMockup({ activeTab }: { activeTab: number }) {
  const screens = [
    {
      title: 'Tableau de bord',
      subtitle: 'Vue quotidienne: priorités, réservations, flotte, paiements et alertes.',
      image: '/landing/app-dashboard.png',
      metric: 'Vue agence',
    },
    {
      title: 'Véhicules',
      subtitle: 'Votre flotte réelle avec photos, statuts, documents et tarification.',
      image: '/landing/app-vehicles.jpeg',
      metric: 'Parc automobile',
    },
    {
      title: 'Contrats PDF',
      subtitle: 'Sélection, validation, aperçu et téléchargement de contrats professionnels.',
      image: '/landing/app-contracts.jpeg',
      metric: 'Documents',
    },
  ];
  const activeScreen = screens[activeTab] || screens[0];

  return (
    <div className="relative mx-auto max-w-[1180px] overflow-hidden rounded-[26px] border border-[#E3B117]/25 bg-gradient-to-br from-zinc-950 via-black to-zinc-950 p-2 shadow-[0_0_100px_rgba(227,177,23,0.16)] sm:rounded-[34px] sm:p-3">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F5C542] to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_74%_8%,rgba(227,177,23,.14),transparent_34%)]" />
      <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-[#050606] sm:rounded-[26px]">
        <div className="flex flex-col gap-3 border-b border-white/10 bg-black/55 px-3 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#F5C542]">{activeScreen.metric}</p>
            <h3 className="mt-1 text-lg font-black text-white sm:text-xl">{activeScreen.title}</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-400 sm:text-sm">{activeScreen.subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] p-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden bg-black sm:aspect-[16/10] lg:aspect-[16/9]">
          <img
            key={activeScreen.image}
            src={activeScreen.image}
            alt={`Interface MekLoc - ${activeScreen.title}`}
            className="h-full w-full object-cover object-top"
            loading="lazy"
            decoding="async"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/65 to-transparent" />
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const demoUrl = useMemo(() => whatsappUrl('Bonjour MekLoc, je souhaite réserver une démo.'), []);
  const [activeInterfaceTab, setActiveInterfaceTab] = useState(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [contactForm, setContactForm] = useState({
    agency: '',
    phone: '',
    email: '',
    need: '',
  });
  const cadrageMessage = useMemo(() => {
    const lines = [
      'Bonjour MekLoc, je souhaite réserver une session de cadrage.',
      contactForm.agency ? `Agence: ${contactForm.agency}` : '',
      contactForm.phone ? `WhatsApp: ${contactForm.phone}` : '',
      contactForm.email ? `Email: ${contactForm.email}` : '',
      contactForm.need ? `Besoin: ${contactForm.need}` : '',
    ].filter(Boolean);

    return lines.join('\n');
  }, [contactForm.agency, contactForm.email, contactForm.need, contactForm.phone]);
  const cadrageWhatsappUrl = useMemo(() => whatsappUrl(cadrageMessage), [cadrageMessage]);
  const cadrageEmailUrl = useMemo(() => {
    const subject = encodeURIComponent('Demande de session de cadrage MekLoc');
    const body = encodeURIComponent(cadrageMessage);
    return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  }, [cadrageMessage]);
  const contactInputClass = 'h-14 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-[#E3B117]/45 focus:bg-white/[0.075] focus:ring-4 focus:ring-[#E3B117]/10';
  const contactIconInputClass = `${contactInputClass} pl-12`;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.landing-reveal'));

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050606] text-white">
      <LandingMotionStyles />
      <SEO
        title={DEFAULT_TITLE}
        description={DEFAULT_DESCRIPTION}
        canonical="/"
        keywords={DEFAULT_KEYWORDS}
        jsonLd={[...baseStructuredData(), faqStructuredData(faqs)]}
      />
      <LandingHeader />

      <main className="landing-gradient-motion bg-[radial-gradient(circle_at_18%_6%,rgba(245,197,66,.16),transparent_30%),radial-gradient(circle_at_82%_24%,rgba(227,177,23,.12),transparent_32%),linear-gradient(rgba(255,255,255,.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:auto,auto,72px_72px,72px_72px]">
        <section className="landing-ambient relative overflow-hidden border-b border-white/10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#E3B117]/10 to-transparent" />
          <div className="pointer-events-none absolute -left-28 top-40 h-80 w-80 rounded-full bg-[#E3B117]/10 blur-3xl" />
          <div className="mx-auto grid w-full max-w-[1440px] items-center gap-9 px-4 py-9 sm:px-6 sm:py-14 lg:min-h-[calc(100vh-80px)] lg:grid-cols-[0.88fr_1.12fr] lg:px-8 lg:py-16 xl:gap-16 xl:px-10">
            <div className="landing-reveal max-w-[680px]">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#E3B117]/30 bg-[#E3B117]/10 px-3.5 py-2 text-xs font-bold leading-5 text-[#F5C542] sm:px-4 sm:text-sm">
                <Zap className="h-4 w-4" />
                <span className="lg:hidden">SaaS de gestion pour agences au Maroc</span>
                <span className="hidden lg:inline">SaaS de gestion pour agences de location au Maroc</span>
              </div>
              <h1 className="mt-6 text-[42px] font-black leading-[1.02] tracking-[-0.035em] text-white sm:text-6xl lg:text-[4.15rem] lg:leading-[1.02] xl:text-[4.55rem]">
                Logiciel de gestion pour agences de location de voitures <span className="text-[#E3B117]">au Maroc</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8 lg:hidden">
                Réservations, véhicules, contrats PDF, paiements et alertes dans une seule plateforme.
              </p>
              <p className="mt-5 hidden max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8 lg:block">
                MekLoc centralise la location de voitures au Maroc : réservations, véhicules, clients, contrats PDF, paiements, cautions, entretien et alertes dans une seule plateforme.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href={cadrageWhatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="landing-cta-shine inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#F5C542]/45 bg-[#E3B117] px-7 text-sm font-black text-[#070807] shadow-[0_18px_52px_rgba(227,177,23,.25),inset_0_1px_0_rgba(255,255,255,.30)] transition hover:-translate-y-0.5 hover:bg-[#F5C542] active:translate-y-0 sm:w-auto"
                >
                  <CalendarDays className="h-4 w-4" />
                  Réserver une session de cadrage
                </a>
                <a
                  href={demoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-7 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition hover:-translate-y-0.5 hover:border-[#E3B117]/40 hover:bg-white/[0.10] active:translate-y-0 sm:w-auto"
                >
                  <MessageCircle className="h-4 w-4" />
                  Voir la démo
                </a>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2.5 sm:max-w-xl sm:gap-3">
                {[
                  ['10 min', 'prise en main'],
                  ['MAD', 'prêt Maroc'],
                  ['PDF', 'contrats propres'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur">
                    <p className="text-lg font-black leading-none text-white sm:text-xl">{value}</p>
                    <p className="mt-1 text-[11px] font-semibold leading-4 text-zinc-400 sm:text-xs">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-7 hidden grid-cols-2 gap-3 text-sm text-white/75 sm:flex sm:flex-wrap sm:gap-5 sm:text-white/68 lg:flex">
                {[
                  [FileText, 'Contrats PDF'],
                  [BellRing, 'Alertes & rappels'],
                  [CircleDollarSign, 'Paiements suivis'],
                  [Cloud, '100% Cloud'],
                ].map(([Icon, label]) => (
                  <span key={label as string} className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0">
                    <Icon className="h-4 w-4 text-[#F5C542]" />
                    {label as string}
                  </span>
                ))}
              </div>
              <MobileCommandHero />
            </div>
            <div className="landing-reveal hidden lg:block">
              <DashboardVisual />
            </div>
          </div>
        </section>

        <section id="fonctionnalites" className="landing-reveal border-b border-white/10 py-12 sm:py-20">
          <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 xl:px-10">
            <SectionTitle eyebrow="Pourquoi les agences choisissent MekLoc ?" title="Pourquoi choisir MekLoc ?" />
            <div className="landing-stagger mt-8 grid gap-4 sm:gap-6 md:grid-cols-3">
              {choiceCards.map(([title, text, Icon]) => (
                <Card key={title as string} className="landing-reveal group p-6 active:border-[#E3B117]/35 hover:border-[#E3B117]/35 sm:p-8">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#E3B117]/25 bg-[#E3B117]/10 text-[#F5C542] shadow-[0_0_30px_rgba(227,177,23,.08)] transition group-hover:border-[#E3B117]/55 group-hover:bg-[#E3B117]/15 sm:h-16 sm:w-16"><Icon className="h-7 w-7 sm:h-8 sm:w-8" /></span>
                  <h3 className="mt-5 text-xl font-black sm:mt-7 sm:text-2xl">{title as string}</h3>
                  <p className="mt-3 text-base leading-7 text-zinc-400">{text as string}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-reveal border-b border-white/10 py-12 sm:py-20">
          <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 xl:px-10">
            <SectionTitle eyebrow="Comparaison" title="Centralisez clients, paiements et cautions" />
            <Card className="mt-8 p-4 hover:border-[#E3B117]/25 sm:p-8 lg:p-10">
              <div className="grid gap-4 sm:gap-7 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-5 sm:p-6">
                  <h3 className="text-sm font-black uppercase tracking-[0.14em] text-rose-300 sm:text-base">Avant MekLoc</h3>
                  <div className="mt-5 space-y-3.5 sm:mt-6 sm:space-y-4">
                    {beforeItems.map((item) => <p key={item} className="flex gap-3 text-sm leading-6 text-white/75 sm:text-base"><XCircle className="h-5 w-5 shrink-0 text-rose-400" />{item}</p>)}
                  </div>
                </div>
                <div className="hidden h-20 w-20 self-center place-items-center rounded-full border border-[#E3B117]/50 bg-[#E3B117]/10 text-[#F5C542] shadow-[0_0_45px_rgba(227,177,23,.16)] lg:grid"><ArrowRight className="h-10 w-10" /></div>
                <div className="grid h-12 w-12 place-items-center justify-self-center rounded-full border border-[#E3B117]/40 bg-[#E3B117]/10 text-[#F5C542] lg:hidden"><ArrowRight className="h-6 w-6 rotate-90" /></div>
                <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.035] p-5 sm:p-6">
                  <h3 className="text-sm font-black uppercase tracking-[0.14em] text-emerald-300 sm:text-base">Avec MekLoc</h3>
                  <div className="mt-5 space-y-3.5 sm:mt-6 sm:space-y-4">
                    {afterItems.map((item) => <p key={item} className="flex gap-3 text-sm leading-6 text-white/75 sm:text-base"><Check className="h-5 w-5 shrink-0 text-emerald-400" />{item}</p>)}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section className="landing-reveal border-b border-white/10 py-12 sm:py-20">
          <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 xl:px-10">
            <SectionTitle eyebrow="Comment ça marche ?" title="Gérez vos réservations en temps réel" />
            <h2 className="sr-only">Générez des contrats PDF professionnels</h2>
            <div className="landing-stagger relative mt-8 grid gap-4 pl-5 sm:gap-6 sm:pl-0 md:grid-cols-2 xl:grid-cols-4">
              <div className="pointer-events-none absolute bottom-4 left-6 top-4 w-px bg-gradient-to-b from-transparent via-[#E3B117]/35 to-transparent sm:hidden" />
              <div className="pointer-events-none absolute left-10 right-10 top-16 hidden h-px bg-gradient-to-r from-transparent via-[#E3B117]/35 to-transparent xl:block" />
              {steps.map(([title, text, Icon], index) => (
                <Card key={title as string} className={`landing-reveal relative min-h-[210px] p-6 hover:border-[#E3B117]/35 sm:min-h-[245px] sm:p-7 ${index === 3 ? 'border-[#E3B117]/45 shadow-[0_0_45px_rgba(227,177,23,.09)]' : ''}`}>
                  <span className="absolute -left-[30px] top-7 grid h-9 w-9 place-items-center rounded-full border border-[#E3B117]/35 bg-[#0b0b08] text-xs font-black text-[#F5C542] shadow-[0_0_22px_rgba(227,177,23,.14)] sm:left-auto sm:right-6 sm:top-6 sm:block sm:h-auto sm:w-auto sm:rounded-full sm:bg-[#E3B117]/10 sm:px-3 sm:py-1">{String(index + 1).padStart(2, '0')}</span>
                  <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-black/35 text-[#F5C542]"><Icon className="h-7 w-7" /></span>
                  <h3 className="mt-6 text-xl font-black sm:mt-8">{title as string}</h3>
                  <p className="mt-3 text-base leading-7 text-zinc-400">{text as string}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-reveal relative overflow-hidden border-b border-white/10 py-14 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_45%_50%,rgba(227,177,23,.12),transparent_42%),linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:auto,64px_64px,64px_64px]" />
          <div className="relative mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 xl:px-10">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.26em] text-[#F5C542] sm:text-sm">INTERFACE</p>
              <h2 className="mt-3 text-[28px] font-black leading-tight text-white sm:text-4xl lg:text-5xl">
                Suivez votre flotte et <span className="text-[#E3B117]">vos véhicules</span>
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-400">
                Réservations, véhicules, clients, contrats PDF, paiements et alertes réunis dans un seul espace.
              </p>
            </div>

            <div className="mx-auto mt-6 flex max-w-full gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-black/35 p-1.5 sm:w-max sm:overflow-visible">
              {previewCards.map(([label, , Icon], index) => (
                <button
                  key={label as string}
                  type="button"
                  onClick={() => setActiveInterfaceTab(index)}
                  className={`flex min-w-max items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition ${
                    activeInterfaceTab === index
                      ? 'bg-[#E3B117] text-[#070807]'
                      : 'text-white/60 hover:bg-white/[0.045] hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label as string}
                </button>
              ))}
            </div>

            <div className="landing-reveal relative mx-auto mt-8 max-w-[1180px]">
              <div className="pointer-events-none absolute -inset-8 rounded-full bg-[#E3B117]/12 blur-3xl" />
              <div className="pointer-events-none absolute -left-4 top-10 hidden rounded-full border border-[#E3B117]/25 bg-black/70 px-4 py-2 text-sm font-bold text-[#F5C542] backdrop-blur md:block">Contrats prêts</div>
              <div className="pointer-events-none absolute -right-2 top-24 hidden rounded-full border border-[#E3B117]/25 bg-black/70 px-4 py-2 text-sm font-bold text-[#F5C542] backdrop-blur md:block">Flotte disponible</div>
              <div className="pointer-events-none absolute bottom-14 left-8 hidden rounded-full border border-white/10 bg-black/70 px-4 py-2 text-sm font-bold text-white/80 backdrop-blur lg:block">Paiements suivis</div>
              <div className="pointer-events-none absolute bottom-8 right-10 hidden rounded-full border border-white/10 bg-black/70 px-4 py-2 text-sm font-bold text-white/80 backdrop-blur lg:block">Alertes entretien</div>
              <div className="landing-mockup-float relative">
                <InterfaceDashboardMockup activeTab={activeInterfaceTab} />
              </div>
            </div>

            <div className="landing-stagger mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {interfaceBenefits.map(([Icon, title, text]) => (
                <Card key={title as string} className="landing-reveal group p-4 hover:border-[#E3B117]/25 sm:p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl border border-[#E3B117]/20 bg-[#E3B117]/10 text-[#F5C542]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-sm font-black text-white sm:text-base">{title as string}</h3>
                  <p className="mt-2 text-xs leading-5 text-zinc-400 sm:text-sm sm:leading-6">{text as string}</p>
                </Card>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 md:hidden">
              {['Contrats prêts', 'Alertes entretien', 'Paiements suivis', 'Flotte disponible'].map((badge) => (
                <span key={badge} className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-center text-xs font-bold text-white/70">
                  {badge}
                </span>
              ))}
              </div>
          </div>
        </section>

        <section id="tarifs" className="landing-reveal border-b border-white/10 py-12 sm:py-20">
          <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8 xl:px-10">
            <SectionTitle eyebrow="Tarifs simples et transparents" title="Tarifs MekLoc" />
            <p className="mt-4 text-center text-sm font-semibold text-white/55">Sans engagement • Support inclus</p>
            <div className="mx-auto mt-6 flex w-max rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm font-bold">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-full px-6 py-2.5 transition ${
                  billingCycle === 'monthly' ? 'bg-[#E3B117] text-[#070807]' : 'text-white/48 hover:text-white'
                }`}
              >
                Mensuel
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`rounded-full px-6 py-2.5 transition ${
                  billingCycle === 'annual' ? 'bg-[#E3B117] text-[#070807]' : 'text-white/48 hover:text-white'
                }`}
              >
                Annuel (-20%)
              </button>
            </div>
            <div className="landing-stagger mt-8 grid gap-5 md:grid-cols-3 md:gap-5 xl:gap-7">
              {plans.map((plan) => {
                const isLifetime = 'lifetime' in plan && plan.lifetime;
                const displayPrice = isLifetime ? plan.annualPrice : billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
                const cadence = isLifetime ? 'à vie' : billingCycle === 'annual' ? '/an' : '/mois';
                const planUrl = `/demande-acces?plan=${plan.id}&billing=${isLifetime ? 'lifetime' : billingCycle}`;

                return (
                  <Card key={plan.id} className={`landing-reveal relative flex min-h-full flex-col p-6 hover:border-[#E3B117]/30 sm:p-7 ${plan.recommended ? 'border-[#E3B117]/65 bg-gradient-to-br from-[#E3B117]/12 via-zinc-950/90 to-black shadow-[0_0_70px_rgba(227,177,23,.16)]' : ''} ${isLifetime ? 'border-[#F5C542]/70 bg-gradient-to-br from-[#E3B117]/18 via-zinc-950/92 to-black shadow-[0_0_90px_rgba(227,177,23,.22)]' : ''}`}>
                    {plan.recommended ? <span className="absolute right-5 top-5 rounded-full bg-[#E3B117] px-3 py-1 text-xs font-black text-[#070807] sm:right-6 sm:top-6">Recommandé</span> : null}
                    {isLifetime ? <span className="absolute right-5 top-5 rounded-full bg-white px-3 py-1 text-xs font-black text-[#070807] sm:right-6 sm:top-6">Meilleure valeur</span> : null}
                    <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#E3B117]/25 bg-[#E3B117]/10 text-[#F5C542]"><Sparkles className="h-6 w-6" /></span>
                    <h3 className="mt-5 text-2xl font-black">{plan.name}</h3>
                    <p className="mt-1 text-sm text-white/50">{plan.note}</p>
                    <p className="mt-6 text-4xl font-black sm:mt-7 sm:text-5xl">
                      {displayPrice.toLocaleString('fr-FR')}
                      <span className="ml-2 text-lg">MAD</span>
                      <span className="text-base font-medium text-white/55"> {cadence}</span>
                    </p>
                    {isLifetime ? (
                      <p className="mt-2 text-sm font-semibold text-[#F5C542]">Paiement unique, accès durable</p>
                    ) : billingCycle === 'annual' ? (
                      <p className="mt-2 text-sm font-semibold text-[#F5C542]">{plan.annualBillingLabel}</p>
                    ) : (
                      <p className="mt-2 text-sm font-semibold text-white/38">Facturation mensuelle</p>
                    )}
                    <div className="mt-7 grow space-y-3 sm:mt-8 sm:space-y-3.5">
                      {plan.features.map((feature) => <p key={feature} className="flex gap-3 text-base text-white/75"><Check className="h-5 w-5 shrink-0 text-[#F5C542]" />{feature}</p>)}
                    </div>
                    <Link
                      to={planUrl}
                      className={`mt-7 flex h-14 w-full items-center justify-center rounded-2xl border text-sm font-black transition duration-300 hover:-translate-y-0.5 active:translate-y-0 ${
                        plan.recommended || isLifetime
                          ? 'landing-cta-shine border-[#F5C542]/50 bg-[#E3B117] text-[#070807] shadow-[0_16px_45px_rgba(227,177,23,.18)] hover:bg-[#F5C542]'
                          : 'border-white/15 bg-white/[0.06] text-white hover:border-[#E3B117]/35 hover:bg-[#E3B117]/10 hover:text-[#F5C542]'
                      }`}
                    >
                      Choisir {plan.name}
                    </Link>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section id="faq" className="landing-reveal border-b border-white/10 py-12 sm:py-20">
          <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6 lg:px-8 xl:px-10">
            <SectionTitle eyebrow="Questions fréquentes" title="Questions fréquentes" />
            <div className="mt-8 grid gap-3 sm:gap-4 lg:grid-cols-2">
              {faqs.map(([question, answer]) => (
                <details key={question} className="group rounded-2xl border border-white/10 bg-zinc-950/75 transition hover:border-[#E3B117]/28 hover:bg-zinc-900/70">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-bold sm:px-6 sm:py-5">
                    {question}
                    <ChevronDown className="h-4 w-4 shrink-0 text-white/60 transition group-open:rotate-180" />
                  </summary>
                  <p className="px-6 pb-6 text-sm leading-7 text-zinc-400">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="landing-reveal scroll-mt-24 border-b border-white/10 py-12 sm:py-16">
          <div className="mx-auto w-full max-w-[1320px] px-4 sm:px-6 lg:px-8 xl:px-10">
            <div className="grid gap-7 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-stretch">
              <div className="rounded-[30px] border border-white/10 bg-gradient-to-br from-zinc-950/90 via-black to-zinc-950/85 p-7 shadow-[0_24px_80px_rgba(0,0,0,.34)] sm:p-8">
                <Logo />
                <h2 className="mt-8 text-[30px] font-black leading-[1.08] text-white sm:text-[42px] lg:text-[2.7rem]">
                  La plateforme tout-en-un pour les agences de location automobile au Maroc.
                </h2>
                <p className="mt-6 text-base leading-8 text-zinc-300">
                  MekLoc centralise vos réservations, véhicules, contrats, paiements et alertes dans un seul outil pensé pour simplifier votre quotidien et accélérer votre croissance.
                </p>
                <div className="mt-10">
                  <p className="text-sm font-black text-[#F5C542]">Suivez MekLoc</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {socialLinks.map(([label, Icon, href]) => (
                      <a
                        key={label as string}
                        href={href as string}
                        target={(href as string).startsWith('http') ? '_blank' : undefined}
                        rel="noreferrer"
                        className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/[0.04] text-[#F5C542] transition hover:border-[#E3B117]/45 hover:bg-[#E3B117]/10"
                        aria-label={label as string}
                      >
                        <Icon className="h-5 w-5" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[30px] border border-[#E3B117]/20 bg-gradient-to-br from-zinc-950/90 via-black to-zinc-950/85 p-6 shadow-[0_24px_90px_rgba(0,0,0,.38)] sm:p-8">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_0%,rgba(227,177,23,.14),transparent_36%)]" />
                <div className="relative grid gap-8 lg:grid-cols-[0.8fr_1.05fr] lg:items-center">
                  <div className="lg:border-r lg:border-white/10 lg:pr-8">
                    <span className="grid h-16 w-16 place-items-center rounded-2xl border border-[#E3B117]/25 bg-[#E3B117]/10 text-[#F5C542] shadow-[0_0_35px_rgba(227,177,23,.12)]">
                      <CalendarDays className="h-7 w-7" />
                    </span>
                    <h2 className="mt-6 text-[32px] font-black leading-[1.08] text-white sm:text-5xl">Réservez une session de cadrage</h2>
                    <p className="mt-5 text-base leading-8 text-zinc-300">
                      Partagez votre besoin (taille flotte, ville, opérations). Nous vous aidons à lancer MekLoc rapidement.
                    </p>
                    <div className="mt-16 inline-flex items-center gap-3 text-sm font-black text-[#F5C542] lg:mt-20">
                      <Zap className="h-5 w-5" />
                      Réponse rapide sous 24h
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <label className="relative block">
                      <Building2 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                      <input
                        value={contactForm.agency}
                        onChange={(event) => setContactForm((current) => ({ ...current, agency: event.target.value }))}
                        className={contactIconInputClass}
                        placeholder="Nom de l’agence"
                      />
                    </label>
                    <label className="relative block">
                      <MessageCircle className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                      <input
                        value={contactForm.phone}
                        onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))}
                        className={contactIconInputClass}
                        placeholder="Numéro WhatsApp"
                      />
                    </label>
                    <label className="relative block">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="email"
                        value={contactForm.email}
                        onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))}
                        className={contactIconInputClass}
                        placeholder="Votre email"
                      />
                    </label>
                    <label className="relative block">
                      <FileText className="pointer-events-none absolute left-4 top-5 h-5 w-5 text-zinc-400" />
                      <textarea
                        value={contactForm.need}
                        onChange={(event) => setContactForm((current) => ({ ...current, need: event.target.value }))}
                        className={`${contactInputClass} min-h-[128px] resize-none py-4 pl-12`}
                        placeholder="Décrivez votre besoin"
                      />
                    </label>
                    <div className="mt-2 grid gap-3 sm:grid-cols-[1.05fr_0.95fr]">
                      <a href={cadrageWhatsappUrl} target="_blank" rel="noreferrer" className="block">
                        <Button className="landing-cta-shine h-14 w-full rounded-2xl bg-[#E3B117] font-black text-[#070807] shadow-[0_16px_45px_rgba(227,177,23,.16)] transition hover:-translate-y-0.5 hover:bg-[#F5C542] active:translate-y-0" icon={<CalendarDays className="h-4 w-4" />}>
                          Réserver la session
                        </Button>
                      </a>
                      <a href={cadrageEmailUrl} className="block">
                        <Button variant="secondary" className="h-14 w-full rounded-2xl border-white/15 bg-white/[0.045] font-black transition hover:-translate-y-0.5 hover:border-[#E3B117]/30 active:translate-y-0" icon={<Mail className="h-4 w-4" />}>
                          Envoyer un email
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {[
                [MessageCircle, 'WhatsApp direct', 'Réponse rapide', SUPPORT_PHONE_DISPLAY],
                [Mail, 'Par email', 'Écrivez-nous', contactEmail],
                [CalendarDays, 'Appel de cadrage', '30 minutes', 'Échange personnalisé'],
              ].map(([Icon, title, text, value]) => (
                <Card key={title as string} className="flex items-center gap-5 p-5 hover:border-[#E3B117]/25 sm:p-6">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#E3B117]/20 bg-[#E3B117]/10 text-[#F5C542]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-lg font-black text-white">{title as string}</span>
                    <span className="mt-1 block text-sm text-zinc-400">{text as string}</span>
                    <span className="mt-1 block font-black text-[#F5C542]">{value as string}</span>
                  </span>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden border-t border-[#E3B117]/10 bg-gradient-to-b from-[#050606] to-[#0b0b08] py-12 pb-24 sm:py-14 sm:pb-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(227,177,23,0.12),transparent_46%)]" />
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 xl:px-10">
          <Card className="relative p-6 hover:border-[#E3B117]/20 sm:p-9">
            <div className="grid gap-7 sm:gap-8 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
              <div>
                <Logo compact />
                <p className="mt-4 max-w-sm text-base leading-7 text-zinc-400 sm:mt-5">
                  La solution SaaS complète pour gérer réservations, véhicules, contrats PDF, paiements et alertes.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {socialLinks.map(([label, Icon, href]) => (
                    <a key={label as string} href={href as string} target={(href as string).startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-[#E3B117]/35 hover:bg-[#E3B117]/10 hover:text-[#F5C542]">
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[#F5C542]">Contact</h3>
                <div className="mt-5 space-y-3 text-sm text-zinc-400">
                  <p>+212 762-971653</p>
                  <p>{contactEmail}</p>
                  <p>Maroc</p>
                  <p>Disponible 7j/7</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[#F5C542]">Produit</h3>
                <div className="mt-5 space-y-3 text-sm text-zinc-400">
                  <a href="#fonctionnalites" className="block hover:text-[#F5C542]">Fonctionnalités</a>
                  <a href="#tarifs" className="block hover:text-[#F5C542]">Tarifs</a>
                  <a href="#contact" className="block hover:text-[#F5C542]">Session de cadrage</a>
                  <a href="#faq" className="block hover:text-[#F5C542]">Foire aux questions</a>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-[#F5C542]">Entreprise</h3>
                <div className="mt-5 space-y-3 text-sm text-zinc-400">
                  <a href="#fonctionnalites" className="block hover:text-[#F5C542]">À propos</a>
                  <a href="#contact" className="block hover:text-[#F5C542]">Contact</a>
                  <Link to="/conditions-utilisation" className="block hover:text-[#F5C542]">Mentions légales</Link>
                  <Link to="/politique-confidentialite" className="block hover:text-[#F5C542]">Confidentialité</Link>
                </div>
              </div>
            </div>
          </Card>
          <div className="relative mt-6 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 MekLoc. Tous droits réservés.</p>
            <p>Made with mekwebagency</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
