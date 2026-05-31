import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Car,
  CheckCircle2,
  CreditCard,
  FileSignature,
  HelpCircle,
  Headphones,
  LayoutDashboard,
  Mail,
  MessageCircle,
  Settings,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import Modal from '../ui/Modal';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, WHATSAPP_URL } from '../../config/app';
import { canAccess, type AppPermission } from '../../lib/permissions';

const navItems = [
  { label: 'dashboard', to: '/dashboard', icon: LayoutDashboard, permission: 'dashboard' as AppPermission },
  { label: 'calendar', to: '/calendar', icon: CalendarDays, permission: 'reservations' as AppPermission },
  { label: 'reservations', to: '/reservations', icon: CalendarDays, permission: 'reservations' as AppPermission },
  { label: 'vehicles', to: '/vehicles', icon: Car, permission: 'vehicles' as AppPermission },
  { label: 'clients', to: '/clients', icon: Users, permission: 'clients' as AppPermission },
  { label: 'contracts', to: '/contracts', icon: FileSignature, permission: 'contracts' as AppPermission },
  { label: 'payments', to: '/payments', icon: CreditCard, permission: 'payments' as AppPermission },
  { label: 'maintenance', to: '/maintenance', icon: Wrench, permission: 'maintenance' as AppPermission },
  { label: 'reports', to: '/reports', icon: BarChart3, permission: 'reports' as AppPermission },
  { label: 'settings', to: '/settings', icon: Settings, permission: 'settings' as AppPermission },
];

const faqItems = [
  {
    question: 'Comment créer une réservation ?',
    answer: 'Depuis Réservations, utilisez Ajouter une réservation, puis suivez les étapes client, véhicule, dates, tarif et validation.',
  },
  {
    question: 'Comment modifier un véhicule ?',
    answer: 'Depuis Véhicules, ouvrez l’action Modifier sur le véhicule concerné, ajustez les champs puis enregistrez.',
  },
  {
    question: 'Comment télécharger un contrat ?',
    answer: 'Depuis Contrats, sélectionnez la réservation ou un contrat archivé, puis utilisez Télécharger PDF.',
  },
  {
    question: 'Comment suivre les paiements ?',
    answer: 'La page Paiements affiche total, payé, reste à payer et statut. Les factures partielles ou en retard restent visibles dans les filtres.',
  },
  {
    question: 'Comment gérer les documents client ?',
    answer: 'Depuis Clients, ouvrez la fiche ou le formulaire client pour ajouter ou vérifier les pièces d’identité disponibles.',
  },
];

const proBenefits = [
  'Centralisation des réservations',
  'Contrats professionnels',
  'Suivi paiements & cautions',
  'Rapports financiers',
  'Support prioritaire',
];

function SidebarContent({ onClose, onHelp, onPro }: { onClose?: () => void; onHelp: () => void; onPro: () => void }) {
  const { t } = useApp();
  const { profile } = useAuth();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_20%_0%,rgba(227,177,23,.08),transparent_28%)] pb-3 text-[var(--app-text)]">
      <div className="shrink-0 px-4 pb-2.5 pt-3.5 lg:px-4 lg:pt-4">
        <div className="flex items-center justify-between gap-3">
        <NavLink to="/" className="group flex min-w-0 items-center gap-2.5" onClick={onClose}>
          <span className="relative flex h-10 w-11 shrink-0 items-center justify-center">
            <span className="absolute inset-0 rounded-2xl bg-gold-400/10 blur-xl opacity-70" />
            <img
              src="/mekloc-logo-mark.png"
              alt="MekLoc"
              className="relative h-9 w-auto max-w-[42px] object-contain drop-shadow-[0_8px_18px_rgba(227,177,23,.12)]"
            />
          </span>
          <span className="min-w-0">
            <span className="block text-[19px] font-black leading-5 tracking-tight text-white light:text-carbon-950">
              MekLoc
            </span>
            <span className="mt-0.5 block max-w-[164px] truncate text-[10px] font-semibold leading-3 text-carbon-400 light:text-carbon-600">
              Gestion location automobile
            </span>
          </span>
        </NavLink>
        <button
          aria-label="Close sidebar"
          className="rounded-xl p-1.5 text-carbon-300 hover:bg-white/10 lg:hidden"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
        </div>
      </div>
      <nav className="grid shrink-0 gap-1 px-2.5 py-1">
        {navItems
          .filter((item) => canAccess(profile?.role, item.permission))
          .map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `group relative flex min-h-10 items-center gap-2.5 overflow-hidden rounded-[1rem] border px-2.5 py-1.5 text-[13px] font-semibold transition ${
                isActive
                  ? 'border-gold-200/25 bg-gradient-to-r from-gold-400/[0.18] via-gold-400/[0.08] to-white/[0.025] text-gold-100 shadow-[0_0_24px_rgba(227,177,23,.09),inset_0_1px_0_rgba(255,255,255,.04)] before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-r-full before:bg-gold-300 light:text-gold-800'
                  : 'border-transparent text-[var(--app-text-muted)] hover:border-[var(--app-border)] hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]'
              }`
            }
          >
            <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-[0.8rem] bg-white/[0.04] text-carbon-300 transition group-hover:bg-gold-400/10 group-hover:text-gold-100 light:bg-carbon-950/[0.035]">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="relative">{t(label)}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto shrink-0 space-y-2 px-3 pb-3 pt-2">
        <div className="rounded-2xl border border-gold-200/12 bg-[linear-gradient(180deg,rgba(212,160,23,.09),rgba(255,255,255,.025))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] [@media(max-height:700px)]:py-2">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-300" />
            <p className="text-[13px] font-bold text-white light:text-carbon-950">MekLoc Pro</p>
          </div>
          <p className="mt-1 text-[11px] font-semibold leading-4 text-carbon-300 light:text-carbon-700">Espace agence activé</p>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] font-semibold text-carbon-400 [@media(max-height:700px)]:hidden">
            {['Gestion flotte', 'Contrats PDF', 'Paiements suivis', 'Rapports financiers'].map((feature) => (
              <span key={feature} className="truncate rounded-lg border border-white/10 bg-black/20 px-2 py-1">{feature}</span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onPro();
              onClose?.();
            }}
            className="mt-2 flex h-8 w-full items-center justify-center rounded-xl border border-gold-300/20 bg-gold-400/10 text-[11px] font-black text-gold-100 transition hover:border-gold-300/45 hover:bg-gold-400/15"
          >
            Voir les avantages
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            onHelp();
            onClose?.();
          }}
          className="group flex cursor-pointer items-center gap-2.5 rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 to-black/70 p-2.5 transition hover:border-yellow-500/30 hover:bg-yellow-500/5 light:border-carbon-950/10 light:from-white light:to-carbon-50 [@media(max-height:640px)]:hidden"
        >
          <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-gold-300/15 bg-gold-400/10 text-gold-200 transition group-hover:border-gold-300/35 group-hover:bg-gold-400/15">
            <Headphones className="h-4 w-4" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-carbon-950 light:ring-white" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-white light:text-carbon-950">Besoin d’aide ?</span>
            <span className="mt-0.5 block text-[11px] font-medium text-carbon-400 light:text-carbon-600">Support MekLoc</span>
          </span>
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(faqItems[0].question);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-[var(--app-border)] bg-[var(--app-sidebar)] backdrop-blur-2xl lg:block">
        <SidebarContent onHelp={() => setHelpOpen(true)} onPro={() => setProOpen(true)} />
      </aside>
      <div
        className={`fixed inset-0 z-40 bg-carbon-950/70 backdrop-blur-sm transition lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[86vw] border-r border-[var(--app-border)] bg-[var(--app-sidebar)] backdrop-blur-2xl transition-transform ${open ? 'translate-x-0' : '-translate-x-full'} lg:hidden`}
      >
        <SidebarContent onClose={onClose} onHelp={() => setHelpOpen(true)} onPro={() => setProOpen(true)} />
      </aside>
      <Modal
        open={helpOpen}
        title="Centre d’assistance MekLoc"
        subtitle="Trouvez rapidement de l’aide pour utiliser votre espace de gestion."
        onClose={() => setHelpOpen(false)}
        panelClassName="sm:max-w-5xl"
        bodyClassName="bg-[#090B0F]"
      >
        <div className="space-y-5 pb-[calc(env(safe-area-inset-bottom)+8px)]">
          <section className="rounded-3xl border border-gold-300/15 bg-gradient-to-br from-[#171410] via-white/[0.045] to-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-gold-300/20 bg-gold-400/10 text-gold-200">
                <Headphones className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gold-200">Support</h3>
                <p className="mt-1 text-xs text-carbon-500">Choisissez le canal le plus adapté.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <a
                href={`${WHATSAPP_URL}?text=${encodeURIComponent("Bonjour MekLoc, j'ai besoin d'aide sur la plateforme.")}`}
                target="_blank"
                rel="noreferrer"
                className="group rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-emerald-300/35 hover:bg-emerald-500/10"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-500/10 text-emerald-200">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-white">WhatsApp Support</p>
                    <p className="mt-1 truncate text-xs text-carbon-500">{SUPPORT_PHONE_DISPLAY}</p>
                  </div>
                </div>
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Support MekLoc')}`}
                className="group rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-gold-300/35 hover:bg-gold-400/10"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl border border-gold-300/20 bg-gold-400/10 text-gold-200">
                    <Mail className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-white">Email Support</p>
                    <p className="mt-1 truncate text-xs text-carbon-500">{SUPPORT_EMAIL}</p>
                  </div>
                </div>
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Demande de démo d'aide MekLoc")}`}
                className="group rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-gold-300/35 hover:bg-gold-400/10"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl border border-gold-300/20 bg-gold-400/10 text-gold-200">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-black text-white">Demander une démo d’aide</p>
                    <p className="mt-1 truncate text-xs text-carbon-500">Session guidée</p>
                  </div>
                </div>
              </a>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.055] to-white/[0.025] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.055] text-gold-200">
                  <HelpCircle className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gold-200">FAQ</h3>
                  <p className="mt-1 truncate text-xs text-carbon-500">Questions fréquentes</p>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              {faqItems.map((item) => {
                const active = activeFaq === item.question;
                return (
                  <button
                    key={item.question}
                    type="button"
                    onClick={() => setActiveFaq(active ? '' : item.question)}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      active ? 'border-gold-300/35 bg-gold-400/10' : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.045]'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-bold text-white">{item.question}</span>
                      <ArrowRight className={`h-4 w-4 shrink-0 text-carbon-500 transition ${active ? 'rotate-90 text-gold-200' : ''}`} />
                    </span>
                    {active ? <span className="mt-2 block text-sm leading-6 text-carbon-300">{item.answer}</span> : null}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </Modal>
      <Modal
        open={proOpen}
        title="MekLoc Pro"
        subtitle="Un espace agence conçu pour centraliser vos opérations de location."
        onClose={() => setProOpen(false)}
        panelClassName="sm:max-w-2xl"
        bodyClassName="bg-[#090B0F]"
      >
        <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+8px)]">
          <div className="rounded-3xl border border-gold-300/15 bg-gradient-to-br from-[#171410] via-white/[0.045] to-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-gold-200">Espace agence activé</p>
            <h3 className="mt-2 text-2xl font-black text-white">Pilotez votre agence depuis un seul endroit.</h3>
            <p className="mt-2 text-sm leading-6 text-carbon-300">MekLoc Pro rassemble les modules essentiels pour suivre les réservations, véhicules, clients, contrats, paiements et rapports sans multiplier les fichiers.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {proBenefits.map((benefit) => (
              <div key={benefit} className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold-300/20 bg-gold-400/10 text-gold-200">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span className="text-sm font-bold text-white">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
