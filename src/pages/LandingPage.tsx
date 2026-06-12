import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BellRing,
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
  Menu,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import SEO, { baseStructuredData, faqStructuredData } from '../components/system/SEO';
import { SUPPORT_EMAIL, SUPPORT_PHONE, WHATSAPP_URL } from '../config/app';
import { MEKLOC_PLAN_LIST } from '../config/pricing';
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
  ['Réservations & calendrier', 'Planning clair, disponibilités en temps réel et contrôle des chevauchements.', CalendarDays],
  ['Clients & documents', 'Fiches clients, CIN, permis et historique regroupés au même endroit.', Users],
  ['Gestion de flotte', 'Véhicules, photos, kilométrage, tarifs, statuts et villes de location.', Car],
  ['Contrats PDF professionnels', 'Contrats avec logo, cachet, données agence et deuxième conducteur.', FileText],
  ['Paiements & cautions', 'Suivi du total, payé, reste, caution et historique de chaque réservation.', CircleDollarSign],
  ['Entretien & échéances', 'Vidanges, assurances, visites techniques et maintenance sous contrôle.', Wrench],
  ['Rapports & statistiques', 'Revenus, activité et indicateurs utiles pour piloter votre agence.', Gauge],
  ['Alertes & rappels', 'Retards, retours, documents expirés et actions importantes.', BellRing],
];

const beforeItems = [
  'Réservations suivies sur WhatsApp',
  'Contrats Word / PDF dispersés',
  'Paiements difficiles à vérifier',
  'Cautions oubliées',
  'Visites techniques non suivies',
];

const afterItems = [
  'Réservations centralisées',
  'Contrats PDF professionnels',
  'Paiements et cautions suivis',
  'Alertes automatiques',
  'Historique clair et accessible partout',
];

const steps = [
  ['Ajoutez vos véhicules', 'Centralisez les informations, documents et disponibilités de votre flotte.', Car],
  ['Créez vos réservations', 'Sélectionnez le client, le véhicule, les dates et le tarif.', CalendarDays],
  ['Générez vos contrats PDF', 'Préparez un contrat professionnel prêt à télécharger ou envoyer.', FileCheck2],
  ['Suivez toute l’activité', 'Gardez paiements, cautions, échéances et alertes sous contrôle.', BellRing],
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

const plans = MEKLOC_PLAN_LIST.map((plan) => ({
  ...plan,
  recommended: plan.id === 'business',
  lifetime: plan.id === 'lifetime',
}));

const faqs: Array<[string, string]> = [
  ['Est-ce que MekLoc fonctionne sur téléphone ?', 'Oui. MekLoc fonctionne sur téléphone, tablette et ordinateur depuis un navigateur récent.'],
  ['Est-ce que je peux générer des contrats PDF ?', 'Oui. Les contrats reprennent les données de la réservation, du client, du véhicule et de votre agence.'],
  ['Est-ce adapté aux agences marocaines ?', 'Oui. MekLoc est pensé pour les agences de location au Maroc avec MAD, cautions, contrats PDF et alertes véhicules.'],
  ['Comment tester la démo ?', 'Réservez une session gratuite de cadrage. Notre équipe vous présente MekLoc selon les besoins de votre agence.'],
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

const accessRequestUrl = 'https://mekloc.com/demande-acces';

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

      @keyframes mekloc-desktop-hero-float {
        0%, 100% { transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg); }
        50% { transform: translate3d(0, -18px, 0) rotateX(1.2deg) rotateY(-1deg); }
      }

      @keyframes mekloc-desktop-glow-pulse {
        0%, 100% { opacity: .42; transform: scale(.96); }
        50% { opacity: .82; transform: scale(1.04); }
      }

      @keyframes mekloc-desktop-badge-drift {
        0%, 100% { transform: translate3d(0, 0, 0); }
        50% { transform: translate3d(0, -8px, 0); }
      }

      @keyframes mekloc-light-sweep {
        0% { transform: translateX(-70%) rotate(10deg); opacity: 0; }
        22% { opacity: .45; }
        54% { opacity: .18; }
        100% { transform: translateX(95%) rotate(10deg); opacity: 0; }
      }

      @keyframes mekloc-video-ring-pulse {
        0%, 100% { opacity: .56; transform: translateX(-50%) scale(.98); }
        50% { opacity: .92; transform: translateX(-50%) scale(1.025); }
      }

      @keyframes mekloc-pedestal-glow {
        0%, 100% { opacity: .58; transform: translateX(-50%) scaleX(.96); }
        50% { opacity: 1; transform: translateX(-50%) scaleX(1.03); }
      }

      @keyframes mekloc-play-pulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(227, 177, 23, .28), 0 18px 48px rgba(227, 177, 23, .20); }
        50% { transform: scale(1.045); box-shadow: 0 0 0 16px rgba(227, 177, 23, 0), 0 22px 62px rgba(227, 177, 23, .28); }
      }

      @keyframes mekloc-hero-rise {
        0% { opacity: 0; transform: translate3d(0, 28px, 0); filter: blur(10px); }
        100% { opacity: 1; transform: translate3d(0, 0, 0); filter: blur(0); }
      }

      @keyframes mekloc-hero-reveal-safe {
        0% { transform: translate3d(0, 22px, 0); filter: blur(8px); }
        100% { transform: translate3d(0, 0, 0); filter: blur(0); }
      }

      @keyframes mekloc-gold-word {
        0%, 100% { text-shadow: 0 0 0 rgba(227, 177, 23, 0); }
        50% { text-shadow: 0 0 34px rgba(227, 177, 23, .48); }
      }

      @keyframes mekloc-orbit-line {
        0% { transform: translateX(-18%) scaleX(.72); opacity: .18; }
        50% { transform: translateX(18%) scaleX(1); opacity: .72; }
        100% { transform: translateX(-18%) scaleX(.72); opacity: .18; }
      }

      @keyframes mekloc-shine {
        0% { transform: translateX(-140%) skewX(-18deg); opacity: 0; }
        30% { opacity: .5; }
        100% { transform: translateX(150%) skewX(-18deg); opacity: 0; }
      }

      @keyframes mekloc-trial-glow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(245,197,66,.10), 0 12px 34px rgba(227,177,23,.18); }
        50% { box-shadow: 0 0 0 8px rgba(245,197,66,0), 0 18px 52px rgba(227,177,23,.34); }
      }

      .landing-trial-pulse { animation: mekloc-trial-glow 2.6s ease-in-out infinite; }

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

      .landing-desktop-mockup::before {
        content: '';
        position: absolute;
        inset: 9%;
        z-index: -1;
        border-radius: 9999px;
        background: radial-gradient(circle, rgba(245, 197, 66, .28), rgba(227, 177, 23, .08) 42%, transparent 70%);
        filter: blur(48px);
        animation: mekloc-desktop-glow-pulse 5.8s ease-in-out infinite;
      }

      .landing-desktop-mockup::after {
        content: '';
        position: absolute;
        inset: 2.5rem 3rem;
        z-index: 5;
        pointer-events: none;
        border-radius: 1.75rem;
        background: linear-gradient(105deg, transparent 8%, rgba(245, 197, 66, .15) 38%, rgba(255, 255, 255, .16) 48%, transparent 64%);
        mix-blend-mode: screen;
        animation: mekloc-light-sweep 6.5s ease-in-out infinite;
      }

      .landing-video-halo {
        animation: mekloc-video-ring-pulse 6.8s ease-in-out infinite;
      }

      .landing-video-pedestal::before {
        content: '';
        position: absolute;
        left: 50%;
        top: 8px;
        width: 86%;
        height: 22px;
        border-radius: 9999px;
        background: linear-gradient(90deg, transparent, rgba(245, 197, 66, .88), transparent);
        filter: blur(7px);
        animation: mekloc-pedestal-glow 4.8s ease-in-out infinite;
      }

      .landing-play-pulse {
        animation: mekloc-play-pulse 2.6s ease-in-out infinite;
      }

      .landing-floating-badge {
        animation: mekloc-desktop-badge-drift 5.6s ease-in-out infinite;
      }

      .landing-floating-badge:nth-child(2) {
        animation-delay: -2.2s;
      }

      .landing-gold-word {
        animation: mekloc-gold-word 3.8s ease-in-out infinite;
      }

      .landing-hero-kicker,
      .landing-hero-line,
      .landing-hero-copy,
      .landing-hero-actions,
      .landing-hero-proof,
      .landing-hero-visual {
        opacity: 1;
        animation: mekloc-hero-reveal-safe .82s cubic-bezier(.2, .72, .18, 1) both;
      }

      .landing-hero-kicker { animation-delay: .08s; }
      .landing-hero-line:nth-child(1) { animation-delay: .18s; }
      .landing-hero-line:nth-child(2) { animation-delay: .28s; }
      .landing-hero-line:nth-child(3) { animation-delay: .38s; }
      .landing-hero-copy { animation-delay: .52s; }
      .landing-hero-actions { animation-delay: .64s; }
      .landing-hero-proof { animation-delay: .74s; }
      .landing-hero-visual { animation-delay: .44s; }

      .landing-hero-ray {
        position: absolute;
        inset: auto 8% 10% 8%;
        height: 1px;
        pointer-events: none;
        background: linear-gradient(90deg, transparent, rgba(245, 197, 66, .58), transparent);
        filter: blur(.2px);
        animation: mekloc-orbit-line 5.8s ease-in-out infinite;
      }

      .landing-nav-link {
        position: relative;
      }

      .landing-nav-link::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: -8px;
        height: 2px;
        border-radius: 9999px;
        background: linear-gradient(90deg, transparent, #E3B117, transparent);
        transform: scaleX(0);
        transform-origin: center;
        opacity: 0;
        transition: transform .24s ease, opacity .24s ease;
      }

      .landing-nav-link:hover::after {
        transform: scaleX(1);
        opacity: 1;
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

      .landing-card:hover svg {
        filter: drop-shadow(0 0 14px rgba(245, 197, 66, .28));
      }

      .landing-faq {
        overflow: hidden;
      }

      .landing-faq[open] {
        border-color: rgba(227, 177, 23, .32);
        background: rgba(24, 24, 22, .86);
        box-shadow: 0 18px 60px rgba(0, 0, 0, .24), 0 0 32px rgba(227, 177, 23, .06);
      }

      .landing-faq-answer {
        animation: mekloc-hero-rise .32s ease both;
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
          animation: none;
        }

        .landing-gradient-motion,
        .landing-mockup-float,
        .landing-floating-badge,
        .landing-video-halo,
        .landing-video-pedestal::before,
        .landing-play-pulse,
        .landing-hero-kicker,
        .landing-hero-line,
        .landing-hero-copy,
        .landing-hero-actions,
        .landing-hero-proof,
        .landing-hero-visual,
        .landing-gold-word,
        .landing-hero-ray,
        .landing-desktop-mockup::before,
        .landing-desktop-mockup::after {
          animation: none !important;
        }

        .landing-hero-kicker,
        .landing-hero-line,
        .landing-hero-copy,
        .landing-hero-actions,
        .landing-hero-proof,
        .landing-hero-visual {
          opacity: 1;
          filter: none;
        }

        .landing-reveal,
        .landing-reveal.is-visible {
          opacity: 1;
          transform: none;
          transition: none;
        }

        .landing-card:hover {
          transform: none;
        }
      }

      @media (min-width: 1024px) {
        .landing-mockup-float {
          animation: mekloc-desktop-hero-float 7.5s ease-in-out infinite;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .landing-ambient::before,
        .landing-ambient::after,
        .landing-gradient-motion,
        .landing-mockup-float,
        .landing-floating-badge,
        .landing-video-halo,
        .landing-video-pedestal::before,
        .landing-play-pulse,
        .landing-hero-kicker,
        .landing-hero-line,
        .landing-hero-copy,
        .landing-hero-actions,
        .landing-hero-proof,
        .landing-hero-visual,
        .landing-gold-word,
        .landing-hero-ray,
        .landing-desktop-mockup::before,
        .landing-desktop-mockup::after,
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

        .landing-trial-pulse {
          animation: none !important;
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
      <div className="mx-auto grid h-[68px] w-full max-w-[1440px] grid-cols-[1fr_auto] items-center gap-2 px-4 sm:h-20 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:px-8 xl:px-10">
        <Link to="/" onClick={() => setOpen(false)}><Logo compact /></Link>
        <nav className="hidden items-center gap-10 text-sm font-semibold text-white/80 lg:flex">
          {navItems.map(([label, href]) => (
            <a key={href} href={href} className="landing-nav-link transition hover:text-[#F5C542]">{label}</a>
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
            href={accessRequestUrl}
            className="landing-cta-shine inline-flex h-11 items-center justify-center rounded-xl border border-[#F5C542]/40 bg-[#E3B117] px-6 text-sm font-black text-[#070807] shadow-[0_12px_30px_rgba(227,177,23,.22),inset_0_1px_0_rgba(255,255,255,.28)] transition hover:-translate-y-0.5 hover:bg-[#F5C542] active:translate-y-0"
          >
            Demandez votre accès
          </a>
        </div>
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

      <div className={`fixed inset-x-0 bottom-0 top-[68px] z-40 transition duration-[250ms] sm:top-20 lg:hidden ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
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
              <Link to="/demande-acces?plan=business&billing=monthly&trial=7" onClick={() => setOpen(false)}>
                <Button
                  variant="secondary"
                  className="landing-trial-pulse h-14 w-full rounded-2xl border-[#E3B117]/30 bg-[#E3B117]/10 font-black text-[#F5C542] hover:border-[#E3B117]/50"
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  Essai gratuit 7 jours
                </Button>
              </Link>
              <a href={accessRequestUrl} onClick={() => setOpen(false)}>
                <Button
                  className="landing-cta-shine h-14 w-full rounded-2xl !border-[#F5C542]/50 !bg-[#E3B117] font-black !text-[#070807] shadow-[0_14px_34px_rgba(227,177,23,.28),inset_0_1px_0_rgba(255,255,255,.28)] transition hover:-translate-y-0.5 hover:!bg-[#F5C542] active:translate-y-0"
                  icon={<CalendarDays className="h-4 w-4" />}
                >
                  Demandez votre accès
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function TrialAnnouncement() {
  return (
    <div className="relative z-40 overflow-hidden border-b border-[#F5C542]/25 bg-[linear-gradient(90deg,#6f4d06,#E3B117_48%,#6f4d06)] px-4 py-2.5 text-[#070807]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,.35)_48%,transparent_66%)]" />
      <div className="relative mx-auto flex max-w-[1240px] flex-col items-center justify-center gap-2 text-center sm:flex-row sm:gap-4">
        <span className="inline-flex items-center gap-2 text-sm font-black sm:text-base">
          <Sparkles className="h-4 w-4" />
          Testez toutes les fonctionnalités MekLoc gratuitement pendant 7 jours
        </span>
        <Link
          to="/demande-acces?plan=business&billing=monthly&trial=7"
          className="landing-trial-pulse group inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-full border border-black/25 bg-[#070807] px-5 text-xs font-black uppercase tracking-[0.08em] text-[#F5C542] transition duration-200 hover:scale-[1.04] hover:border-black hover:bg-black hover:text-[#FFD95A]"
        >
          Essai gratuit 7 jours
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
        <span className="text-xs font-bold opacity-75">Sans carte bancaire</span>
      </div>
    </div>
  );
}

function DashboardVisual() {
  const nav = [
    ['Tableau de bord', Gauge],
    ['Réservations', CalendarDays],
    ['Véhicules', Car],
    ['Contrats', FileText],
    ['Paiements', CircleDollarSign],
    ['Alertes', BellRing],
  ];
  const kpis = [
    ['Réservations', '128', '+12% ce mois'],
    ['Véhicules', '23', '+5 ce mois'],
    ['Contrats', '56', '+8% ce mois'],
    ['Paiements', '82,450 MAD', '+15% ce mois'],
  ];
  const reservations = [
    ['Ahmed Bennani', 'Toyota Corolla', '12 juin', '10:00'],
    ['Yassine El Amrani', 'Dacia Duster', '13 juin', '11:30'],
    ['Sofia Alaoui', 'Peugeot 208', '13 juin', '14:00'],
  ];

  return (
    <div className="landing-mockup-float landing-desktop-mockup relative mr-5 w-full max-w-[880px] justify-self-end pb-20 pt-12 xl:mr-8">
      <div className="landing-hero-ray hidden lg:block" />
      <div className="landing-video-halo pointer-events-none absolute left-1/2 top-0 h-[500px] w-[860px] -translate-x-1/2 rounded-[50%] border-2 border-[#F5C542]/70 shadow-[0_0_78px_rgba(227,177,23,.52),inset_0_0_48px_rgba(245,197,66,.22)]" />
      <div className="pointer-events-none absolute left-1/2 top-16 h-[440px] w-[790px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(245,197,66,.32),rgba(227,177,23,.11)_38%,transparent_70%)] blur-3xl" />

      <div className="landing-floating-badge absolute left-3 top-1 z-20 rounded-2xl border border-[#E3B117]/25 bg-black/82 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,.48),0_0_30px_rgba(227,177,23,.10)] backdrop-blur-xl">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#F5C542]">Aujourd’hui</p>
        <p className="mt-1 text-[13px] font-black text-white">128 réservations suivies</p>
      </div>
      <div className="landing-floating-badge absolute -right-4 top-20 z-20 hidden rounded-2xl border border-[#E3B117]/20 bg-black/82 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,.48),0_0_30px_rgba(227,177,23,.08)] backdrop-blur-xl xl:block">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#F5C542]">Flotte</p>
        <p className="mt-1 text-[13px] font-black text-white">23 véhicules disponibles</p>
      </div>

      <div className="relative z-10 rounded-[2.25rem] border border-[#E3B117]/50 bg-[#060706]/95 p-3 shadow-[0_52px_150px_rgba(0,0,0,.76),0_0_110px_rgba(227,177,23,.23)] backdrop-blur-xl">
        <div className="absolute -inset-px -z-10 rounded-[2.15rem] bg-gradient-to-br from-[#F5C542]/55 via-transparent to-[#E3B117]/18 blur-sm" />
        <div className="relative aspect-[16/10] overflow-hidden rounded-[1.72rem] border border-white/12 bg-[radial-gradient(circle_at_72%_10%,rgba(245,197,66,.16),transparent_30%),linear-gradient(135deg,#090b0d,#050606_42%,#0d0a03)]">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.026)_1px,transparent_1px)] bg-[size:42px_42px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,.06),transparent_26%,rgba(0,0,0,.34))]" />

          <div className="relative grid h-full grid-cols-[160px_minmax(0,1fr)] xl:grid-cols-[176px_minmax(0,1fr)]">
            <aside className="border-r border-white/10 bg-black/28 p-4 xl:p-5">
              <Logo compact />
              <div className="mt-6 grid gap-1.5 xl:mt-7">
                {nav.map(([label, Icon], index) => (
                  <div
                    key={label as string}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[11px] font-bold xl:py-2.5 xl:text-[12px] ${
                      index === 0
                        ? 'border border-[#E3B117]/30 bg-[#E3B117]/18 text-[#F5C542]'
                        : 'text-white/58'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label as string}</span>
                  </div>
                ))}
              </div>
            </aside>

            <div className="p-5 xl:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#F5C542]">MekLoc</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Tableau de bord</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-[#F5C542]">
                    <BellRing className="h-4 w-4" />
                  </span>
                  <span className="rounded-full border border-[#E3B117]/25 bg-[#E3B117]/10 px-3 py-1.5 text-xs font-black text-white">
                    Agence Premium
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-4 gap-2.5 xl:gap-3">
                {kpis.map(([label, value, note]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 xl:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
                    <p className="text-xs leading-4 text-white/62">{label}</p>
                    <p className="mt-2 text-xl font-black text-white xl:text-2xl">{value}</p>
                    <p className="mt-1.5 text-[11px] font-bold text-[#F5C542] xl:text-xs">{note}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-[1.08fr_.92fr] gap-3 xl:mt-4 xl:gap-4">
                <div className="rounded-2xl border border-white/10 bg-black/24 p-4 xl:p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-black text-white">Réservations par mois</p>
                    <span className="rounded-full border border-[#E3B117]/25 bg-[#E3B117]/10 px-3 py-1 text-xs font-bold text-[#F5C542]">Juin</span>
                  </div>
                  <div className="mt-4 flex h-28 items-end gap-2 border-b border-l border-white/10 px-2 pb-2 xl:h-32">
                    {[44, 66, 52, 82, 60, 92, 72, 104].map((height, index) => (
                      <span
                        key={index}
                        className="flex-1 rounded-t-lg bg-gradient-to-t from-[#8b650b] to-[#F5C542] shadow-[0_0_18px_rgba(227,177,23,.18)]"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between text-[11px] text-white/42">
                    {['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'].map((month) => <span key={month}>{month}</span>)}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/24 p-4 xl:p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-black text-white">Prochaines réservations</p>
                    <span className="text-xs font-bold text-[#F5C542]">Voir toutes</span>
                  </div>
                  <div className="mt-3 grid gap-2.5 xl:mt-4 xl:gap-3">
                    {reservations.map(([name, vehicle, date, time]) => (
                      <div key={name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/8 pb-3 last:border-0 last:pb-0">
                        <span className="grid h-9 w-9 place-items-center rounded-full border border-[#E3B117]/20 bg-[#E3B117]/10 text-[#F5C542]">
                          <Users className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-white">{name}</span>
                          <span className="block truncate text-xs text-white/48">{vehicle}</span>
                        </span>
                        <span className="text-right text-xs">
                          <span className="block font-black text-[#F5C542]">{date}</span>
                          <span className="text-white/45">{time}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="landing-video-pedestal absolute bottom-0 left-1/2 h-28 w-[82%] -translate-x-1/2 rounded-[50%] border-2 border-[#E3B117]/70 bg-gradient-to-b from-[#E3B117]/28 via-[#1e1504] to-black shadow-[0_28px_80px_rgba(0,0,0,.76),0_0_78px_rgba(227,177,23,.38)]" />
      <div className="absolute bottom-9 left-1/2 h-9 w-[72%] -translate-x-1/2 rounded-[50%] border border-[#F5C542]/65 shadow-[0_0_30px_rgba(245,197,66,.30)]" />
    </div>
  );
}

function MobileCommandHero() {
  return (
    <div className="relative mt-8 pb-8 lg:hidden">
      <div className="pointer-events-none absolute left-1/2 top-14 h-[410px] w-[410px] -translate-x-1/2 rounded-full border border-[#E3B117]/35 shadow-[0_0_70px_rgba(227,177,23,.20)]" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-[#E3B117]/12 blur-3xl" />
      <div className="landing-mockup-float relative mx-auto w-[270px] rounded-[2.8rem] border border-[#F5C542]/45 bg-[#050606] p-2.5 shadow-[0_35px_90px_rgba(0,0,0,.78),0_0_46px_rgba(227,177,23,.18)] min-[390px]:w-[292px]">
        <div className="relative min-h-[555px] overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_76%_7%,rgba(227,177,23,.16),transparent_28%),linear-gradient(155deg,#11130f,#060706_48%,#0d0a03)] p-4">
          <div className="mx-auto h-5 w-24 rounded-full bg-black" />
          <div className="mt-5 flex items-center justify-between">
            <Logo compact />
            <Menu className="h-4 w-4 text-white/60" />
          </div>
          <p className="mt-6 text-[11px] text-white/45">Bonjour, Younes</p>
          <h3 className="mt-1 text-xl font-black">Tableau de bord</h3>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {[
              ['Réservations', '128', '+12%', CalendarDays],
              ['Véhicules', '23', '+5%', Car],
            ].map(([label, value, note, Icon]) => (
              <div key={label as string} className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
                <Icon className="h-4 w-4 text-[#F5C542]" />
                <p className="mt-2 text-xl font-black">{value as string}</p>
                <p className="text-[9px] text-white/45">{label as string}</p>
                <p className="mt-1 text-[9px] font-bold text-[#F5C542]">{note as string}</p>
              </div>
            ))}
          </div>
          <div className="mt-2.5 rounded-xl border border-white/10 bg-white/[0.045] p-3">
            <CircleDollarSign className="h-4 w-4 text-[#F5C542]" />
            <p className="mt-2 text-xl font-black">82,450 <span className="text-xs">MAD</span></p>
            <p className="text-[9px] text-white/45">Paiements reçus</p>
          </div>
          <div className="mt-2.5 rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black">Réservations par mois</p>
              <span className="text-[9px] text-[#F5C542]">Juin</span>
            </div>
            <div className="mt-3 flex h-20 items-end gap-2">
              {[38, 62, 47, 82, 59, 72, 94].map((height, index) => (
                <span key={index} className="flex-1 rounded-t bg-gradient-to-t from-[#8b650b] to-[#F5C542]" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="mt-2.5 rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <p className="text-xs font-black text-[#F5C542]">Réservations récentes</p>
            {[
              ['Mohamed Amine', 'Confirmé'],
              ['Sofia Belkacem', 'En cours'],
            ].map(([name, status]) => (
              <div key={name} className="mt-2 flex items-center justify-between border-t border-white/8 pt-2 text-[10px]">
                <span className="font-bold">{name}</span>
                <span className="rounded-full bg-[#E3B117]/10 px-2 py-1 text-[#F5C542]">{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="landing-video-pedestal pointer-events-none absolute bottom-0 left-1/2 h-16 w-[310px] -translate-x-1/2 rounded-[50%] border border-[#F5C542]/55 bg-[#E3B117]/12 shadow-[0_0_45px_rgba(227,177,23,.30)]" />
    </div>
  );
}

function RealDashboardShowcase({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className={mobile ? 'relative mt-8 pb-7 lg:hidden' : 'landing-mockup-float relative -translate-x-[3%] hidden w-[108%] max-w-[990px] justify-self-end pb-16 pt-8 lg:block'}>
      <div className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%] border border-[#E3B117]/40 shadow-[0_0_65px_rgba(227,177,23,.22)] ${
        mobile ? 'top-8 h-[255px] w-[340px]' : 'top-0 h-[440px] w-[820px]'
      }`} />
      <div className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-[#E3B117]/10 blur-3xl ${
        mobile ? 'top-20 h-48 w-72' : 'top-20 h-80 w-[680px]'
      }`} />
      <div className={`relative z-10 overflow-hidden border border-[#E3B117]/28 bg-[#070807] shadow-[0_35px_100px_rgba(0,0,0,.72),0_0_50px_rgba(227,177,23,.12)] ${
        mobile ? 'mx-auto aspect-[16/10] w-full rounded-[1.5rem] p-1.5' : 'aspect-[16/9] rounded-[2rem] p-2.5'
      }`}>
        <div className="h-full overflow-hidden rounded-[inherit] border border-white/8 bg-black">
          <img
            src="/landing/real-dashboard.png"
            alt="Tableau de bord réel MekLoc"
            className="h-full w-full scale-[1.12] object-cover object-center"
            loading={mobile ? 'lazy' : 'eager'}
            decoding="async"
          />
        </div>
      </div>
      <div className={`landing-video-pedestal pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 rounded-[50%] border border-[#F5C542]/45 bg-[#E3B117]/10 shadow-[0_0_42px_rgba(227,177,23,.24)] ${
        mobile ? 'h-12 w-[78%]' : 'h-20 w-[78%]'
      }`} />
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
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobileViewport = window.matchMedia('(max-width: 767px)').matches;
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.landing-reveal'));

    if (prefersReducedMotion || isMobileViewport || !('IntersectionObserver' in window)) {
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
      <TrialAnnouncement />

      <main className="landing-gradient-motion bg-[radial-gradient(circle_at_18%_6%,rgba(245,197,66,.16),transparent_30%),radial-gradient(circle_at_82%_24%,rgba(227,177,23,.12),transparent_32%),linear-gradient(rgba(255,255,255,.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:auto,auto,72px_72px,72px_72px]">
        <section className="landing-ambient relative overflow-hidden border-b border-white/10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#E3B117]/10 to-transparent" />
          <div className="pointer-events-none absolute -left-28 top-40 h-80 w-80 rounded-full bg-[#E3B117]/10 blur-3xl lg:hidden" />
          <div className="mx-auto grid w-full max-w-[1540px] items-center gap-9 px-4 py-9 sm:px-6 sm:py-14 lg:min-h-[calc(100vh-80px)] lg:grid-cols-[0.78fr_1.22fr] lg:gap-8 lg:px-8 lg:pb-8 lg:pt-4 xl:grid-cols-[0.8fr_1.2fr] xl:gap-10 xl:px-10 xl:pt-5">
            <div className="landing-reveal is-visible max-w-[610px]">
              <div className="landing-hero-kicker inline-flex max-w-full items-center gap-2 rounded-full border border-[#E3B117]/30 bg-[#E3B117]/10 px-3.5 py-2 text-xs font-bold leading-5 text-[#F5C542] sm:px-4 sm:text-sm">
                <Zap className="h-4 w-4" />
                <span className="lg:hidden">SaaS de gestion pour agences au Maroc</span>
                <span className="hidden lg:inline">SaaS de gestion pour agences de location au Maroc</span>
              </div>
              <h1 className="mt-6 text-[42px] font-black leading-[1.02] tracking-[-0.035em] text-white sm:text-6xl lg:text-[3.2rem] lg:leading-[1.035] xl:text-[3.62rem] 2xl:text-[3.88rem]">
                <span className="landing-hero-line block">Logiciel de gestion</span>
                <span className="landing-hero-line block">pour agences de location</span>
                <span className="landing-hero-line block">de voitures <span className="landing-gold-word text-[#E3B117]">au Maroc</span></span>
              </h1>
              <p className="landing-hero-copy mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8 lg:hidden">
                Réservations, véhicules, contrats PDF, paiements et alertes dans une seule plateforme.
              </p>
              <p className="landing-hero-copy mt-5 hidden max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8 lg:block">
                MekLoc centralise vos réservations, véhicules, clients, contrats PDF, paiements, cautions et alertes dans une seule plateforme.
              </p>
              <div className="landing-hero-actions mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href={accessRequestUrl}
                  className="landing-cta-shine inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#F5C542]/45 bg-[#E3B117] px-7 text-sm font-black text-[#070807] shadow-[0_18px_52px_rgba(227,177,23,.25),inset_0_1px_0_rgba(255,255,255,.30)] transition hover:-translate-y-0.5 hover:bg-[#F5C542] active:translate-y-0 sm:w-auto"
                >
                  <CalendarDays className="h-4 w-4" />
                  <span>Demandez votre accès</span>
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
              <div className="landing-hero-proof mt-5 grid grid-cols-3 gap-2.5 sm:max-w-[540px] sm:gap-3">
                {[
                  ['10 min', 'prise en main'],
                  ['MAD', 'prêt Maroc'],
                  ['PDF', 'contrats propres'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur">
                    <p className="text-lg font-black leading-none text-white">{value}</p>
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
              <RealDashboardShowcase mobile />
            </div>
            <div className="landing-reveal is-visible landing-hero-visual hidden lg:block">
              <RealDashboardShowcase />
            </div>
          </div>
        </section>

        <section className="landing-reveal border-b border-white/10 py-12 sm:py-20">
          <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <SectionTitle
              eyebrow="Avant / après"
              title="Avant MekLoc, la gestion est dispersée. Avec MekLoc, tout est centralisé."
            />
            <Card className="mt-8 p-4 hover:border-[#E3B117]/20 sm:p-7">
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

        <section id="fonctionnalites" className="landing-reveal border-b border-white/10 py-10 sm:py-12">
          <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <SectionTitle
              eyebrow="Plateforme complète"
              title="Toutes les fonctionnalités MekLoc"
              subtitle="Un seul espace premium pour gérer votre activité, de la première réservation jusqu’au suivi financier."
            />
            <div className="landing-stagger mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {choiceCards.map(([title, text, Icon]) => (
                <Card key={title as string} className="landing-reveal group relative min-h-[205px] overflow-hidden p-5 hover:-translate-y-1 hover:border-[#E3B117]/35 sm:p-6">
                  <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#E3B117]/8 blur-2xl transition group-hover:bg-[#E3B117]/14" />
                  <span className="relative grid h-11 w-11 place-items-center rounded-xl border border-[#E3B117]/25 bg-[#E3B117]/10 text-[#F5C542] shadow-[0_10px_30px_rgba(227,177,23,.08)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="relative mt-4 text-lg font-black text-white">{title as string}</h3>
                  <p className="relative mt-2 text-sm leading-6 text-zinc-400">{text as string}</p>
                </Card>
              ))}
            </div>
            <div className="mt-7 flex flex-col items-center justify-between gap-4 rounded-3xl border border-[#E3B117]/25 bg-[#E3B117]/[0.07] p-5 text-center sm:flex-row sm:text-left">
              <div>
                <p className="font-black text-white">Tout MekLoc, gratuitement pendant 7 jours</p>
                <p className="mt-1 text-sm text-zinc-400">Explorez réservations, contrats, paiements, rapports et entretien sans carte bancaire.</p>
              </div>
              <Link to="/demande-acces?plan=business&billing=monthly&trial=7" className="landing-trial-pulse inline-flex h-12 shrink-0 items-center justify-center rounded-2xl bg-[#E3B117] px-6 text-sm font-black text-[#070807] hover:bg-[#F5C542]">
                Commencer gratuitement
              </Link>
            </div>
          </div>
        </section>

        <section className="landing-reveal relative overflow-hidden border-b border-white/10 py-8 sm:py-10">
          <div className="pointer-events-none absolute right-0 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-[#E3B117]/7 blur-3xl" />
          <div className="relative mx-auto grid w-full min-w-0 max-w-[1240px] items-center gap-7 px-4 sm:px-6 lg:grid-cols-[0.68fr_1.32fr] lg:gap-8 lg:px-8">
            <div className="max-w-[440px] self-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Plateforme simple & puissante</p>
              <h2 className="mt-4 text-[32px] font-black leading-tight text-white sm:text-4xl">Voyez MekLoc en action</h2>
              <p className="mt-4 text-base leading-7 text-zinc-400">
                Une interface claire pour gérer vos clients, leurs documents et leur historique.
              </p>
              <div className="mt-5 space-y-2.5">
                {[
                  'Gestion des clients',
                  'Documents d’identité',
                  'Historique des réservations',
                  'Paiements et restes à payer',
                ].map((item) => (
                  <p key={item} className="flex items-center gap-3 text-sm font-semibold text-white/80">
                    <Check className="h-4 w-4 shrink-0 text-[#F5C542]" />
                    {item}
                  </p>
                ))}
              </div>
              <a
                href={demoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#E3B117]/35 bg-[#E3B117] px-6 text-sm font-black text-[#070807] transition hover:-translate-y-0.5 hover:bg-[#F5C542]"
              >
                <MessageCircle className="h-4 w-4" />
                Demander une démo
              </a>
            </div>

            <div className="landing-mockup-float relative min-w-0 w-full max-w-[790px] justify-self-end">
              <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-[#E3B117]/8 blur-3xl" />
              <div className="relative overflow-hidden rounded-[1.35rem] border border-[#E3B117]/22 bg-[#070807] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,.58)] sm:rounded-[1.7rem] sm:p-2">
                <div className="aspect-[16/10] overflow-hidden rounded-[1.15rem] border border-white/8 bg-black sm:aspect-[16/9] sm:rounded-[1.55rem]">
                  <img
                    src="/landing/real-clients.png"
                    alt="Page Clients réelle de MekLoc"
                    className="h-full w-full scale-[1.15] object-cover object-center"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="tarifs" className="landing-reveal border-b border-white/10 pb-12 pt-10 sm:pb-16 sm:pt-14">
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
            <div className="landing-stagger mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4 xl:gap-5">
              {plans.map((plan) => {
                const isLifetime = 'lifetime' in plan && plan.lifetime;
                const displayPrice = isLifetime ? plan.annualPrice : billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
                const cadence = isLifetime ? 'paiement unique' : billingCycle === 'annual' ? '/ an' : '/ mois';
                const planUrl = `/demande-acces?plan=${plan.id}&billing=${isLifetime ? 'lifetime' : billingCycle}`;

                return (
                  <Card key={plan.id} className={`landing-reveal relative flex min-h-full flex-col overflow-hidden p-6 hover:border-[#E3B117]/30 sm:p-7 ${plan.recommended ? 'border-[#E3B117]/65 bg-gradient-to-br from-[#E3B117]/12 via-zinc-950/90 to-black shadow-[0_0_70px_rgba(227,177,23,.16)]' : ''} ${isLifetime ? 'border-[#F5C542]/70 bg-gradient-to-br from-[#E3B117]/18 via-zinc-950/92 to-black shadow-[0_0_90px_rgba(227,177,23,.22)]' : ''}`}>
                    {plan.recommended || isLifetime ? <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#F5C542]/80 to-transparent" /> : null}
                    {plan.recommended ? <span className="absolute right-5 top-5 rounded-full bg-[#E3B117] px-3 py-1 text-xs font-black text-[#070807] sm:right-6 sm:top-6">Recommandé</span> : null}
                    {isLifetime ? <span className="absolute right-5 top-5 rounded-full bg-white px-3 py-1 text-xs font-black text-[#070807] sm:right-6 sm:top-6">Meilleure valeur</span> : null}
                    <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#E3B117]/25 bg-[#E3B117]/10 text-[#F5C542]"><Sparkles className="h-6 w-6" /></span>
                    <h3 className="mt-5 text-2xl font-black">{plan.name}</h3>
                    <p className="mt-1 text-sm text-white/50">{plan.note}</p>
                    <div className="mt-6 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 sm:mt-7">
                      <span className="text-4xl font-black tracking-[-0.025em] sm:text-5xl">{displayPrice.toLocaleString('fr-FR')}</span>
                      <span className="text-lg font-black text-white">MAD</span>
                      <span className="text-sm font-semibold text-white/55 sm:text-base">{cadence}</span>
                    </div>
                    {isLifetime ? (
                      <p className="mt-2 text-sm font-semibold text-[#F5C542]">Accès à vie, un seul paiement</p>
                    ) : billingCycle === 'annual' ? (
                      <p className="mt-2 text-sm font-semibold text-[#F5C542]">Facturation annuelle</p>
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
                    {!isLifetime ? (
                      <Link
                        to={`${planUrl}&trial=7`}
                        className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl border border-[#E3B117]/30 bg-[#E3B117]/8 text-sm font-black text-[#F5C542] transition hover:border-[#E3B117]/55 hover:bg-[#E3B117]/14"
                      >
                        Essai gratuit 7 jours
                      </Link>
                    ) : null}
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
                <details key={question} className="landing-faq group rounded-2xl border border-white/10 bg-zinc-950/75 transition hover:border-[#E3B117]/28 hover:bg-zinc-900/70">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-bold sm:px-6 sm:py-5">
                    {question}
                    <ChevronDown className="h-4 w-4 shrink-0 text-white/60 transition group-open:rotate-180" />
                  </summary>
                  <p className="landing-faq-answer px-6 pb-6 text-sm leading-7 text-zinc-400">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="landing-reveal relative scroll-mt-24 overflow-hidden border-b border-white/10 py-12 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(227,177,23,.13),transparent_42%)]" />
          <div className="relative mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-[2rem] border border-[#E3B117]/35 bg-[linear-gradient(135deg,rgba(227,177,23,.10),rgba(12,13,12,.96)_34%,rgba(3,4,3,.98))] px-6 py-10 text-center shadow-[0_35px_100px_rgba(0,0,0,.45),0_0_70px_rgba(227,177,23,.10)] sm:px-10 sm:py-14">
              <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full border border-[#F5C542]/25 shadow-[0_0_70px_rgba(227,177,23,.18)]" />
              <div className="pointer-events-none absolute -bottom-28 -left-24 h-64 w-64 rounded-full bg-[#E3B117]/8 blur-3xl" />
              <div className="relative mx-auto max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#F5C542]">Passez à une gestion plus claire</p>
                <h2 className="mt-4 text-[30px] font-black leading-tight text-white sm:text-4xl lg:text-5xl">Prêt à moderniser votre agence ?</h2>
                <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
                  Réservez une session gratuite de cadrage et découvrez comment MekLoc peut simplifier votre gestion.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <a
                    href={accessRequestUrl}
                    className="landing-cta-shine inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-[#F5C542]/50 bg-[#E3B117] px-7 text-sm font-black text-[#070807] shadow-[0_18px_50px_rgba(227,177,23,.22)] transition hover:-translate-y-0.5 hover:bg-[#F5C542] active:translate-y-0"
                  >
                    <CalendarDays className="h-4 w-4" />
                    Demandez votre accès
                  </a>
                  <a
                    href={demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.055] px-7 text-sm font-black text-white transition hover:-translate-y-0.5 hover:border-[#E3B117]/35 hover:bg-white/[0.09] active:translate-y-0"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Voir la démo
                  </a>
                </div>
                <p className="mt-6 text-sm font-bold text-white/55">Conçu pour les agences de location au Maroc 🇲🇦</p>
              </div>
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
                  <a href={accessRequestUrl} className="block hover:text-[#F5C542]">Demande d’accès</a>
                  <a href="#faq" className="block hover:text-[#F5C542]">Foire aux questions</a>
                  <Link to="/login" className="block hover:text-[#F5C542] lg:hidden">Connexion</Link>
                  <a href={accessRequestUrl} className="block hover:text-[#F5C542] lg:hidden">Demandez votre accès</a>
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
