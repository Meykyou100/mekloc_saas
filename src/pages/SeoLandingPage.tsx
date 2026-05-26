import { ArrowLeft, CheckCircle2, FileText, Gauge, Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO, { baseStructuredData } from '../components/system/SEO';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from '../config/app';
import { DEFAULT_KEYWORDS, SITE_NAME } from '../config/seo';

const pages = {
  '/logiciel-location-voiture-maroc': {
    title: 'Logiciel location voiture Maroc – MekLoc',
    description: 'Découvrez MekLoc, logiciel de gestion pour agences de location de voitures au Maroc : réservations, flotte, contrats PDF, paiements et entretien.',
    h1: 'Logiciel location voiture Maroc',
    lead: 'MekLoc centralise les opérations quotidiennes des agences de location de voitures au Maroc dans une plateforme cloud professionnelle.',
    icon: Gauge,
    bullets: ['Réservations en temps réel', 'Gestion flotte et véhicules', 'Contrats PDF professionnels', 'Paiements, cautions et entretien'],
  },
  '/contrats-location-voiture-pdf': {
    title: 'Contrats location voiture PDF Maroc – MekLoc',
    description: 'Générez des contrats de location de voiture PDF professionnels au Maroc avec MekLoc, personnalisés avec les informations de votre agence.',
    h1: 'Contrats location voiture PDF au Maroc',
    lead: 'MekLoc aide votre agence à produire des contrats PDF propres, cohérents et faciles à envoyer depuis une réservation.',
    icon: FileText,
    bullets: ['Contrats PDF avec logo agence', 'Données client et véhicule reprises automatiquement', 'Export et renvoi faciles', 'Historique accessible'],
  },
  '/gestion-flotte-location': {
    title: 'Gestion flotte location voiture – MekLoc',
    description: 'Suivez votre flotte de véhicules de location avec MekLoc : disponibilité, documents, entretien, alertes assurance et visite technique.',
    h1: 'Gestion de flotte pour location de voitures',
    lead: 'Gardez une vue claire sur vos véhicules, disponibilités, entretiens et documents depuis un seul espace MekLoc.',
    icon: ShieldCheck,
    bullets: ['Disponibilités centralisées', 'Alertes entretien et documents', 'Historique véhicule', 'Suivi par agence et équipe'],
  },
  '/contact': {
    title: 'Contact MekLoc – Logiciel location voiture Maroc',
    description: 'Contactez MekLoc pour digitaliser votre agence de location de voitures au Maroc. Demandez une démo ou un accès.',
    h1: 'Contact MekLoc',
    lead: 'Parlez-nous de votre agence, de votre flotte et de vos besoins. Notre équipe vous aide à lancer MekLoc rapidement.',
    icon: Mail,
    bullets: [`Email : ${SUPPORT_EMAIL}`, `WhatsApp : ${SUPPORT_PHONE_DISPLAY}`, 'Disponible pour les agences au Maroc', 'Démonstration et cadrage'],
  },
} as const;

type SeoPath = keyof typeof pages;

export default function SeoLandingPage({ path }: { path: SeoPath }) {
  const page = pages[path];
  const Icon = page.icon;

  return (
    <div className="min-h-screen bg-[#050606] px-4 py-8 text-white sm:px-6 lg:px-8">
      <SEO
        title={page.title}
        description={page.description}
        canonical={path}
        keywords={DEFAULT_KEYWORDS}
        jsonLd={baseStructuredData()}
      />
      <main className="mx-auto max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400 transition hover:text-gold-200">
          <ArrowLeft className="h-4 w-4" />
          Retour à l’accueil
        </Link>
        <section className="mt-8 rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_80%_0%,rgba(227,177,23,.16),transparent_36%),linear-gradient(135deg,rgba(24,24,27,.9),rgba(0,0,0,.92))] p-6 shadow-[0_30px_90px_rgba(0,0,0,.35)] sm:p-10">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold-300/25 bg-gold-400/10 text-gold-200">
            <Icon className="h-7 w-7" />
          </div>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-gold-300">{SITE_NAME}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">{page.h1}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">{page.lead}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {page.bullets.map((item) => (
              <Card key={item} className="flex items-start gap-3 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-gold-300" />
                <span className="text-sm leading-6 text-zinc-300">{item}</span>
              </Card>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/demande-acces">
              <Button className="w-full sm:w-auto">Demander un accès</Button>
            </Link>
            <Link to="/#tarifs">
              <Button variant="secondary" className="w-full sm:w-auto">Voir les tarifs</Button>
            </Link>
          </div>
        </section>
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ['Fonctionnalités', 'Réservations, clients, véhicules, contrats PDF, paiements et entretien.'],
            ['Pour le Maroc', 'MAD, WhatsApp, flotte locale et workflow pensé pour les agences marocaines.'],
            ['Plateforme cloud', 'Accès depuis ordinateur ou téléphone, avec données centralisées.'],
          ].map(([title, text]) => (
            <Card key={title} className="p-5">
              <h2 className="text-xl font-black">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{text}</p>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
