import { Activity, AlertTriangle, Banknote, CalendarClock, CheckCircle2, ChevronDown, Clock3, Crown, Eye, FileText, Headphones, Laptop2, Mail, Menu, MoreHorizontal, Play, RefreshCw, Search, ShieldAlert, Smartphone, Trash2, UserPlus, Users, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { useApp } from '../context/AppContext';
import { useAuth, type AccountStatus, type AgencyPlan, type BillingStatus, type PaymentMethod, type SubscriptionStatus } from '../context/AuthContext';
import { formatMAD } from '../data/mockData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { SUPPORT_REASON_MIN_LENGTH, useSupportMode, type SupportAccessMode } from '../context/SupportModeContext';

type AccessRequestStatus = 'pending' | 'pending_verification' | 'contacted' | 'payment_pending' | 'approved' | 'rejected' | 'verified';
type AccessRequestRow = {
  id: string;
  agency_name: string;
  owner_name: string;
  email: string;
  phone_country_code: string;
  phone_number: string;
  country: string;
  city: string;
  selected_plan: AgencyPlan;
  billing_type: 'monthly' | 'annual' | 'lifetime';
  vehicle_count: number;
  status: AccessRequestStatus;
  admin_notes: string | null;
  created_at: string;
  activation_link?: string | null;
  crm_metadata?: CrmMetadata | null;
};

type PipelineStatus = 'new' | 'contacted' | 'interested' | 'demo_sent' | 'trial_active' | 'follow_up' | 'ready_to_pay' | 'paid' | 'lost';
type HealthScore = 'active' | 'follow_up' | 'risk' | 'ready_to_pay';
type CrmMetadata = {
  pipeline_status?: PipelineStatus;
  follow_up_date?: string | null;
  internal_notes?: string;
  health_score?: HealthScore;
  last_contact_at?: string | null;
};

type AdminAgency = {
  id: string;
  agencyName: string;
  ownerName: string;
  email: string;
  plan: AgencyPlan;
  billingStatus: BillingStatus;
  subscriptionStatus: SubscriptionStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  paidUntil: string | null;
  lastPaymentDate: string | null;
  paymentMethod: PaymentMethod;
  paymentNotes: string;
  trialReminder3dSentAt: string | null;
  trialReminder1dSentAt: string | null;
  trialExpiredEmailSentAt: string | null;
  lastTrialExtendedAt: string | null;
  nextPaymentDueDate: string | null;
  vehiclesCount: number;
  usersCount: number;
  accountStatus: AccountStatus;
  monthlyPrice: number;
  createdAt: string | null;
  latestActivityAt: string | null;
  settings: Record<string, unknown>;
};

type AdminUserRow = {
  id: string;
  agency_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  account_status: AccountStatus;
  last_login_at?: string | null;
  last_seen_at?: string | null;
  force_logout_at?: string | null;
  deletion_requested_at?: string | null;
  deletion_scheduled_at?: string | null;
};

type UserSessionRow = {
  id: string;
  user_id: string;
  agency_id: string;
  device_id?: string | null;
  session_key?: string | null;
  device_name: string | null;
  device_label?: string | null;
  device_type?: string | null;
  browser: string | null;
  os: string | null;
  last_activity_at?: string | null;
  last_seen_at: string | null;
  first_seen_at: string | null;
  revoked_at: string | null;
};

type SupportLogRow = {
  id: string;
  agency_id: string;
  super_admin_user_id: string;
  reason: string;
  mode: SupportAccessMode;
  started_at: string;
  ended_at: string | null;
  expires_at: string;
  status?: 'active' | 'ended' | 'expired';
  adminName: string;
  adminEmail: string;
};

type SuperAdminView =
  | 'overview'
  | 'crm'
  | 'agencies'
  | 'subscriptions'
  | 'payments'
  | 'users'
  | 'sessions'
  | 'access'
  | 'deletions'
  | 'alerts'
  | 'reports'
  | 'settings'
  | 'support';

type CrmActivity = {
  vehicles: number;
  reservations: number;
  contracts: number;
  payments: number;
  activeSessions: number;
};

type CrmLead = {
  key: string;
  source: 'agency' | 'request';
  id: string;
  agencyName: string;
  ownerName: string;
  email: string;
  phone: string;
  subscriptionLabel: string;
  lastLoginAt: string | null;
  crm: CrmMetadata;
  activity: CrmActivity;
  agency?: AdminAgency;
  request?: AccessRequestRow;
};

const pipelineStages: Array<{ value: PipelineStatus; label: string }> = [
  { value: 'new', label: 'Nouveau lead' },
  { value: 'contacted', label: 'Contacté' },
  { value: 'interested', label: 'Intéressé' },
  { value: 'demo_sent', label: 'Démo envoyée' },
  { value: 'trial_active', label: 'Essai actif' },
  { value: 'follow_up', label: 'À relancer' },
  { value: 'ready_to_pay', label: 'Prêt à payer' },
  { value: 'paid', label: 'Payé' },
  { value: 'lost', label: 'Perdu' },
];

const healthLabels: Record<HealthScore, string> = {
  active: 'Actif',
  follow_up: 'À relancer',
  risk: 'Risque de perte',
  ready_to_pay: 'Prêt à payer',
};

function readCrmMetadata(value: unknown): CrmMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as CrmMetadata;
}

function agencyCrm(agency: AdminAgency) {
  return readCrmMetadata(agency.settings.crm);
}

function inferAgencyPipeline(agency: AdminAgency): PipelineStatus {
  const saved = agencyCrm(agency).pipeline_status;
  if (saved) return saved;
  const status = effectiveAdminStatus(agency);
  if (status === 'active_paid') return 'paid';
  if (status === 'trial_active') return 'trial_active';
  if (status === 'payment_pending') return 'ready_to_pay';
  if (status === 'trial_expired' || status === 'suspended') return 'follow_up';
  return 'contacted';
}

function inferRequestPipeline(request: AccessRequestRow): PipelineStatus {
  if (request.crm_metadata?.pipeline_status) return request.crm_metadata.pipeline_status;
  if (request.status === 'rejected') return 'lost';
  if (request.status === 'payment_pending') return 'ready_to_pay';
  if (request.status === 'contacted') return 'contacted';
  if (request.status === 'approved' || request.status === 'verified') return 'interested';
  return 'new';
}

const monthlyPriceByPlan: Record<AgencyPlan, number> = { starter: 199, pro: 599, business: 399, lifetime: 5999 };

function addDays(baseDate: string | null, days: number) {
  const d = baseDate ? new Date(baseDate) : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalizeAdminAgencyRole(role: string | null | undefined) {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'owner' || value === 'admin') return 'owner';
  if (value === 'manager') return 'manager';
  if (value === 'accountant') return 'accountant';
  return 'agent';
}

function pickAgencyOwnerProfile<T extends { agency_id: string | null; role?: string | null; email?: string | null }>(profiles: T[], agencyId: string) {
  const agencyProfiles = profiles.filter((p) => p.agency_id === agencyId);
  return (
    agencyProfiles.find((p) => normalizeAdminAgencyRole(p.role) === 'owner' && p.email) ||
    agencyProfiles.find((p) => p.email) ||
    agencyProfiles[0] ||
    null
  );
}

function planLabel(plan: AgencyPlan) {
  if (plan === 'lifetime') return 'Plan Lifetime';
  if (plan === 'business') return 'Plan Business';
  if (plan === 'pro') return 'Plan Pro';
  return 'Plan Starter';
}

function billingLabel(status: BillingStatus) {
  if (status === 'trial') return 'Essai';
  if (status === 'paid') return 'Payé';
  if (status === 'unpaid') return 'Non payé';
  if (status === 'overdue') return 'En retard';
  if (status === 'cancelled') return 'Annulé';
  return status;
}

function subscriptionLabel(status: SubscriptionStatus) {
  if (status === 'trial_active') return 'Essai actif';
  if (status === 'trial_expired') return 'Essai expiré';
  if (status === 'active_paid') return 'Abonnement actif';
  if (status === 'payment_pending') return 'Paiement en attente';
  return 'Suspendu';
}

function effectiveAdminStatus(agency: Pick<AdminAgency, 'subscriptionStatus' | 'trialEndsAt' | 'paidUntil'>): SubscriptionStatus {
  if (agency.subscriptionStatus === 'trial_active' && agency.trialEndsAt && new Date(agency.trialEndsAt).getTime() < Date.now()) return 'trial_expired';
  if (agency.subscriptionStatus === 'active_paid' && agency.paidUntil && new Date(agency.paidUntil).getTime() < Date.now()) return 'payment_pending';
  return agency.subscriptionStatus;
}

function subscriptionTone(status: SubscriptionStatus) {
  if (status === 'active_paid') return 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200';
  if (status === 'trial_active') return 'border-sky-300/30 bg-sky-400/15 text-sky-200';
  if (status === 'payment_pending') return 'border-amber-300/30 bg-amber-400/15 text-amber-200';
  return 'border-rose-300/30 bg-rose-400/15 text-rose-200';
}

function accountLabel(status: AccountStatus) {
  if (status === 'active') return 'Actif';
  if (status === 'suspended') return 'Suspendu';
  if (status === 'pending_deletion') return 'Suppression planifiée';
  if (status === 'rejected') return 'Rejeté';
  return 'En attente';
}

function statusPillClass(kind: 'plan' | 'billing' | 'account', value: string) {
  if (kind === 'plan') return 'border-[#E3B117]/30 bg-[#E3B117]/10 text-[#F5C542]';
  if (kind === 'billing') {
    if (value === 'paid') return 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200';
    if (value === 'trial') return 'border-amber-300/30 bg-amber-400/15 text-amber-200';
    return 'border-rose-300/30 bg-rose-400/15 text-rose-200';
  }
  if (value === 'active') return 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200';
  if (value === 'suspended' || value === 'rejected' || value === 'pending_deletion') return 'border-rose-300/30 bg-rose-400/15 text-rose-200';
  return 'border-amber-300/30 bg-amber-400/15 text-amber-200';
}

function StatusPill({ children, className }: { children: string; className: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function dueState(date: string | null | undefined) {
  if (!date) return { label: 'Non planifiée', tone: 'neutral' as const, days: null as number | null };
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return { label: 'Date invalide', tone: 'neutral' as const, days: null as number | null };
  const days = Math.ceil((parsed.getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `En retard ${Math.abs(days)} j`, tone: 'danger' as const, days };
  if (days <= 7) return { label: `Dans ${days} j`, tone: 'warning' as const, days };
  return { label: `Dans ${days} j`, tone: 'ok' as const, days };
}

function supportLogStatus(log: SupportLogRow) {
  if (log.ended_at || log.status === 'ended') return 'ended' as const;
  if (log.status === 'expired' || new Date(log.expires_at).getTime() <= Date.now()) return 'expired' as const;
  return 'active' as const;
}

function supportLogDuration(log: SupportLogRow) {
  const started = new Date(log.started_at).getTime();
  const end = log.ended_at
    ? new Date(log.ended_at).getTime()
    : Math.min(Date.now(), new Date(log.expires_at).getTime());
  return `${Math.max(1, Math.round((end - started) / 60_000))} min`;
}

function MiniMetric({ label, value, icon: Icon, tone = 'gold' }: { label: string; value: string; icon: ElementType; tone?: 'gold' | 'green' | 'red' | 'blue' }) {
  const tones = {
    gold: 'border-[#E3B117]/20 bg-[#E3B117]/10 text-[#F5C542]',
    green: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200',
    red: 'border-rose-300/20 bg-rose-400/10 text-rose-200',
    blue: 'border-sky-300/20 bg-sky-400/10 text-sky-200',
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:border-[#E3B117]/25 motion-safe:hover:shadow-[0_18px_50px_rgba(0,0,0,.25)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-carbon-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function SuperAdminSidebar({
  revenue,
  profileName,
  activeView,
  onSelectView,
  mode = 'desktop',
  onClose,
}: {
  revenue: number;
  profileName: string;
  activeView: SuperAdminView;
  onSelectView: (view: SuperAdminView) => void;
  mode?: 'desktop' | 'mobile';
  onClose?: () => void;
}) {
  const navGroups = [
    {
      label: 'Vue générale',
      items: [
        ['Tableau de bord', Users, 'overview'],
        ['Alertes', AlertTriangle, 'alerts'],
        ['Rapports', Activity, 'reports'],
      ],
    },
    {
      label: 'Gestion agences',
      items: [
        ['Agences', BuildingIcon, 'agencies'],
        ['Pipeline CRM', Activity, 'crm'],
        ['Demandes d’accès', Mail, 'access'],
        ['Comptes en suppression', Trash2, 'deletions'],
      ],
    },
    {
      label: 'Revenus',
      items: [
        ['Abonnements', Crown, 'subscriptions'],
        ['Paiements', Banknote, 'payments'],
      ],
    },
    {
      label: 'Sécurité',
      items: [
        ['Utilisateurs', UserPlus, 'users'],
        ['Sessions', Laptop2, 'sessions'],
      ],
    },
    {
      label: 'Système',
      items: [
        ['Paramètres', ShieldAlert, 'settings'],
        ['Support', HelpIcon, 'support'],
      ],
    },
  ] as const;

  return (
    <aside className={mode === 'desktop' ? 'hidden w-[260px] shrink-0 lg:block' : 'h-full w-full'}>
      <div className={`${mode === 'desktop' ? 'sticky top-5 h-[calc(100vh-40px)] rounded-[28px]' : 'h-full rounded-r-[28px]'} flex flex-col overflow-hidden border border-white/10 bg-gradient-to-b from-carbon-950 via-black to-carbon-950 p-4 shadow-[0_24px_80px_rgba(0,0,0,.38)]`}>
        <div className="flex items-center gap-3 rounded-2xl border border-[#E3B117]/18 bg-white/[0.035] p-3">
          <img src="/mekloc-logo-transparent.png" alt="MekLoc" className="h-10 w-auto max-w-[116px] object-contain" />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#F5C542]">Super Admin</p>
          </div>
          {mode === 'mobile' ? (
            <button type="button" onClick={onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-carbon-300 hover:bg-white/[0.05] hover:text-white">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <nav className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-2 text-[10px] font-black uppercase tracking-[0.2em] text-carbon-600">{group.label}</p>
              <div className="grid gap-1">
                {group.items.map(([label, Icon, target]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      onSelectView(target);
                      onClose?.();
                    }}
                    className={`flex h-9 items-center gap-3 rounded-xl px-3 text-left text-[13px] font-semibold transition ${
                      activeView === target
                        ? 'bg-[#E3B117]/15 text-[#F5C542] shadow-[inset_3px_0_0_#E3B117]'
                        : 'text-carbon-300 hover:bg-white/[0.045] hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-3 pt-4">
          <div className="rounded-2xl border border-[#E3B117]/18 bg-[#E3B117]/8 p-4">
            <p className="text-[11px] font-bold text-carbon-400">Revenu mensuel estimé</p>
            <p className="mt-2 text-xl font-black text-white">{formatMAD(revenue)}</p>
            <p className="mt-1 text-xs font-semibold text-emerald-300">Suivi agence</p>
            <div className="mt-3 flex h-9 items-end gap-1">
              {[35, 46, 32, 58, 72, 54, 82].map((height, index) => (
                <span key={index} className="flex-1 rounded-t bg-gradient-to-t from-[#E3B117]/35 to-[#F5C542]" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#E3B117]/25 bg-[#E3B117]/12 text-sm font-black text-[#F5C542]">
              {profileName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SA'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">{profileName}</p>
              <p className="text-xs text-carbon-400">Super Admin</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return <Users className={className} />;
}

function HelpIcon({ className }: { className?: string }) {
  return <ShieldAlert className={className} />;
}


export default function SuperAdminPage() {
  const { profile, isSupabaseEnabled, signOut } = useAuth();
  const { notify } = useApp();
  const { startSupportMode, isSupportMode } = useSupportMode();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [accessRequests, setAccessRequests] = useState<AccessRequestRow[]>([]);
  const [allAccessRequests, setAllAccessRequests] = useState<AccessRequestRow[]>([]);
  const [agencies, setAgencies] = useState<AdminAgency[]>([]);
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});
  const [requestToDelete, setRequestToDelete] = useState<AccessRequestRow | null>(null);
  const [agencyToDelete, setAgencyToDelete] = useState<AdminAgency | null>(null);
  const [pendingUserToDelete, setPendingUserToDelete] = useState<AdminUserRow | null>(null);
  const [adminDeleteConfirmText, setAdminDeleteConfirmText] = useState('');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [activationLinkToCopy, setActivationLinkToCopy] = useState<{ email: string; link: string } | null>(null);
  const [agencyUsers, setAgencyUsers] = useState<Record<string, AdminUserRow[]>>({});
  const [agencySessions, setAgencySessions] = useState<Record<string, UserSessionRow[]>>({});
  const [supportLogsByAgency, setSupportLogsByAgency] = useState<Record<string, SupportLogRow[]>>({});
  const [crmActivityByAgency, setCrmActivityByAgency] = useState<Record<string, CrmActivity>>({});
  const [expandedSessionAgencyId, setExpandedSessionAgencyId] = useState<string | null>(null);
  const [expandedAdvancedAgencyId, setExpandedAdvancedAgencyId] = useState<string | null>(null);
  const [agencySearch, setAgencySearch] = useState('');
  const [agencyPlanFilter, setAgencyPlanFilter] = useState<'all' | 'starter' | 'pro' | 'business' | 'lifetime'>('all');
  const [agencyStatusFilter, setAgencyStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [agencyPaymentFilter, setAgencyPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [agencyDueFilter, setAgencyDueFilter] = useState<'all' | 'soon' | 'overdue' | 'deletion'>('all');
  const [agencySubscriptionFilter, setAgencySubscriptionFilter] = useState<'all' | SubscriptionStatus>('all');
  const [selectedAgencyDetails, setSelectedAgencyDetails] = useState<AdminAgency | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<SuperAdminView>('overview');
  const [showSessionHistoryAgencyId, setShowSessionHistoryAgencyId] = useState<string | null>(null);
  const [trialExtensionAgency, setTrialExtensionAgency] = useState<AdminAgency | null>(null);
  const [trialExtensionDays, setTrialExtensionDays] = useState<1 | 3 | 7>(7);
  const [paymentAgency, setPaymentAgency] = useState<AdminAgency | null>(null);
  const [paymentDuration, setPaymentDuration] = useState<1 | 3 | 6 | 12>(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [paymentNote, setPaymentNote] = useState('');
  const [supportAgency, setSupportAgency] = useState<AdminAgency | null>(null);
  const [supportReason, setSupportReason] = useState('');
  const [supportAccessMode, setSupportAccessMode] = useState<SupportAccessMode>('read_only');
  const [startingSupport, setStartingSupport] = useState(false);
  const [showSupportHistory, setShowSupportHistory] = useState(false);
  const [showAllSupportLogs, setShowAllSupportLogs] = useState(false);
  const [crmLeadToEdit, setCrmLeadToEdit] = useState<CrmLead | null>(null);
  const [crmDraft, setCrmDraft] = useState<CrmMetadata>({});
  const [sessionFilter, setSessionFilter] = useState<'all' | 'today' | 'ios' | 'desktop' | 'old'>('all');

  async function confirmSupportMode() {
    if (!supportAgency) return;
    try {
      setStartingSupport(true);
      await startSupportMode({
        agencyId: supportAgency.id,
        agencyName: supportAgency.agencyName,
        mode: supportAccessMode,
        reason: supportReason,
      });
      setSupportAgency(null);
      setSelectedAgencyDetails(null);
      setSupportReason('');
    } catch (error) {
      notify({
        title: 'Mode assistance impossible',
        message: error instanceof Error ? error.message : 'Veuillez réessayer.',
        type: 'warning',
      });
    } finally {
      setStartingSupport(false);
    }
  }

  const pendingDeletionAccounts = useMemo(() => {
    return Object.entries(agencyUsers).flatMap(([agencyId, users]) => {
      const agency = agencies.find((item) => item.id === agencyId);
      return users
        .filter((user) => user.account_status === 'pending_deletion')
        .map((user) => ({ user, agency }));
    });
  }, [agencies, agencyUsers]);

  const allAdminUsers = useMemo(() => Object.values(agencyUsers).flat(), [agencyUsers]);

  const allAdminSessions = useMemo(() => Object.values(agencySessions).flat(), [agencySessions]);
  const selectedAgencySupportLogs = useMemo(
    () => selectedAgencyDetails ? supportLogsByAgency[selectedAgencyDetails.id] || [] : [],
    [selectedAgencyDetails, supportLogsByAgency],
  );
  const filteredAdminSessions = useMemo(() => allAdminSessions.filter((session) => {
    if (sessionFilter === 'all') return true;
    const seenAt = session.last_seen_at || session.last_activity_at;
    const deviceText = `${session.device_type || ''} ${session.device_name || ''} ${session.os || ''}`.toLowerCase();
    if (sessionFilter === 'today') return Boolean(seenAt && Date.now() - new Date(seenAt).getTime() <= 86_400_000);
    if (sessionFilter === 'ios') return /ios|iphone|ipad/.test(deviceText);
    if (sessionFilter === 'desktop') return !/ios|iphone|ipad|android|mobile/.test(deviceText);
    return Boolean(seenAt && Date.now() - new Date(seenAt).getTime() > 30 * 86_400_000);
  }), [allAdminSessions, sessionFilter]);

  const crmLeads = useMemo<CrmLead[]>(() => {
    const agencyLeads = agencies.map((agency) => {
      const crm = agencyCrm(agency);
      const users = agencyUsers[agency.id] || [];
      const latestLogin = users
        .map((item) => item.last_login_at || item.last_seen_at)
        .filter(Boolean)
        .sort((left, right) => new Date(String(right)).getTime() - new Date(String(left)).getTime())[0] || agency.latestActivityAt;
      return {
        key: `agency-${agency.id}`,
        source: 'agency' as const,
        id: agency.id,
        agencyName: agency.agencyName,
        ownerName: agency.ownerName,
        email: agency.email,
        phone: '',
        subscriptionLabel: subscriptionLabel(effectiveAdminStatus(agency)),
        lastLoginAt: latestLogin || null,
        crm: {
          ...crm,
          pipeline_status: inferAgencyPipeline(agency),
          health_score: crm.health_score || (effectiveAdminStatus(agency) === 'active_paid' ? 'active' : effectiveAdminStatus(agency) === 'payment_pending' ? 'ready_to_pay' : 'follow_up'),
        },
        activity: crmActivityByAgency[agency.id] || {
          vehicles: agency.vehiclesCount,
          reservations: 0,
          contracts: 0,
          payments: 0,
          activeSessions: (agencySessions[agency.id] || []).filter((session) => !session.revoked_at).length,
        },
        agency,
      };
    });
    const requestLeads = allAccessRequests
      .filter((request) => request.status !== 'approved')
      .map((request) => ({
        key: `request-${request.id}`,
        source: 'request' as const,
        id: request.id,
        agencyName: request.agency_name,
        ownerName: request.owner_name,
        email: request.email,
        phone: `${request.phone_country_code || ''} ${request.phone_number || ''}`.trim(),
        subscriptionLabel: planLabel(request.selected_plan),
        lastLoginAt: null,
        crm: {
          ...readCrmMetadata(request.crm_metadata),
          pipeline_status: inferRequestPipeline(request),
          health_score: request.crm_metadata?.health_score || 'follow_up',
        },
        activity: { vehicles: request.vehicle_count || 0, reservations: 0, contracts: 0, payments: 0, activeSessions: 0 },
        request,
      }));
    return [...requestLeads, ...agencyLeads];
  }, [agencies, agencySessions, agencyUsers, allAccessRequests, crmActivityByAgency]);

  const crmDueToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return crmLeads.filter((lead) => {
      const status = lead.crm.pipeline_status;
      return Boolean(lead.crm.follow_up_date && lead.crm.follow_up_date <= today && status !== 'paid' && status !== 'lost');
    });
  }, [crmLeads]);

  const planStats = useMemo(() => {
    return (['starter', 'pro', 'business', 'lifetime'] as AgencyPlan[]).map((plan) => ({
      plan,
      agencies: agencies.filter((agency) => agency.plan === plan),
      revenue: agencies.filter((agency) => agency.plan === plan && agency.billingStatus === 'paid').reduce((sum, agency) => sum + agency.monthlyPrice, 0),
    }));
  }, [agencies]);

  const agencySummary = useMemo(() => {
    const closeDue = agencies.filter((agency) => {
      const state = dueState(agency.nextPaymentDueDate);
      return state.days !== null && state.days >= 0 && state.days <= 7;
    }).length;
    const watch = agencies.filter((agency) => agency.accountStatus === 'suspended' || agency.accountStatus === 'pending_deletion' || agency.billingStatus === 'overdue').length;
    return {
      active: agencies.filter((agency) => agency.accountStatus === 'active').length,
      trial: agencies.filter((agency) => agency.billingStatus === 'trial').length,
      paid: agencies.filter((agency) => agency.billingStatus === 'paid').length,
      unpaid: agencies.filter((agency) => agency.billingStatus === 'unpaid' || agency.billingStatus === 'overdue').length,
      revenue: agencies
        .filter((agency) => agency.accountStatus === 'active' && agency.billingStatus === 'paid')
        .reduce((sum, agency) => sum + agency.monthlyPrice, 0),
      closeDue,
      suspendedOrWatch: watch,
    };
  }, [agencies]);

  const adminAlerts = useMemo(() => {
    const alerts: Array<{ id: string; title: string; description: string; tone: 'danger' | 'warning' | 'gold'; agency?: AdminAgency }> = [];
    agencies.forEach((agency) => {
      const state = dueState(agency.nextPaymentDueDate);
      const subscriptionStatus = effectiveAdminStatus(agency);
      if (subscriptionStatus === 'trial_expired') {
        alerts.push({
          id: `trial-expired-${agency.id}`,
          title: `${agency.agencyName} · essai expiré`,
          description: agency.trialEndsAt ? `L’essai de 7 jours a expiré le ${new Date(agency.trialEndsAt).toLocaleDateString('fr-FR')}.` : 'L’essai gratuit est expiré.',
          tone: 'danger',
          agency,
        });
      } else if (subscriptionStatus === 'trial_active' && agency.trialEndsAt) {
        const trialState = dueState(agency.trialEndsAt);
        if (trialState.days === 3) {
          alerts.push({
            id: `trial-3d-${agency.id}`,
            title: `${agency.agencyName} · essai termine dans 3 jours`,
            description: 'Le rappel à 3 jours peut être envoyé depuis la fiche agence.',
            tone: 'gold',
            agency,
          });
        } else if (trialState.days === 0) {
          alerts.push({
            id: `trial-today-${agency.id}`,
            title: `${agency.agencyName} · essai termine aujourd’hui`,
            description: 'L’agence entrera ensuite dans la période de grâce de 24 heures.',
            tone: 'warning',
            agency,
          });
        } else if (trialState.days !== null && trialState.days > 0 && trialState.days <= 2) {
          alerts.push({
            id: `trial-soon-${agency.id}`,
            title: `${agency.agencyName} · fin d’essai proche`,
            description: `Essai gratuit ${trialState.label.toLowerCase()}.`,
            tone: 'warning',
            agency,
          });
        }
      } else if (agency.billingStatus === 'overdue') {
        alerts.push({
          id: `overdue-${agency.id}`,
          title: `${agency.agencyName} · paiement en retard`,
          description: agency.nextPaymentDueDate ? `Échéance dépassée depuis le ${agency.nextPaymentDueDate}.` : 'Paiement marqué en retard.',
          tone: 'danger',
          agency,
        });
      } else if (state.days !== null && state.days >= 0 && state.days <= 7) {
        alerts.push({
          id: `due-${agency.id}`,
          title: `${agency.agencyName} · échéance proche`,
          description: `Prochaine échéance ${state.label.toLowerCase()} (${agency.nextPaymentDueDate}).`,
          tone: 'warning',
          agency,
        });
      }
      if (subscriptionStatus === 'payment_pending') {
        alerts.push({
          id: `payment-pending-${agency.id}`,
          title: `${agency.agencyName} · paiement en attente`,
          description: 'L’abonnement doit être régularisé ou activé manuellement.',
          tone: 'warning',
          agency,
        });
      }
      if (agency.accountStatus === 'suspended' || subscriptionStatus === 'suspended') {
        alerts.push({
          id: `suspended-${agency.id}`,
          title: `${agency.agencyName} · compte suspendu`,
          description: 'Le compte agence est suspendu côté profils utilisateurs.',
          tone: 'danger',
          agency,
        });
      }
    });
    pendingDeletionAccounts.slice(0, 5).forEach(({ user, agency }) => {
      alerts.push({
        id: `deletion-${user.id}`,
        title: `${agency?.agencyName || 'Agence'} · suppression planifiée`,
        description: `Suppression prévue le ${formatSince(user.deletion_scheduled_at)}.`,
        tone: 'danger',
        agency,
      });
    });
    accessRequests.filter((request) => request.status === 'pending' || request.status === 'verified').slice(0, 5).forEach((request) => {
      alerts.push({
        id: `request-${request.id}`,
        title: `${request.agency_name} · demande à traiter`,
        description: `${request.owner_name} attend une validation (${planLabel(request.selected_plan)}).`,
        tone: 'gold',
      });
    });
    return alerts.slice(0, 8);
  }, [accessRequests, agencies, pendingDeletionAccounts]);

  const filteredAgencies = useMemo(() => {
    const q = agencySearch.trim().toLowerCase();
    return agencies.filter((agency) => {
      const searchMatch = !q || `${agency.agencyName} ${agency.ownerName} ${agency.email}`.toLowerCase().includes(q);
      const planMatch = agencyPlanFilter === 'all' || agency.plan === agencyPlanFilter;
      const statusMatch = agencyStatusFilter === 'all' || agency.accountStatus === agencyStatusFilter;
      const effectiveStatus = effectiveAdminStatus(agency);
      const paymentMatch =
        agencyPaymentFilter === 'all' ||
        (agencyPaymentFilter === 'paid' ? effectiveStatus === 'active_paid' : ['payment_pending', 'trial_expired'].includes(effectiveStatus));
      const subscriptionMatch = agencySubscriptionFilter === 'all' || effectiveStatus === agencySubscriptionFilter;
      const due = dueState(agency.nextPaymentDueDate);
      const dueMatch =
        agencyDueFilter === 'all' ||
        (agencyDueFilter === 'soon' && due.days !== null && due.days >= 0 && due.days <= 7) ||
        (agencyDueFilter === 'overdue' && (agency.billingStatus === 'overdue' || (due.days !== null && due.days < 0))) ||
        (agencyDueFilter === 'deletion' && agency.accountStatus === 'pending_deletion');
      return searchMatch && planMatch && statusMatch && paymentMatch && subscriptionMatch && dueMatch;
    });
  }, [agencies, agencyDueFilter, agencyPaymentFilter, agencyPlanFilter, agencySearch, agencyStatusFilter, agencySubscriptionFilter]);

  const loadAll = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) return;
    setLoading(true);
    try {
      const [reqRes, agencyRes, usersRes, vehicleRes] = await Promise.all([
        supabase.from('access_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('agencies').select('*'),
        supabase.from('users_profiles').select('id,agency_id,account_status,email,full_name,role,last_login_at,last_seen_at,deletion_requested_at,deletion_scheduled_at'),
        supabase.from('vehicles').select('agency_id'),
      ]);
      if (reqRes.error || agencyRes.error || usersRes.error || vehicleRes.error) throw reqRes.error || agencyRes.error || usersRes.error || vehicleRes.error;
      const allReqs = (reqRes.data || []) as AccessRequestRow[];
      const reqs = allReqs.filter((r) => r.status !== 'approved');
      const approvedReqs = allReqs.filter((r) => r.status === 'approved');
      setAllAccessRequests(allReqs);
      setAccessRequests(reqs);
      setRequestNotes(Object.fromEntries(reqs.map((r) => [r.id, r.admin_notes || ''])));

      const profiles = (usersRes.data || []) as Array<{ id: string; agency_id: string | null; account_status: AccountStatus; email: string | null; full_name?: string | null; role: string | null; last_login_at?: string | null; last_seen_at?: string | null }>;
      const vehicles = (vehicleRes.data || []) as Array<{ agency_id: string | null }>;
      const mapped = ((agencyRes.data || []) as Array<{ id: string; name: string; plan: AgencyPlan; billing_status: BillingStatus; subscription_status?: SubscriptionStatus | null; trial_started_at?: string | null; trial_ends_at?: string | null; paid_until?: string | null; last_payment_date?: string | null; payment_method?: PaymentMethod | null; payment_notes?: string | null; trial_reminder_3d_sent_at?: string | null; trial_reminder_1d_sent_at?: string | null; trial_expired_email_sent_at?: string | null; last_trial_extended_at?: string | null; next_payment_due_date: string | null; monthly_price: number | null; created_at?: string | null; settings?: Record<string, unknown> | null }>)
        .map((a) => {
          const ownerProfile = pickAgencyOwnerProfile(profiles, a.id);
          const agencyProfiles = profiles.filter((p) => p.agency_id === a.id);
          const latestActivityAt = agencyProfiles
            .flatMap((p) => [p.last_seen_at, p.last_login_at])
            .filter(Boolean)
            .sort((left, right) => new Date(String(right)).getTime() - new Date(String(left)).getTime())[0] || null;
          return {
            id: a.id,
            agencyName: a.name,
            ownerName: ownerProfile?.full_name || 'Responsable',
            email: ownerProfile?.email || approvedReqs.find((r) => r.agency_name === a.name)?.email || '—',
            plan: a.plan || 'starter',
            billingStatus: a.billing_status || 'trial',
            subscriptionStatus: a.subscription_status || (a.billing_status === 'paid' ? 'active_paid' : a.billing_status === 'trial' ? 'trial_active' : a.billing_status === 'cancelled' ? 'suspended' : 'payment_pending'),
            trialStartedAt: a.trial_started_at || null,
            trialEndsAt: a.trial_ends_at || null,
            paidUntil: a.paid_until || null,
            lastPaymentDate: a.last_payment_date || null,
            paymentMethod: a.payment_method || 'other',
            paymentNotes: a.payment_notes || '',
            trialReminder3dSentAt: a.trial_reminder_3d_sent_at || null,
            trialReminder1dSentAt: a.trial_reminder_1d_sent_at || null,
            trialExpiredEmailSentAt: a.trial_expired_email_sent_at || null,
            lastTrialExtendedAt: a.last_trial_extended_at || null,
            nextPaymentDueDate: a.next_payment_due_date,
            vehiclesCount: vehicles.filter((v) => v.agency_id === a.id).length,
            usersCount: profiles.filter((p) => p.agency_id === a.id).length,
            accountStatus: ownerProfile?.account_status || 'pending',
            monthlyPrice: Number(a.monthly_price || monthlyPriceByPlan[a.plan || 'starter']),
            createdAt: a.created_at || null,
            latestActivityAt,
            settings: a.settings || {},
          };
        });
      setAgencies(mapped);

      const byAgencyUsers: Record<string, AdminUserRow[]> = {};
      ((usersRes.data || []) as AdminUserRow[]).forEach((u) => {
        const agencyId = u.agency_id || '';
        if (!agencyId) return;
        if (!byAgencyUsers[agencyId]) byAgencyUsers[agencyId] = [];
        byAgencyUsers[agencyId].push(u);
      });
      Object.values(byAgencyUsers).forEach((list) => {
        list.sort((a, b) => {
          const rank = (role: string | null) => (normalizeAdminAgencyRole(role) === 'owner' ? 0 : normalizeAdminAgencyRole(role) === 'manager' ? 1 : 2);
          return rank(a.role) - rank(b.role) || String(a.full_name || a.email || '').localeCompare(String(b.full_name || b.email || ''));
        });
      });
      setAgencyUsers(byAgencyUsers);

      let loadedSessionsByAgency: Record<string, UserSessionRow[]> = {};
      try {
        const sessionRes = await supabase
          .from('user_sessions')
          .select('id,user_id,agency_id,device_id,session_key,device_name,device_label,device_type,browser,os,last_activity_at,last_seen_at,first_seen_at,revoked_at')
          .order('last_seen_at', { ascending: false });
        if (!sessionRes.error) {
          const byAgencySessions: Record<string, UserSessionRow[]> = {};
          ((sessionRes.data || []) as UserSessionRow[]).forEach((s) => {
            if (!byAgencySessions[s.agency_id]) byAgencySessions[s.agency_id] = [];
            byAgencySessions[s.agency_id].push(s);
          });
          loadedSessionsByAgency = byAgencySessions;
          setAgencySessions(byAgencySessions);
        } else {
          setAgencySessions({});
        }
      } catch {
        setAgencySessions({});
      }

      try {
        const supportRes = await supabase
          .from('support_sessions')
          .select('id,agency_id,super_admin_user_id,reason,mode,started_at,ended_at,expires_at,status')
          .order('started_at', { ascending: false });
        if (supportRes.error) throw supportRes.error;

        const profileById = new Map(profiles.map((item) => [item.id, item]));
        const byAgencySupport: Record<string, SupportLogRow[]> = {};
        ((supportRes.data || []) as Omit<SupportLogRow, 'adminName' | 'adminEmail'>[]).forEach((log) => {
          const admin = profileById.get(log.super_admin_user_id);
          const mappedLog: SupportLogRow = {
            ...log,
            adminName: admin?.full_name || 'Super Admin',
            adminEmail: admin?.email || 'Email indisponible',
          };
          if (!byAgencySupport[log.agency_id]) byAgencySupport[log.agency_id] = [];
          byAgencySupport[log.agency_id].push(mappedLog);
        });
        setSupportLogsByAgency(byAgencySupport);
      } catch {
        setSupportLogsByAgency({});
      }

      try {
        const [reservationsRes, contractsRes, paymentsRes] = await Promise.all([
          supabase.from('reservations').select('agency_id'),
          supabase.from('contracts').select('agency_id'),
          supabase.from('payments').select('agency_id'),
        ]);
        if (reservationsRes.error || contractsRes.error || paymentsRes.error) {
          throw reservationsRes.error || contractsRes.error || paymentsRes.error;
        }
        const countByAgency = (rows: Array<{ agency_id: string | null }>) => rows.reduce<Record<string, number>>((result, row) => {
          if (row.agency_id) result[row.agency_id] = (result[row.agency_id] || 0) + 1;
          return result;
        }, {});
        const reservationsByAgency = countByAgency((reservationsRes.data || []) as Array<{ agency_id: string | null }>);
        const contractsByAgency = countByAgency((contractsRes.data || []) as Array<{ agency_id: string | null }>);
        const paymentsByAgency = countByAgency((paymentsRes.data || []) as Array<{ agency_id: string | null }>);
        const activity: Record<string, CrmActivity> = {};
        mapped.forEach((agency) => {
          activity[agency.id] = {
            vehicles: agency.vehiclesCount,
            reservations: reservationsByAgency[agency.id] || 0,
            contracts: contractsByAgency[agency.id] || 0,
            payments: paymentsByAgency[agency.id] || 0,
            activeSessions: (loadedSessionsByAgency[agency.id] || []).filter((session) => !session.revoked_at).length,
          };
        });
        setCrmActivityByAgency(activity);
      } catch {
        setCrmActivityByAgency({});
      }
    } catch (error) {
      notify({ title: 'Erreur chargement', message: error instanceof Error ? error.message : 'Réessayez.', type: 'warning' });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function runAction(key: string, action: () => Promise<void>) {
    setActionLoading((curr) => ({ ...curr, [key]: true }));
    try {
      await action();
    } catch (error) {
      notify({
        title: 'Action impossible',
        message: error instanceof Error ? error.message : 'Veuillez réessayer.',
        type: 'warning',
      });
    } finally {
      setActionLoading((curr) => ({ ...curr, [key]: false }));
    }
  }

  function openCrmEditor(lead: CrmLead) {
    setCrmLeadToEdit(lead);
    setCrmDraft({
      pipeline_status: lead.crm.pipeline_status,
      follow_up_date: lead.crm.follow_up_date || '',
      internal_notes: lead.crm.internal_notes || '',
      health_score: lead.crm.health_score || 'follow_up',
      last_contact_at: lead.crm.last_contact_at || null,
    });
  }

  async function saveCrmMetadata() {
    if (!crmLeadToEdit || !supabase) return;
    const metadata: CrmMetadata = {
      pipeline_status: crmDraft.pipeline_status || 'new',
      follow_up_date: crmDraft.follow_up_date || null,
      internal_notes: String(crmDraft.internal_notes || '').trim(),
      health_score: crmDraft.health_score || 'follow_up',
      last_contact_at: new Date().toISOString(),
    };

    if (crmLeadToEdit.source === 'agency' && crmLeadToEdit.agency) {
      const currentSettings = crmLeadToEdit.agency.settings || {};
      const { error } = await supabase
        .from('agencies')
        .update({ settings: { ...currentSettings, crm: metadata } })
        .eq('id', crmLeadToEdit.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('access_requests')
        .update({ crm_metadata: metadata })
        .eq('id', crmLeadToEdit.id);
      if (error) {
        if (/crm_metadata|schema cache/i.test(error.message)) {
          throw new Error('Appliquez la migration super_admin_crm_metadata_safe.sql dans Supabase.');
        }
        throw error;
      }
    }

    notify({ title: 'Suivi CRM enregistré', message: crmLeadToEdit.agencyName, type: 'success' });
    setCrmLeadToEdit(null);
    await loadAll();
  }

  async function getFreshAccessToken() {
    if (!supabase) return null;
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) return refreshed.session.access_token;
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  }

  async function fetchWithAdminAuth(webhook: string, body: unknown) {
    if (!supabase) throw new Error('Supabase indisponible.');
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    let token = await getFreshAccessToken();
    if (!token) throw new Error('Session admin introuvable. Reconnectez-vous puis réessayez.');

    const doFetch = (accessToken: string) =>
      fetch(webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
        },
        body: JSON.stringify(body),
      });

    let response = await doFetch(token);
    if (response.status === 401 || response.status === 403) {
      token = await getFreshAccessToken();
      if (!token) throw new Error('Session expirée. Reconnectez-vous puis réessayez.');
      response = await doFetch(token);
    }
    return response;
  }

  async function updateRequest(id: string, patch: Partial<AccessRequestRow>, toast: string) {
    if (!supabase || !isSupabaseConfigured) return;
    const { error } = await supabase.from('access_requests').update(patch).eq('id', id);
    if (error) throw error;
    setAccessRequests((curr) => curr.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    notify({ title: toast, type: 'success' });
  }

  async function approveRequest(request: AccessRequestRow) {
    if (!supabase || !isSupabaseConfigured) return;
    const webhook = import.meta.env.VITE_APPROVE_ACCESS_REQUEST_WEBHOOK as string | undefined;
    if (!webhook) throw new Error('Webhook approbation manquant. Configurez VITE_APPROVE_ACCESS_REQUEST_WEBHOOK.');
    const response = await fetchWithAdminAuth(webhook, {
      accessRequestId: request.id,
      redirectTo: `${window.location.origin}/set-password`,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Approbation impossible');
    if (payload?.activationLink) {
      await supabase.from('access_requests').update({ activation_link: payload.activationLink }).eq('id', request.id);
    }
    if (payload?.emailSent === false || payload?.inviteInfo === 'email_failed') {
      notify({
        title: "Demande approuvée",
        message: "Compte approuvé, mais l’email d’activation n’a pas pu être envoyé.",
        type: 'warning',
      });
    } else {
      notify({ title: "Demande approuvée", message: "Compte approuvé. Email d’activation envoyé au client.", type: 'success' });
    }
    await loadAll();
  }

  async function resendActivationEmail(request: AccessRequestRow) {
    if (!supabase || !isSupabaseConfigured) return;
    if (request.status !== 'approved') {
      notify({ title: 'Demande non approuvée', message: 'Approuvez la demande avant de renvoyer l’email d’activation.', type: 'warning' });
      return;
    }
    const { data, error } = await supabase.functions.invoke('resend-activation-email', {
      body: {
        accessRequestId: request.id,
        redirectTo: window.location.origin,
      },
    });
    const payload = data as { success?: boolean; activationLink?: string; error?: string } | null;
    if (error || !payload?.success) {
      throw new Error(payload?.error || error?.message || "Email d’activation non envoyé.");
    }
    if (payload.activationLink) {
      await supabase.from('access_requests').update({ activation_link: payload.activationLink }).eq('id', request.id);
    }
    notify({ title: 'Email envoyé', message: `Email d’activation renvoyé à ${request.email}.`, type: 'success' });
    await loadAll();
  }

  async function resendAgencyActivationEmail(agency: AdminAgency) {
    if (!supabase || !isSupabaseConfigured) return;
    if (!agency.email || agency.email === '—') throw new Error('Email agence introuvable.');
    const { data, error } = await supabase.functions.invoke('resend-activation-email', {
      body: {
        agencyId: agency.id,
        email: agency.email,
        redirectTo: window.location.origin,
      },
    });
    const payload = data as { success?: boolean; error?: string } | null;
    if (error || !payload?.success) {
      throw new Error(payload?.error || error?.message || "Impossible de renvoyer l’email d’activation.");
    }
    notify({ title: 'Email envoyé', message: "Email d’activation renvoyé avec succès.", type: 'success' });
    await loadAll();
  }

  async function deleteRequest() {
    if (!requestToDelete || !supabase) return;
    const webhook = import.meta.env.VITE_DELETE_ACCESS_REQUEST_WEBHOOK as string | undefined;
    if (!webhook) throw new Error('Webhook suppression demande manquant. Configurez VITE_DELETE_ACCESS_REQUEST_WEBHOOK.');
    const archivedPayload = {
      original_request_id: requestToDelete.id,
      agency_name: requestToDelete.agency_name,
      owner_name: requestToDelete.owner_name,
      email: requestToDelete.email,
      phone_country_code: requestToDelete.phone_country_code,
      phone_number: requestToDelete.phone_number,
      country: requestToDelete.country,
      city: requestToDelete.city,
      selected_plan: requestToDelete.selected_plan,
      billing_type: requestToDelete.billing_type,
      vehicle_count: requestToDelete.vehicle_count,
      status: requestToDelete.status,
      admin_notes: requestToDelete.admin_notes,
      deleted_by: profile?.id ?? null,
      deleted_reason: 'Suppression depuis Super Admin',
    };
    await supabase.from('deleted_access_requests').insert(archivedPayload);
    const response = await fetchWithAdminAuth(webhook, { requestId: requestToDelete.id });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Suppression demande impossible: ${text}`);
    }
    setAccessRequests((curr) => curr.filter((r) => r.id !== requestToDelete.id));
    setRequestToDelete(null);
    notify({ title: 'Demande supprimée', type: 'success' });
  }

  async function changeAgencyPlan(agency: AdminAgency, plan: AgencyPlan) {
    if (!supabase) return;
    const { error } = await supabase.from('agencies').update({ plan, monthly_price: monthlyPriceByPlan[plan] }).eq('id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function markBilling(agency: AdminAgency, status: BillingStatus) {
    if (!supabase) return;
    const subscriptionStatus: SubscriptionStatus = status === 'paid' ? 'active_paid' : status === 'cancelled' ? 'suspended' : 'payment_pending';
    const { error } = await supabase.from('agencies').update({ billing_status: status, subscription_status: subscriptionStatus }).eq('id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function extendSubscription(agency: AdminAgency, days: number) {
    if (!supabase) return;
    const { error } = await supabase.from('agencies').update({ next_payment_due_date: addDays(agency.nextPaymentDueDate, days) }).eq('id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function activateTrial(agency: AdminAgency) {
    if (!supabase) return;
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + 7 * 86_400_000);
    const { error } = await supabase.from('agencies').update({
      subscription_status: 'trial_active',
      billing_status: 'trial',
      trial_started_at: startedAt.toISOString(),
      trial_ends_at: endsAt.toISOString(),
      subscription_start_date: startedAt.toISOString().slice(0, 10),
      subscription_end_date: endsAt.toISOString().slice(0, 10),
      paid_until: null,
    }).eq('id', agency.id);
    if (error) throw error;
    await sendTrialEmail(agency, 'trial_started');
    await loadAll();
  }

  async function extendTrial(agency: AdminAgency, days = 7) {
    if (!supabase) return;
    const base = agency.trialEndsAt && new Date(agency.trialEndsAt).getTime() > Date.now() ? new Date(agency.trialEndsAt) : new Date();
    base.setDate(base.getDate() + days);
    const { error } = await supabase.from('agencies').update({
      subscription_status: 'trial_active',
      billing_status: 'trial',
      trial_ends_at: base.toISOString(),
      subscription_end_date: base.toISOString().slice(0, 10),
      last_trial_extended_at: new Date().toISOString(),
      payment_notes: agency.paymentNotes
        ? `${agency.paymentNotes}\nTrial extended by admin (+${days} day${days > 1 ? 's' : ''})`
        : `Trial extended by admin (+${days} day${days > 1 ? 's' : ''})`,
    }).eq('id', agency.id);
    if (error) throw error;
    await loadAll();
    setTrialExtensionAgency(null);
    setSelectedAgencyDetails(null);
    notify({ title: 'Essai prolongé', message: `${agency.agencyName} · +${days} jour${days > 1 ? 's' : ''}`, type: 'success' });
  }

  async function activatePaidSubscription(agency: AdminAgency, months: 1 | 3 | 6 | 12, method: PaymentMethod, notes: string) {
    if (!supabase) return;
    const paidUntil = new Date();
    paidUntil.setMonth(paidUntil.getMonth() + months);
    const { error } = await supabase.from('agencies').update({
      subscription_status: 'active_paid',
      billing_status: 'paid',
      paid_until: paidUntil.toISOString(),
      subscription_end_date: paidUntil.toISOString().slice(0, 10),
      next_payment_due_date: paidUntil.toISOString().slice(0, 10),
      last_payment_date: new Date().toISOString().slice(0, 10),
      payment_method: method,
      payment_notes: notes,
    }).eq('id', agency.id);
    if (error) throw error;
    await sendTrialEmail(agency, 'payment_confirmed');
    await loadAll();
    setPaymentAgency(null);
    setSelectedAgencyDetails(null);
    notify({ title: 'Abonnement activé', message: `${agency.agencyName} · ${months} mois`, type: 'success' });
  }

  async function sendTrialEmail(agency: AdminAgency, type: 'trial_started' | 'trial_reminder_3d' | 'trial_reminder_1d' | 'trial_expired' | 'payment_confirmed') {
    if (!supabase) return;
    const { data, error } = await supabase.functions.invoke('send-subscription-notification', {
      body: { agencyId: agency.id, type },
    });
    if (error || !data?.sent) {
      notify({
        title: 'Abonnement mis à jour, email non envoyé',
        message: data?.error || error?.message || 'Vérifiez RESEND_API_KEY et RESEND_FROM_EMAIL.',
        type: 'warning',
      });
      return;
    }
    notify({ title: 'Email envoyé', message: agency.email, type: 'success' });
  }

  async function suspendAgency(agency: AdminAgency) {
    if (!supabase) return;
    const { error: agencyError } = await supabase.from('agencies').update({ subscription_status: 'suspended', billing_status: 'cancelled' }).eq('id', agency.id);
    if (agencyError) throw agencyError;
    const { error } = await supabase.from('users_profiles').update({ account_status: 'suspended' }).eq('agency_id', agency.id);
    if (error) throw error;
    await loadAll();
  }

  async function deleteAgency(agency: AdminAgency) {
    if (!supabase) return;
    const { data: linkedProfiles } = await supabase.from('users_profiles').select('id,email,role,agency_id').eq('agency_id', agency.id);
    const ownerProfile = pickAgencyOwnerProfile((linkedProfiles || []) as Array<{ id: string; email: string | null; role: string | null; agency_id: string | null }>, agency.id);
    if (!ownerProfile?.id) throw new Error('Profil propriétaire introuvable pour cette agence.');
    const now = new Date();
    const scheduledAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nowIso = now.toISOString();
    const { error } = await supabase
      .from('users_profiles')
      .update({
        account_status: 'pending_deletion',
        deletion_requested_at: nowIso,
        deletion_scheduled_at: scheduledAt.toISOString(),
        force_logout_at: nowIso,
      })
      .eq('agency_id', agency.id);
    if (error) {
      if (/account_status|deletion_requested_at|deletion_scheduled_at|schema cache/i.test(error.message)) {
        throw new Error('Suppression différée non prête: appliquez la migration account_deletion_grace_safe.sql dans Supabase.');
      }
      throw error;
    }

    const sessionsUpdate = await supabase
      .from('user_sessions')
      .update({ revoked_at: nowIso })
      .eq('agency_id', agency.id)
      .is('revoked_at', null);
    if (sessionsUpdate.error && !/relation .*user_sessions.* does not exist/i.test(sessionsUpdate.error.message)) {
      throw sessionsUpdate.error;
    }

    notify({
      title: 'Suppression programmée',
      message: 'Le compte est désactivé maintenant et visible dans les comptes en cours de suppression.',
      type: 'success',
    });
    await loadAll();
  }

  async function generateActivationLinkForEmail(email: string) {
    if (!supabase) return;
    const webhook = import.meta.env.VITE_GENERATE_ACTIVATION_LINK_WEBHOOK as string | undefined;
    if (!webhook) throw new Error('Webhook génération lien manquant. Configurez VITE_GENERATE_ACTIVATION_LINK_WEBHOOK.');
    const normalized = email.trim().toLowerCase();
    if (!normalized || normalized === '—') throw new Error('Email client introuvable.');
    const response = await fetchWithAdminAuth(webhook, {
      email: normalized,
      redirectTo: `${window.location.origin}/set-password`,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Génération du lien impossible');
    if (payload?.activationLink) {
      setActivationLinkToCopy({ email: normalized, link: payload.activationLink });
      try {
        await navigator.clipboard.writeText(payload.activationLink);
        notify({ title: 'Lien copié', message: 'Lien d’activation copié. Envoyez-le au client via WhatsApp ou Gmail.', type: 'success' });
      } catch {
        notify({
          title: 'Lien généré',
          message: 'Safari a bloqué la copie automatique. Copiez le lien affiché manuellement.',
          type: 'warning',
        });
      }
      return;
    }
    if (payload?.inviteSent) {
      notify({ title: 'Invitation envoyée', message: "Le client a reçu un email d’activation.", type: 'success' });
      return;
    }
    notify({ title: 'Action effectuée', message: 'Activation traitée avec succès.', type: 'success' });
  }

  function formatSince(value: string | null | undefined) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-MA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function formatActivityTime(value: string | null | undefined) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'À l’instant';
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffHours < 48) return 'Hier';
    return date.toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function sessionDisplayLabel(session: UserSessionRow) {
    const browser = session.browser || 'Navigateur';
    const os = session.os || 'Système';
    const device = session.device_type || session.device_name || 'Appareil';
    return [device, browser, os]
      .map((part) => String(part).replace(/\s*•\s*/g, ' ').trim())
      .filter((part, index, parts) => part && parts.findIndex((item) => item.toLowerCase() === part.toLowerCase()) === index)
      .join(' · ');
  }

  function daysRemaining(value: string | null | undefined) {
    if (!value) return '—';
    const target = new Date(value).getTime();
    if (Number.isNaN(target)) return '—';
    return `${Math.max(0, Math.ceil((target - Date.now()) / 86400000))} jour(s)`;
  }

  async function cancelPendingDeletion(user: AdminUserRow) {
    if (!supabase) return;
    const { error } = await supabase
      .from('users_profiles')
      .update({
        account_status: 'active',
        deletion_requested_at: null,
        deletion_scheduled_at: null,
        force_logout_at: null,
      })
      .eq('id', user.id);
    if (error) throw error;
    notify({ title: 'Suppression annulée', message: 'Le compte est de nouveau actif.', type: 'success' });
    await loadAll();
  }

  async function deletePendingAccountNow(user: AdminUserRow) {
    if (!supabase) return;
    if (adminDeleteConfirmText !== 'SUPPRIMER') throw new Error('Tapez SUPPRIMER pour confirmer.');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const webhook = (import.meta.env.VITE_DELETE_PENDING_ACCOUNT_WEBHOOK as string | undefined) || (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/delete-pending-account` : '');
    if (!webhook) throw new Error('Endpoint suppression compte manquant.');
    const response = await fetchWithAdminAuth(webhook, { userId: user.id });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || 'Suppression définitive impossible.');
    notify({ title: 'Compte supprimé définitivement', type: 'success' });
    setAdminDeleteConfirmText('');
    await loadAll();
  }

  function activityLabel(lastSeenAt: string | null, revokedAt: string | null) {
    if (revokedAt) return 'Déconnecté';
    if (!lastSeenAt) return 'Inactif';
    const diffMs = Date.now() - new Date(lastSeenAt).getTime();
    if (diffMs <= 2 * 60 * 1000) return 'À l’instant';
    return formatActivityTime(lastSeenAt);
  }

  async function revokeSingleSession(sessionId: string) {
    if (!supabase) return;
    const { error } = await supabase
      .from('user_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', sessionId)
      .is('revoked_at', null);
    if (error) throw error;
    notify({ title: 'Appareil déconnecté', type: 'success' });
    await loadAll();
  }

  async function revokeUserSessions(agencyId: string, userId: string) {
    if (!supabase) return;
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('user_sessions')
      .update({ revoked_at: nowIso })
      .eq('agency_id', agencyId)
      .eq('user_id', userId)
      .is('revoked_at', null);
    if (error && !/relation .*user_sessions.* does not exist/i.test(error.message)) throw error;
    const profileUpdate = await supabase
      .from('users_profiles')
      .update({ force_logout_at: nowIso })
      .eq('id', userId);
    if (profileUpdate.error) {
      if (/force_logout_at|schema cache/i.test(profileUpdate.error.message)) {
        throw new Error('Session management non prêt: appliquez la migration user_sessions_management_safe.sql dans Supabase.');
      }
      throw profileUpdate.error;
    }
    notify({ title: 'Utilisateur déconnecté', message: 'Toutes ses sessions actives ont été fermées.', type: 'success' });
    await loadAll();
  }

  async function revokeAgencySessions(agency: AdminAgency) {
    if (!supabase) return;
    if (!window.confirm('Voulez-vous vraiment déconnecter tous les utilisateurs de cette agence ?')) return;
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('user_sessions')
      .update({ revoked_at: nowIso })
      .eq('agency_id', agency.id)
      .is('revoked_at', null);
    if (error && !/relation .*user_sessions.* does not exist/i.test(error.message)) throw error;
    const profileUpdate = await supabase
      .from('users_profiles')
      .update({ force_logout_at: nowIso })
      .eq('agency_id', agency.id);
    if (profileUpdate.error) {
      if (/force_logout_at|schema cache/i.test(profileUpdate.error.message)) {
        throw new Error('Session management non prêt: appliquez la migration user_sessions_management_safe.sql dans Supabase.');
      }
      throw profileUpdate.error;
    }
    notify({ title: 'Agence déconnectée', message: 'Tous les appareils actifs ont été déconnectés.', type: 'success' });
    await loadAll();
  }

  if (!isSupabaseEnabled || !profile?.isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const viewMeta: Record<SuperAdminView, { eyebrow: string; title: string; description: string }> = {
    overview: { eyebrow: 'Super Admin', title: 'Gestion des agences', description: 'Gérez toutes les agences, abonnements, paiements et accès.' },
    crm: { eyebrow: 'CRM', title: 'Pipeline commercial', description: 'Suivez les leads, essais et relances sans modifier le fonctionnement des agences.' },
    agencies: { eyebrow: 'Agences', title: 'Comptes agences', description: 'Suivez les agences approuvées, leurs accès et leurs actions.' },
    subscriptions: { eyebrow: 'Abonnements', title: 'Plans et abonnements', description: 'Gérez les plans, limites, tarifs et abonnements des agences.' },
    payments: { eyebrow: 'Paiements', title: 'Paiements agences', description: 'Suivez les paiements des agences et abonnements.' },
    users: { eyebrow: 'Utilisateurs', title: 'Utilisateurs agences', description: 'Gérez les utilisateurs des agences.' },
    sessions: { eyebrow: 'Sessions', title: 'Connexions actives', description: 'Surveillez les connexions actives des utilisateurs.' },
    access: { eyebrow: 'Demandes d’accès', title: 'Nouvelles agences', description: 'Validez les nouvelles agences qui demandent l’accès à MekLoc.' },
    deletions: { eyebrow: 'Comptes en suppression', title: 'Période de grâce', description: 'Suivez les comptes avant suppression définitive.' },
    alerts: { eyebrow: 'Alertes', title: 'Alertes importantes', description: 'Suivez les anomalies importantes de la plateforme.' },
    reports: { eyebrow: 'Rapports', title: 'Performance plateforme', description: 'Analysez les performances de la plateforme.' },
    settings: { eyebrow: 'Paramètres', title: 'Paramètres Super Admin', description: 'Configuration disponible pour l’espace Super Admin.' },
    support: { eyebrow: 'Support', title: 'Support plateforme', description: 'Outils de support disponibles pour l’administration.' },
  };
  const currentView = viewMeta[activeView];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(227,177,23,.08),transparent_28%),linear-gradient(135deg,#050606,#090a0b_45%,#030303)] px-3 py-4 text-white sm:px-4 lg:px-5">
      <style>{`
        @keyframes superAdminViewIn {
          from { opacity: 0; transform: translate3d(0, 14px, 0) scale(.992); filter: blur(4px); }
          to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: blur(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-super-admin-view] { animation: none !important; }
        }
      `}</style>
      <div className="mx-auto flex max-w-[1760px] gap-5">
        <SuperAdminSidebar revenue={agencySummary.revenue} profileName={profile.fullName || 'Younes Mekki'} activeView={activeView} onSelectView={setActiveView} />
        <main className="min-w-0 flex-1 pb-10">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="mb-4 inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E3B117]/25 bg-[#E3B117]/12 px-4 text-sm font-black text-[#F5C542] shadow-[0_12px_35px_rgba(0,0,0,.22)] lg:hidden"
        >
          <Menu className="h-4 w-4" />
          Menu Super Admin
        </button>
        <PageHeader
          eyebrow={currentView.eyebrow}
          title={currentView.title}
          description={currentView.description}
          action={<div className="flex gap-2"><Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={loading} onClick={loadAll}>Actualiser</Button><Button variant="secondary" onClick={async () => { await signOut(); navigate('/auth'); }}>Déconnexion</Button></div>}
        />

        <div key={activeView} data-super-admin-view className="motion-safe:animate-[superAdminViewIn_.28s_ease-out]">
        {activeView === 'overview' ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <MiniMetric label="Agences actives" value={String(agencySummary.active)} icon={Users} tone="green" />
          <MiniMetric label="En essai" value={String(agencySummary.trial)} icon={CalendarClock} tone="blue" />
          <MiniMetric label="Payés" value={String(agencySummary.paid)} icon={CheckCircle2} tone="green" />
          <MiniMetric label="Revenu estimé" value={formatMAD(agencySummary.revenue)} icon={Banknote} tone="gold" />
          <MiniMetric label="Échéances proches" value={String(agencySummary.closeDue)} icon={AlertTriangle} tone="gold" />
          <MiniMetric label="À surveiller" value={String(agencySummary.suspendedOrWatch)} icon={Activity} tone="red" />
        </div>
        ) : null}

        {(activeView === 'overview' || activeView === 'alerts') ? (
        <Card className="mt-5 overflow-hidden border-[#E3B117]/18">
          <div className="flex flex-col gap-2 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Alertes admin</p>
              <h2 className="mt-1 text-xl font-black text-white">À surveiller</h2>
            </div>
            <Badge>{adminAlerts.length} alerte(s)</Badge>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
            {adminAlerts.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-carbon-400 md:col-span-2 xl:col-span-4">Aucune alerte prioritaire avec les données disponibles.</div>
            ) : adminAlerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => alert.agency ? setSelectedAgencyDetails(alert.agency) : undefined}
                className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                  alert.tone === 'danger'
                    ? 'border-rose-300/20 bg-rose-400/10 hover:border-rose-300/35'
                    : alert.tone === 'warning'
                      ? 'border-amber-300/20 bg-amber-400/10 hover:border-amber-300/35'
                      : 'border-[#E3B117]/20 bg-[#E3B117]/10 hover:border-[#E3B117]/35'
                }`}
              >
                <span className={`mb-3 inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                  alert.tone === 'danger' ? 'bg-rose-300/15 text-rose-200' : alert.tone === 'warning' ? 'bg-amber-300/15 text-amber-200' : 'bg-sky-300/15 text-sky-200'
                }`}>
                  {alert.tone === 'danger' ? 'Critical' : alert.tone === 'warning' ? 'Warning' : 'Info'}
                </span>
                <p className="text-sm font-black text-white">{alert.title}</p>
                <p className="mt-2 text-xs leading-5 text-carbon-300">{alert.description}</p>
                {alert.agency ? <span className="mt-3 inline-flex text-xs font-black text-white">Voir agence →</span> : null}
              </button>
            ))}
          </div>
        </Card>
        ) : null}

        {activeView === 'overview' ? (
          <>
            <Card className="mt-5 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5C542]">Actions rapides</p>
                <h2 className="mt-1 text-lg font-black text-white">Accès direct aux tâches prioritaires</h2>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <Button variant="secondary" icon={<Mail className="h-4 w-4" />} onClick={() => setActiveView('access')}>Voir demandes d’accès</Button>
                <Button variant="secondary" icon={<Banknote className="h-4 w-4" />} onClick={() => setActiveView('payments')}>Voir paiements</Button>
                <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => { setAgencySubscriptionFilter('trial_active'); setActiveView('agencies'); }}>Voir essais proches</Button>
                <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />} onClick={() => { setAgencyDueFilter('overdue'); setActiveView('agencies'); }}>Comptes à surveiller</Button>
              </div>
            </Card>

            <Card className="mt-5 overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 p-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5C542]">Agences à traiter</p>
                  <h2 className="mt-1 text-lg font-black text-white">Priorités opérationnelles</h2>
                </div>
                <Button variant="ghost" className="h-9" onClick={() => setActiveView('agencies')}>Toutes les agences</Button>
              </div>
              <div className="divide-y divide-white/10">
                {agencies.filter((agency) => {
                  const status = effectiveAdminStatus(agency);
                  const due = dueState(agency.nextPaymentDueDate);
                  return status === 'trial_expired' || status === 'payment_pending' || status === 'suspended' || due.tone === 'danger' || due.tone === 'warning';
                }).slice(0, 6).map((agency) => (
                  <div key={`urgent-${agency.id}`} className="grid gap-3 px-5 py-3.5 transition hover:bg-white/[0.025] sm:grid-cols-[minmax(0,1.5fr)_auto_auto_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">{agency.agencyName}</p>
                      <p className="truncate text-xs text-carbon-400">{agency.email}</p>
                    </div>
                    <StatusPill className={subscriptionTone(effectiveAdminStatus(agency))}>{subscriptionLabel(effectiveAdminStatus(agency))}</StatusPill>
                    <p className="text-sm font-semibold text-carbon-300">{dueState(agency.nextPaymentDueDate).label}</p>
                    <Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => setSelectedAgencyDetails(agency)}>Voir agence</Button>
                  </div>
                ))}
                {agencies.filter((agency) => {
                  const status = effectiveAdminStatus(agency);
                  const due = dueState(agency.nextPaymentDueDate);
                  return status === 'trial_expired' || status === 'payment_pending' || status === 'suspended' || due.tone === 'danger' || due.tone === 'warning';
                }).length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
                    <p className="mt-3 font-bold text-white">Aucune agence urgente</p>
                    <p className="mt-1 text-sm text-carbon-400">Les comptes prioritaires apparaîtront ici.</p>
                  </div>
                ) : null}
              </div>
            </Card>
          </>
        ) : null}

        {activationLinkToCopy ? (
          <Card className="mt-4 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">Lien d’activation généré</p>
                <p className="mt-1 text-xs text-carbon-400">{activationLinkToCopy.email}</p>
                <input className="form-control mt-3" value={activationLinkToCopy.link} readOnly />
              </div>
              <Button
                variant="secondary"
                className="h-10"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(activationLinkToCopy.link);
                    notify({ title: 'Lien copié', type: 'success' });
                  } catch {
                    notify({ title: 'Copie bloquée', message: 'Sélectionnez le lien et copiez-le manuellement.', type: 'warning' });
                  }
                }}
              >
                Copier
              </Button>
            </div>
          </Card>
        ) : null}

        {activeView === 'crm' ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <MiniMetric label="Nouveaux leads" value={String(crmLeads.filter((lead) => lead.crm.pipeline_status === 'new').length)} icon={UserPlus} tone="gold" />
              <MiniMetric label="À relancer aujourd’hui" value={String(crmDueToday.length)} icon={CalendarClock} tone="red" />
              <MiniMetric label="Essais actifs" value={String(crmLeads.filter((lead) => lead.crm.pipeline_status === 'trial_active').length)} icon={Play} tone="blue" />
              <MiniMetric label="Prêts à payer" value={String(crmLeads.filter((lead) => lead.crm.pipeline_status === 'ready_to_pay').length)} icon={Banknote} tone="gold" />
              <MiniMetric label="Payés" value={String(crmLeads.filter((lead) => lead.crm.pipeline_status === 'paid').length)} icon={CheckCircle2} tone="green" />
              <MiniMetric label="Risque de perte" value={String(crmLeads.filter((lead) => lead.crm.health_score === 'risk').length)} icon={AlertTriangle} tone="red" />
            </div>

            <Card className="overflow-hidden border-amber-300/15">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5C542]">Relances prioritaires</p>
                  <h2 className="mt-1 text-lg font-black text-white">Agences à relancer aujourd’hui</h2>
                </div>
                <Badge>{crmDueToday.length}</Badge>
              </div>
              <div className="divide-y divide-white/10">
                {crmDueToday.length === 0 ? (
                  <p className="p-5 text-sm text-carbon-400">Aucune relance arrivée à échéance aujourd’hui.</p>
                ) : crmDueToday.slice(0, 8).map((lead) => (
                  <div key={`due-${lead.key}`} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <button type="button" className="min-w-0 text-left" onClick={() => lead.agency ? setSelectedAgencyDetails(lead.agency) : openCrmEditor(lead)}>
                      <p className="truncate font-black text-white">{lead.agencyName}</p>
                      <p className="truncate text-xs text-carbon-400">{lead.ownerName} · {lead.email}</p>
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill className="border-amber-300/30 bg-amber-400/15 text-amber-200">{lead.crm.follow_up_date || 'Aujourd’hui'}</StatusPill>
                      <Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => openCrmEditor(lead)}>Mettre à jour</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-white/10 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5C542]">Pipeline</p>
                <h2 className="mt-1 text-lg font-black text-white">Suivi commercial MekLoc</h2>
                <p className="mt-1 text-sm text-carbon-400">Faites défiler horizontalement pour consulter toutes les étapes.</p>
              </div>
              <div className="overflow-x-auto p-4">
                <div className="grid min-w-[2700px] grid-cols-9 gap-3">
                  {pipelineStages.map((stage) => {
                    const stageLeads = crmLeads.filter((lead) => lead.crm.pipeline_status === stage.value);
                    return (
                      <section key={stage.value} className="min-w-0 rounded-2xl border border-white/10 bg-carbon-950/50">
                        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-3">
                          <p className="text-sm font-black text-white">{stage.label}</p>
                          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-[#E3B117]/15 px-2 text-xs font-black text-[#F5C542]">{stageLeads.length}</span>
                        </div>
                        <div className="max-h-[680px] space-y-2 overflow-y-auto p-2">
                          {stageLeads.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs text-carbon-500">Aucun lead</p>
                          ) : stageLeads.map((lead) => (
                            <article key={lead.key} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-[#E3B117]/30 hover:bg-white/[0.06]">
                              <div className="flex items-start justify-between gap-2">
                                <button type="button" className="min-w-0 text-left" onClick={() => lead.agency ? setSelectedAgencyDetails(lead.agency) : openCrmEditor(lead)}>
                                  <p className="truncate text-sm font-black text-white">{lead.agencyName}</p>
                                  <p className="mt-0.5 truncate text-xs text-carbon-400">{lead.ownerName}</p>
                                </button>
                                <details className="group relative shrink-0">
                                  <summary aria-label="Actions CRM" className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-lg border border-white/10 text-carbon-300 hover:bg-white/10 hover:text-white">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </summary>
                                  <div className="absolute right-0 z-30 mt-1 grid w-44 gap-1 rounded-xl border border-white/10 bg-carbon-950 p-2 shadow-xl">
                                    <Button variant="secondary" className="h-8 px-2 text-xs" onClick={() => openCrmEditor(lead)}>Modifier CRM</Button>
                                    {lead.agency ? <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setSelectedAgencyDetails(lead.agency!)}>Voir agence</Button> : null}
                                  </div>
                                </details>
                              </div>
                              <p className="mt-2 truncate text-xs text-carbon-300">{lead.email}</p>
                              {lead.phone ? <p className="mt-1 truncate text-xs text-carbon-400">{lead.phone}</p> : null}
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                <StatusPill className="border-[#E3B117]/25 bg-[#E3B117]/10 text-[#F5C542]">{healthLabels[lead.crm.health_score || 'follow_up']}</StatusPill>
                                <StatusPill className="border-white/10 bg-white/[0.04] text-carbon-200">{lead.subscriptionLabel}</StatusPill>
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-1 text-[10px] text-carbon-400">
                                <span>Relance: <strong className="text-carbon-200">{lead.crm.follow_up_date || '—'}</strong></span>
                                <span>Connexion: <strong className="text-carbon-200">{formatActivityTime(lead.lastLoginAt)}</strong></span>
                                <span>Sessions: <strong className="text-white">{lead.activity.activeSessions}</strong></span>
                                <span>Véhicules: <strong className="text-white">{lead.activity.vehicles}</strong></span>
                                <span>Réserv.: <strong className="text-white">{lead.activity.reservations}</strong></span>
                                <span>Contrats: <strong className="text-white">{lead.activity.contracts}</strong></span>
                                <span>Paiements: <strong className="text-white">{lead.activity.payments}</strong></span>
                              </div>
                              {lead.crm.internal_notes ? <p className="mt-3 line-clamp-2 rounded-lg bg-black/20 px-2 py-1.5 text-xs leading-5 text-carbon-300">{lead.crm.internal_notes}</p> : null}
                            </article>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {activeView === 'access' ? (
        <Card className="mt-4 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Demandes d’accès</p>
            <h2 className="mt-1 text-xl font-bold">Nouvelles agences</h2>
            <p className="mt-1 text-sm text-carbon-400">Validez les nouvelles agences qui demandent l’accès à MekLoc.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <MiniMetric label="En attente" value={String(allAccessRequests.filter((r) => r.status === 'pending' || r.status === 'pending_verification').length)} icon={Mail} tone="gold" />
            <MiniMetric label="Approuvées" value={String(allAccessRequests.filter((r) => r.status === 'approved').length)} icon={CheckCircle2} tone="green" />
            <MiniMetric label="Refusées" value={String(allAccessRequests.filter((r) => r.status === 'rejected').length)} icon={XCircle} tone="red" />
            <MiniMetric label="Cette semaine" value={String(allAccessRequests.filter((r) => Date.now() - new Date(r.created_at).getTime() <= 7 * 86400000).length)} icon={CalendarClock} tone="blue" />
          </div>
          <div className="grid gap-4 p-5">
            {accessRequests.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                <Mail className="mx-auto h-9 w-9 text-[#F5C542]" />
                <p className="mt-4 text-lg font-black text-white">Aucune demande en attente</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-carbon-400">Les nouvelles demandes d’accès apparaîtront ici dès leur réception.</p>
                <Button variant="secondary" className="mt-5" icon={<RefreshCw className="h-4 w-4" />} loading={loading} onClick={loadAll}>Actualiser</Button>
              </div>
            ) : accessRequests.map((req) => (
              <div key={req.id} className="premium-surface rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-white">{req.agency_name}</p><Badge>{req.status}</Badge></div>
                <div className="mt-2 grid gap-2 text-sm text-carbon-300 md:grid-cols-3">
                  <p><strong>Agence:</strong> {req.agency_name}</p><p><strong>Responsable:</strong> {req.owner_name}</p><p><strong>Email:</strong> {req.email}</p>
                  <p><strong>Téléphone:</strong> {req.phone_country_code} {req.phone_number}</p><p><strong>Pays:</strong> {req.country}</p><p><strong>Ville:</strong> {req.city}</p>
                  <p><strong>Plan demandé:</strong> {planLabel(req.selected_plan)}</p><p><strong>Facturation:</strong> {req.billing_type === 'lifetime' ? 'Lifetime' : req.billing_type === 'annual' ? 'Annuel' : 'Mensuel'}</p><p><strong>Nombre de véhicules:</strong> {req.vehicle_count}</p>
                  <p>
                    <strong>Date de demande:</strong>{' '}
                    {new Date(req.created_at).toLocaleString('fr-MA', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" className="h-8 px-2.5 text-xs" loading={Boolean(actionLoading[`req-contact-${req.id}`])} onClick={() => runAction(`req-contact-${req.id}`, async () => updateRequest(req.id, { status: 'contacted' }, 'Marquée contactée'))}>Marquer contactée</Button>
                  <Button variant="secondary" className="h-8 px-2.5 text-xs" loading={Boolean(actionLoading[`req-payment-${req.id}`])} onClick={() => runAction(`req-payment-${req.id}`, async () => updateRequest(req.id, { status: 'payment_pending' }, 'Paiement en attente'))}>Paiement en attente</Button>
                  <Button className="h-8 px-2.5 text-xs" icon={<CheckCircle2 className="h-3.5 w-3.5" />} loading={Boolean(actionLoading[`req-approve-${req.id}`])} onClick={() => runAction(`req-approve-${req.id}`, async () => approveRequest(req))}>Approuver</Button>
                  <Button variant="danger" className="h-8 px-2.5 text-xs" icon={<XCircle className="h-3.5 w-3.5" />} loading={Boolean(actionLoading[`req-reject-${req.id}`])} onClick={() => runAction(`req-reject-${req.id}`, async () => updateRequest(req.id, { status: 'rejected' }, 'Demande rejetée'))}>Rejeter</Button>
                  <Button variant="secondary" className="h-8 px-2.5 text-xs" icon={<UserPlus className="h-3.5 w-3.5" />} loading={Boolean(actionLoading[`req-create-${req.id}`])} onClick={() => runAction(`req-create-${req.id}`, async () => {
                    if (!req.activation_link) return notify({ title: 'Lien indisponible', message: "Aucun lien d’activation enregistré.", type: 'warning' });
                    setActivationLinkToCopy({ email: req.email, link: req.activation_link });
                    try {
                      await navigator.clipboard.writeText(req.activation_link);
                      notify({ title: 'Lien copié', message: 'Lien d’activation copié dans le presse-papiers.', type: 'success' });
                    } catch {
                      notify({ title: 'Lien affiché', message: 'Safari a bloqué la copie automatique. Copiez le lien affiché manuellement.', type: 'warning' });
                    }
                  })}>Créer compte client</Button>
                  {req.status === 'approved' ? (
                    <Button variant="secondary" className="h-8 px-2.5 text-xs" icon={<Mail className="h-3.5 w-3.5" />} loading={Boolean(actionLoading[`req-resend-${req.id}`])} onClick={() => runAction(`req-resend-${req.id}`, async () => resendActivationEmail(req))}>Renvoyer l’email d’activation</Button>
                  ) : null}
                  <Button variant="danger" className="h-8 px-2.5 text-xs" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => { setAdminDeleteConfirmText(''); setRequestToDelete(req); }}>Supprimer la demande</Button>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                  <textarea className="form-control min-h-16" value={requestNotes[req.id] || ''} onChange={(e) => setRequestNotes((c) => ({ ...c, [req.id]: e.target.value }))} placeholder="Notes admin..." />
                  <Button variant="secondary" className="h-10" icon={<FileText className="h-4 w-4" />} loading={Boolean(actionLoading[`req-note-${req.id}`])} onClick={() => runAction(`req-note-${req.id}`, async () => updateRequest(req.id, { admin_notes: requestNotes[req.id] || '' }, 'Note enregistrée'))}>Enregistrer note admin</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        ) : null}

        {activeView === 'deletions' ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Comptes en suppression</p>
            <h2 className="mt-1 text-xl font-bold">Période de grâce</h2>
            <p className="mt-1 text-sm text-carbon-400">Période de grâce de 30 jours avant suppression définitive.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <MiniMetric label="En suppression" value={String(pendingDeletionAccounts.length)} icon={Trash2} tone="red" />
            <MiniMetric label="Suppression proche" value={String(pendingDeletionAccounts.filter(({ user }) => {
              const target = new Date(user.deletion_scheduled_at || '').getTime();
              return Number.isFinite(target) && target - Date.now() <= 7 * 86400000;
            }).length)} icon={AlertTriangle} tone="red" />
            <MiniMetric label="Restaurables" value={String(pendingDeletionAccounts.length)} icon={RefreshCw} tone="gold" />
            <MiniMetric label="Agences liées" value={String(new Set(pendingDeletionAccounts.map(({ agency }) => agency?.id).filter(Boolean)).size)} icon={Users} tone="blue" />
          </div>
          <div className="grid gap-3 p-5">
            {pendingDeletionAccounts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-300" />
                <p className="mt-4 text-lg font-black text-white">Aucun compte en suppression</p>
                <p className="mt-2 text-sm text-carbon-400">Aucune suppression définitive n’est actuellement planifiée.</p>
              </div>
            ) : pendingDeletionAccounts.map(({ user, agency }) => (
              <div key={user.id} className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{agency?.agencyName || 'Agence inconnue'}</p>
                    <p className="mt-1 text-sm text-carbon-300">{user.email || 'Email non renseigné'}</p>
                  </div>
                  <div className="grid gap-2 text-xs text-carbon-300 sm:grid-cols-3 lg:min-w-[520px]">
                    <p><strong>Demandé le:</strong> {formatSince(user.deletion_requested_at)}</p>
                    <p><strong>Prévu le:</strong> {formatSince(user.deletion_scheduled_at)}</p>
                    <p><strong>Restant:</strong> {daysRemaining(user.deletion_scheduled_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="h-8 px-3 text-xs"
                      loading={Boolean(actionLoading[`cancel-deletion-${user.id}`])}
                      onClick={() => runAction(`cancel-deletion-${user.id}`, async () => cancelPendingDeletion(user))}
                    >
                      Annuler suppression
                    </Button>
                    <Button
                      variant="danger"
                      className="h-8 px-3 text-xs"
                      loading={Boolean(actionLoading[`delete-pending-${user.id}`])}
                      onClick={() => {
                        setAdminDeleteConfirmText('');
                        setPendingUserToDelete(user);
                      }}
                    >
                      Supprimer maintenant
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        ) : null}

        {activeView === 'agencies' ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Comptes agences approuvés</h2>
            <p className="mt-1 text-sm text-carbon-400">Suivi des agences, paiements, accès et sessions.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 lg:grid-cols-[minmax(0,1fr)_repeat(6,auto)]">
            <label className="relative block min-w-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-500" />
              <input
                className="form-control pl-11"
                value={agencySearch}
                onChange={(e) => setAgencySearch(e.target.value)}
                placeholder="Rechercher agence, propriétaire ou email"
              />
            </label>
            <select className="form-control min-w-36" value={agencyPlanFilter} onChange={(e) => setAgencyPlanFilter(e.target.value as typeof agencyPlanFilter)}>
              <option value="all">Tous les plans</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
              <option value="lifetime">Lifetime</option>
            </select>
            <select className="form-control min-w-36" value={agencyStatusFilter} onChange={(e) => setAgencyStatusFilter(e.target.value as typeof agencyStatusFilter)}>
              <option value="all">Tous statuts</option>
              <option value="active">Actif</option>
              <option value="suspended">Suspendu</option>
            </select>
            <select className="form-control min-w-36" value={agencyPaymentFilter} onChange={(e) => setAgencyPaymentFilter(e.target.value as typeof agencyPaymentFilter)}>
              <option value="all">Tous paiements</option>
              <option value="paid">Payé</option>
              <option value="unpaid">Non payé</option>
            </select>
            <select className="form-control min-w-44" value={agencySubscriptionFilter} onChange={(e) => setAgencySubscriptionFilter(e.target.value as typeof agencySubscriptionFilter)}>
              <option value="all">Tous abonnements</option>
              <option value="trial_active">Essai actif</option>
              <option value="trial_expired">Essai expiré</option>
              <option value="active_paid">Abonnement actif</option>
              <option value="payment_pending">Paiement en attente</option>
              <option value="suspended">Suspendu</option>
            </select>
            <select className="form-control min-w-40" value={agencyDueFilter} onChange={(e) => setAgencyDueFilter(e.target.value as typeof agencyDueFilter)}>
              <option value="all">Toutes échéances</option>
              <option value="soon">Échéance proche</option>
              <option value="overdue">En retard</option>
              <option value="deletion">Suppression</option>
            </select>
            <Button
              variant="ghost"
              className="h-12 whitespace-nowrap"
              onClick={() => {
                setAgencySearch('');
                setAgencyPlanFilter('all');
                setAgencyStatusFilter('all');
                setAgencyPaymentFilter('all');
                setAgencySubscriptionFilter('all');
                setAgencyDueFilter('all');
              }}
            >
              Réinitialiser
            </Button>
          </div>
          <div className="divide-y divide-white/10">
            {filteredAgencies.length === 0 ? <p className="text-sm text-carbon-400">Aucun compte agence ne correspond aux filtres.</p> : filteredAgencies.map((agency) => (
              <div key={agency.id} className="px-4 py-4 transition hover:bg-white/[0.025] sm:px-5">
                <div className="grid gap-4 xl:grid-cols-[minmax(220px,1.4fr)_minmax(300px,1.5fr)_minmax(360px,2fr)_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-black text-white">{agency.agencyName}</p>
                    </div>
                    <p className="mt-1 truncate text-sm text-carbon-400">{agency.email}</p>
                    <p className="mt-1 truncate text-xs text-carbon-500">{agency.ownerName}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill className={statusPillClass('plan', agency.plan)}>{planLabel(agency.plan)}</StatusPill>
                    <StatusPill className={subscriptionTone(effectiveAdminStatus(agency))}>{subscriptionLabel(effectiveAdminStatus(agency))}</StatusPill>
                  </div>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-xs sm:grid-cols-3">
                    <p><span className="block text-carbon-500">Échéance / essai</span><strong className="text-carbon-200">{agency.trialEndsAt && effectiveAdminStatus(agency) === 'trial_active' ? dueState(agency.trialEndsAt).label : dueState(agency.nextPaymentDueDate).label}</strong></p>
                    <p><span className="block text-carbon-500">Flotte</span><strong className="text-white">{agency.vehiclesCount} véhicules</strong></p>
                    <p><span className="block text-carbon-500">Équipe</span><strong className="text-white">{agency.usersCount} utilisateurs</strong></p>
                    <p><span className="block text-carbon-500">Prix</span><strong className="text-white">{formatMAD(agency.monthlyPrice)}</strong></p>
                    <p className="sm:col-span-2"><span className="block text-carbon-500">Dernière activité</span><strong className="text-carbon-200">{formatActivityTime(agency.latestActivityAt)}</strong></p>
                  </div>
                  <div className="flex items-center gap-2 xl:justify-end">
                    <Button className="h-10 whitespace-nowrap px-3 text-xs" icon={<Eye className="h-4 w-4" />} onClick={() => setSelectedAgencyDetails(agency)}>Voir détails</Button>
                    <details className="group relative">
                      <summary className="focus-ring flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-bold text-carbon-200 transition hover:bg-white/[0.07]">
                        Actions <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                      </summary>
                      <div className="absolute right-0 z-30 mt-2 grid w-[min(82vw,280px)] gap-1 rounded-2xl border border-white/10 bg-carbon-950 p-2 shadow-[0_24px_70px_rgba(0,0,0,.55)]">
                      <Button variant="secondary" icon={<Crown className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-plan-${agency.id}`])} onClick={() => runAction(`agency-plan-${agency.id}`, async () => changeAgencyPlan(agency, agency.plan === 'starter' ? 'pro' : agency.plan === 'pro' ? 'business' : agency.plan === 'business' ? 'lifetime' : 'starter'))}>Changer plan</Button>
                      <Button variant="secondary" icon={<Play className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-trial-${agency.id}`])} onClick={() => runAction(`agency-trial-${agency.id}`, async () => activateTrial(agency))}>Activer essai 7 j</Button>
                      <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => { setTrialExtensionDays(7); setTrialExtensionAgency(agency); }}>Prolonger essai</Button>
                      <Button variant="secondary" icon={<Banknote className="h-4 w-4" />} onClick={() => { setPaymentDuration(1); setPaymentMethod(agency.paymentMethod || 'bank_transfer'); setPaymentNote(agency.paymentNotes); setPaymentAgency(agency); }}>Marquer comme payé</Button>
                      <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-unpaid-${agency.id}`])} onClick={() => runAction(`agency-unpaid-${agency.id}`, async () => markBilling(agency, 'unpaid'))}>Non payé</Button>
                      <Button variant="secondary" icon={<Mail className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-resend-${agency.id}`])} onClick={() => runAction(`agency-resend-${agency.id}`, async () => resendAgencyActivationEmail(agency))}>Renvoyer email</Button>
                      <Button variant="secondary" icon={<Clock3 className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-reminder-${agency.id}`])} onClick={() => runAction(`agency-reminder-${agency.id}`, async () => sendTrialEmail(agency, effectiveAdminStatus(agency) === 'trial_expired' ? 'trial_expired' : (dueState(agency.trialEndsAt).days ?? 3) <= 1 ? 'trial_reminder_1d' : 'trial_reminder_3d'))}>Rappel essai</Button>
                      <Button variant="secondary" icon={<Headphones className="h-4 w-4" />} onClick={() => { setSupportAgency(agency); setSupportReason(''); setSupportAccessMode('read_only'); }}>Mode assistance</Button>
                      <Button variant="ghost" icon={<ChevronDown className={`h-4 w-4 transition ${expandedAdvancedAgencyId === agency.id ? 'rotate-180' : ''}`} />} onClick={() => setExpandedAdvancedAgencyId((current) => (current === agency.id ? null : agency.id))}>Actions avancées</Button>
                      </div>
                    </details>
                  </div>
                </div>

                {expandedAdvancedAgencyId === agency.id ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-carbon-950/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-carbon-500">Actions avancées</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" icon={<UserPlus className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-link-${agency.id}`])} onClick={() => runAction(`agency-link-${agency.id}`, async () => generateActivationLinkForEmail(agency.email))}>Générer lien d’activation</Button>
                      <Button variant="secondary" icon={<ShieldAlert className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-suspend-${agency.id}`])} onClick={() => runAction(`agency-suspend-${agency.id}`, async () => suspendAgency(agency))}>Suspendre compte</Button>
                    </div>
                    <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 p-3">
                      <p className="text-sm font-semibold text-rose-100">Zone dangereuse</p>
                      <p className="mt-1 text-xs text-rose-100/70">La suppression désactive le compte maintenant et programme la suppression définitive après 30 jours.</p>
                      <Button className="mt-3" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => { setAdminDeleteConfirmText(''); setAgencyToDelete(agency); }}>Supprimer le compte</Button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 rounded-xl border border-white/10 bg-carbon-900/40 p-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left"
                    onClick={() => setExpandedSessionAgencyId((current) => (current === agency.id ? null : agency.id))}
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                      <Users className="h-4 w-4 text-gold-200" />
                      Utilisateurs & sessions
                    </span>
                    <ChevronDown className={`h-4 w-4 text-carbon-300 transition ${expandedSessionAgencyId === agency.id ? 'rotate-180' : ''}`} />
                  </button>

                  {expandedSessionAgencyId === agency.id ? (
                    <div className="mt-3 space-y-3">
                      {(() => {
                        const users = agencyUsers[agency.id] || [];
                        const sessions = agencySessions[agency.id] || [];
                        const activeSessions = sessions.filter((s) => !s.revoked_at);
                        const showHistory = showSessionHistoryAgencyId === agency.id;
                        const lastAgencyActivity = activeSessions[0]?.last_activity_at || activeSessions[0]?.last_seen_at || null;
                        return (
                          <>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                              <div className="rounded-lg border border-white/10 bg-carbon-950/60 px-3 py-2 text-xs text-carbon-300">Total utilisateurs <span className="ml-1 font-semibold text-white">{users.length}</span></div>
                              <div className="rounded-lg border border-white/10 bg-carbon-950/60 px-3 py-2 text-xs text-carbon-300">Utilisateurs actifs <span className="ml-1 font-semibold text-white">{users.filter((u) => u.account_status === 'active').length}</span></div>
                              <div className="rounded-lg border border-white/10 bg-carbon-950/60 px-3 py-2 text-xs text-carbon-300">Appareils connectés <span className="ml-1 font-semibold text-white">{activeSessions.length}</span></div>
                              <div className="rounded-lg border border-white/10 bg-carbon-950/60 px-3 py-2 text-xs text-carbon-300">Dernière activité agence <span className="ml-1 font-semibold text-white">{formatActivityTime(lastAgencyActivity)}</span></div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                className="h-8 px-3 text-xs"
                                loading={Boolean(actionLoading[`agency-revoke-all-${agency.id}`])}
                                onClick={() => runAction(`agency-revoke-all-${agency.id}`, async () => revokeAgencySessions(agency))}
                              >
                                Déconnecter toute l’agence
                              </Button>
                              <Button
                                variant="ghost"
                                className="h-8 px-3 text-xs"
                                onClick={() => setShowSessionHistoryAgencyId((current) => (current === agency.id ? null : agency.id))}
                              >
                                {showHistory ? 'Masquer l’historique' : 'Afficher l’historique'}
                              </Button>
                            </div>

                            {users.length === 0 ? (
                              <p className="text-xs text-carbon-400">Aucun utilisateur lié à cette agence.</p>
                            ) : (
                              <div className="space-y-2">
                                {users.map((u) => {
                                  const userSessions = sessions.filter((s) => s.user_id === u.id);
                                  const activeUserSessions = userSessions.filter((s) => !s.revoked_at);
                                  const displayedSessions = showHistory ? userSessions : activeUserSessions;
                                  const activeCount = activeUserSessions.length;
                                  const sessionLastSeen = activeUserSessions.find((s) => !!s.last_activity_at || !!s.last_seen_at)?.last_activity_at || activeUserSessions.find((s) => !!s.last_seen_at)?.last_seen_at || null;
                                  const sessionFirstSeen = userSessions.find((s) => !!s.first_seen_at)?.first_seen_at || null;
                                  const lastLogin = u.last_login_at || sessionFirstSeen || null;
                                  const lastSeen = u.last_seen_at || sessionLastSeen || null;
                                  return (
                                    <div key={u.id} className="rounded-lg border border-white/10 bg-carbon-950/50 p-3">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-semibold text-white">{u.full_name || 'Utilisateur'}</p>
                                          <p className="text-xs text-carbon-300">{u.email || '—'} · {u.role || '—'} · {u.account_status}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          <Badge>{activeCount} appareil(s)</Badge>
                                          <Button
                                            variant="secondary"
                                            className="h-7 px-2.5 text-xs"
                                            loading={Boolean(actionLoading[`user-revoke-${u.id}`])}
                                            onClick={() => runAction(`user-revoke-${u.id}`, async () => revokeUserSessions(agency.id, u.id))}
                                          >
                                            Déconnecter utilisateur
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="mt-2 grid gap-1 text-xs text-carbon-300 sm:grid-cols-2">
                                        <p><strong>Dernière connexion:</strong> {formatActivityTime(lastLogin)}</p>
                                        <p><strong>Dernière activité:</strong> {formatActivityTime(lastSeen)}</p>
                                      </div>

                                      <div className="mt-2 space-y-1.5">
                                        {displayedSessions.length === 0 ? (
                                          <p className="text-xs text-carbon-500">{showHistory ? 'Aucune session enregistrée' : 'Aucun appareil actif'}</p>
                                        ) : displayedSessions.map((s) => (
                                          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-carbon-900/60 px-2.5 py-2">
                                            <div className="flex items-center gap-2 text-xs text-carbon-200">
                                              {/iphone|android|ipad/i.test(`${s.os || ''} ${s.device_name || ''}`) ? (
                                                <Smartphone className="h-3.5 w-3.5 text-gold-200" />
                                              ) : (
                                                <Laptop2 className="h-3.5 w-3.5 text-gold-200" />
                                              )}
                                              <span>{sessionDisplayLabel(s)}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                              <Badge>{activityLabel(s.last_seen_at, s.revoked_at)}</Badge>
                                              {!s.revoked_at ? (
                                                <Button
                                                  variant="secondary"
                                                  className="h-7 px-2 text-[11px]"
                                                  loading={Boolean(actionLoading[`session-revoke-${s.id}`])}
                                                  onClick={() => runAction(`session-revoke-${s.id}`, async () => revokeSingleSession(s.id))}
                                                >
                                                  Déconnecter cet appareil
                                                </Button>
                                              ) : null}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
        ) : null}

        {activeView === 'subscriptions' ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Abonnements</p>
            <h2 className="mt-1 text-xl font-bold">Plans et abonnements agences</h2>
            <p className="mt-1 text-sm text-carbon-400">Gérez les plans, limites, tarifs et abonnements des agences.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 xl:grid-cols-7">
            <MiniMetric label="Plans actifs" value="4" icon={Crown} tone="gold" />
            <MiniMetric label="Starter" value={String(agencies.filter((a) => a.plan === 'starter').length)} icon={Users} tone="blue" />
            <MiniMetric label="Pro" value={String(agencies.filter((a) => a.plan === 'pro').length)} icon={ShieldAlert} tone="gold" />
            <MiniMetric label="Business" value={String(agencies.filter((a) => a.plan === 'business').length)} icon={Activity} tone="green" />
            <MiniMetric label="Lifetime" value={String(agencies.filter((a) => a.plan === 'lifetime').length)} icon={CheckCircle2} tone="green" />
            <MiniMetric label="Revenus" value={formatMAD(agencySummary.revenue)} icon={Banknote} tone="gold" />
            <MiniMetric label="Échéances" value={String(agencySummary.closeDue)} icon={CalendarClock} tone="red" />
          </div>
          <div className="grid gap-4 p-5 lg:grid-cols-2 xl:grid-cols-4">
            {planStats.map(({ plan, agencies: planAgencies, revenue }) => (
              <div key={plan} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-white">{planLabel(plan)}</p>
                    <p className="mt-1 text-sm text-carbon-400">{formatMAD(monthlyPriceByPlan[plan])}{plan === 'lifetime' ? ' · paiement unique' : ' / mois'}</p>
                  </div>
                  <StatusPill className={statusPillClass('plan', plan)}>Actif</StatusPill>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-carbon-300">
                  <p>Agences utilisant ce plan: <strong className="text-white">{planAgencies.length}</strong></p>
                  <p>Revenu estimé: <strong className="text-white">{formatMAD(revenue)}</strong></p>
                  <p>Limites: <strong className="text-white">{plan === 'starter' ? '15 véhicules' : plan === 'pro' ? '50 véhicules' : 'Illimité / avancé'}</strong></p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10">
            <div className="hidden grid-cols-[1.1fr_1fr_1fr_1fr_1.2fr_auto] gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-carbon-500 md:grid">
              <span>Plan</span><span>Prix</span><span>Agences</span><span>Revenu estimé</span><span>Limite véhicules</span><span>Statut</span>
            </div>
            <div className="divide-y divide-white/10">
              {planStats.map(({ plan, agencies: planAgencies, revenue }) => (
                <div key={`plan-row-${plan}`} className="grid gap-3 px-5 py-3.5 md:grid-cols-[1.1fr_1fr_1fr_1fr_1.2fr_auto] md:items-center">
                  <p className="font-black text-white">{planLabel(plan)}</p>
                  <p className="text-sm text-carbon-300">{formatMAD(monthlyPriceByPlan[plan])}{plan === 'lifetime' ? '' : '/mois'}</p>
                  <p className="text-sm font-bold text-white">{planAgencies.length}</p>
                  <p className="text-sm font-bold text-white">{formatMAD(revenue)}</p>
                  <p className="text-sm text-carbon-300">{plan === 'starter' ? '15 véhicules' : plan === 'pro' ? '50 véhicules' : 'Illimité / avancé'}</p>
                  <StatusPill className={statusPillClass('plan', plan)}>Actif</StatusPill>
                </div>
              ))}
            </div>
          </div>
        </Card>
        ) : null}

        {activeView === 'payments' ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Paiements</p>
            <h2 className="mt-1 text-xl font-bold">Suivi des paiements agences</h2>
            <p className="mt-1 text-sm text-carbon-400">Suivez les paiements des agences et abonnements.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MiniMetric label="Total encaissé" value={formatMAD(agencySummary.revenue)} icon={Banknote} tone="green" />
            <MiniMetric label="En retard" value={String(agencies.filter((a) => a.billingStatus === 'overdue').length)} icon={AlertTriangle} tone="red" />
            <MiniMetric label="Payés" value={String(agencySummary.paid)} icon={CheckCircle2} tone="green" />
            <MiniMetric label="Revenu prévu" value={formatMAD(agencies.reduce((sum, a) => sum + a.monthlyPrice, 0))} icon={Activity} tone="gold" />
            <MiniMetric label="Non payés" value={String(agencySummary.unpaid)} icon={ShieldAlert} tone="red" />
            <MiniMetric label="Essais" value={String(agencySummary.trial)} icon={CalendarClock} tone="blue" />
          </div>
          <div className="divide-y divide-white/10">
            {filteredAgencies.map((agency) => (
              <div key={`pay-${agency.id}`} className="grid gap-3 px-5 py-4 transition hover:bg-white/[0.025] lg:grid-cols-[minmax(180px,1.4fr)_repeat(5,minmax(90px,1fr))_auto] lg:items-center">
                  <div className="min-w-0">
                    <p className="font-black text-white">{agency.agencyName}</p>
                    <p className="mt-1 truncate text-xs text-carbon-400">{agency.email}</p>
                  </div>
                  <p className="text-sm text-carbon-300"><span className="block text-[10px] uppercase text-carbon-500 lg:hidden">Plan</span>{planLabel(agency.plan)}</p>
                  <p className="font-bold text-white"><span className="block text-[10px] font-normal uppercase text-carbon-500 lg:hidden">Montant</span>{formatMAD(agency.monthlyPrice)}</p>
                  <p className="text-sm text-carbon-300"><span className="block text-[10px] uppercase text-carbon-500 lg:hidden">Échéance</span>{agency.nextPaymentDueDate || '—'}</p>
                  <StatusPill className={statusPillClass('billing', agency.billingStatus)}>{billingLabel(agency.billingStatus)}</StatusPill>
                  <p className="text-sm text-carbon-300"><span className="block text-[10px] uppercase text-carbon-500 lg:hidden">Méthode</span>{agency.paymentMethod || '—'}</p>
                  <Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => setSelectedAgencyDetails(agency)}>Voir agence</Button>
                  <details className="group relative">
                    <summary className="focus-ring flex h-9 cursor-pointer list-none items-center justify-center gap-1 rounded-xl border border-white/10 px-3 text-xs font-bold text-carbon-200">Actions <ChevronDown className="h-3.5 w-3.5 group-open:rotate-180" /></summary>
                    <div className="absolute right-0 z-20 mt-2 grid w-56 gap-1 rounded-2xl border border-white/10 bg-carbon-950 p-2 shadow-2xl">
                      <Button variant="secondary" onClick={() => { setPaymentDuration(1); setPaymentMethod(agency.paymentMethod || 'bank_transfer'); setPaymentNote(agency.paymentNotes); setPaymentAgency(agency); }}>Marquer payé</Button>
                      <Button variant="secondary" loading={Boolean(actionLoading[`pay-unpaid-${agency.id}`])} onClick={() => runAction(`pay-unpaid-${agency.id}`, async () => markBilling(agency, 'unpaid'))}>Non payé</Button>
                      <Button variant="secondary" icon={<Mail className="h-4 w-4" />} loading={Boolean(actionLoading[`agency-resend-${agency.id}`])} onClick={() => runAction(`agency-resend-${agency.id}`, async () => resendAgencyActivationEmail(agency))}>Renvoyer rappel</Button>
                    </div>
                  </details>
                </div>
            ))}
          </div>
        </Card>
        ) : null}

        {activeView === 'users' ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Utilisateurs</p>
            <h2 className="mt-1 text-xl font-bold">Gestion des utilisateurs</h2>
            <p className="mt-1 text-sm text-carbon-400">Gérez les utilisateurs des agences.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-5">
            <MiniMetric label="Actifs" value={String(allAdminUsers.filter((u) => u.account_status === 'active').length)} icon={Users} tone="green" />
            <MiniMetric label="Propriétaires" value={String(allAdminUsers.filter((u) => normalizeAdminAgencyRole(u.role) === 'owner').length)} icon={Crown} tone="gold" />
            <MiniMetric label="Employés" value={String(allAdminUsers.filter((u) => normalizeAdminAgencyRole(u.role) !== 'owner').length)} icon={UserPlus} tone="blue" />
            <MiniMetric label="Inactifs" value={String(allAdminUsers.filter((u) => u.account_status !== 'active').length)} icon={ShieldAlert} tone="red" />
            <MiniMetric label="Total" value={String(allAdminUsers.length)} icon={Activity} tone="gold" />
          </div>
          <div className="divide-y divide-white/10">
            {allAdminUsers.length === 0 ? <p className="text-sm text-carbon-400">Aucun utilisateur disponible.</p> : allAdminUsers.map((user) => {
              const agency = agencies.find((item) => item.id === user.agency_id);
              return (
                <div key={user.id} className="grid gap-3 px-5 py-4 transition hover:bg-white/[0.025] md:grid-cols-[minmax(180px,1.3fr)_minmax(180px,1.4fr)_1fr_.7fr_.8fr_auto] md:items-center">
                    <div className="min-w-0">
                      <p className="font-black text-white">{user.full_name || 'Utilisateur'}</p>
                      <p className="mt-1 truncate text-xs text-carbon-400">{user.email || '—'}</p>
                    </div>
                    <p className="truncate text-sm text-carbon-300">{agency?.agencyName || 'Agence inconnue'}</p>
                    <p className="text-sm text-carbon-300">{user.role || 'Rôle non renseigné'}</p>
                    <Badge>{accountLabel(user.account_status)}</Badge>
                    <p className="text-xs text-carbon-400">{formatActivityTime(user.last_login_at)}</p>
                    <div className="flex gap-2 md:justify-end">
                      {agency ? <Button variant="ghost" className="h-9 px-3 text-xs" onClick={() => setSelectedAgencyDetails(agency)}>Voir agence</Button> : null}
                      {agency ? <Button variant="secondary" className="h-9 px-3 text-xs" loading={Boolean(actionLoading[`admin-user-revoke-${user.id}`])} onClick={() => runAction(`admin-user-revoke-${user.id}`, async () => revokeUserSessions(agency.id, user.id))}>Déconnecter</Button> : null}
                    </div>
                </div>
              );
            })}
          </div>
        </Card>
        ) : null}

        {activeView === 'sessions' ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Sessions</p>
            <h2 className="mt-1 text-xl font-bold">Connexions actives</h2>
            <p className="mt-1 text-sm text-carbon-400">Surveillez les connexions actives des utilisateurs.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <MiniMetric label="Actives" value={String(allAdminSessions.filter((s) => !s.revoked_at).length)} icon={Laptop2} tone="green" />
            <MiniMetric label="Appareils" value={String(new Set(allAdminSessions.map((s) => s.device_id || s.session_key || s.id)).size)} icon={Smartphone} tone="blue" />
            <MiniMetric label="Aujourd’hui" value={String(allAdminSessions.filter((s) => {
              const seenAt = s.last_seen_at || s.last_activity_at;
              return seenAt ? Date.now() - new Date(seenAt).getTime() <= 86400000 : false;
            }).length)} icon={CalendarClock} tone="gold" />
            <MiniMetric label="Révoquées" value={String(allAdminSessions.filter((s) => s.revoked_at).length)} icon={XCircle} tone="red" />
          </div>
          <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-5 py-3">
            {([
              ['all', 'Toutes'],
              ['today', 'Actives aujourd’hui'],
              ['ios', 'iOS'],
              ['desktop', 'Desktop'],
              ['old', 'Anciennes'],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setSessionFilter(value)} className={`h-9 shrink-0 rounded-xl px-3 text-xs font-bold transition ${sessionFilter === value ? 'bg-[#E3B117] text-carbon-950' : 'border border-white/10 bg-white/[0.03] text-carbon-300 hover:text-white'}`}>{label}</button>
            ))}
          </div>
          <div className="divide-y divide-white/10">
            {filteredAdminSessions.length === 0 ? <p className="p-8 text-center text-sm text-carbon-400">Aucune session pour ce filtre.</p> : filteredAdminSessions.slice(0, 30).map((session) => {
              const user = allAdminUsers.find((item) => item.id === session.user_id);
              const agency = agencies.find((item) => item.id === session.agency_id);
              return (
                <div key={session.id} className="grid gap-3 px-5 py-4 transition hover:bg-white/[0.025] lg:grid-cols-[1.2fr_1.2fr_1.2fr_.8fr_.8fr_1fr_auto_auto] lg:items-center">
                    <div className="min-w-0">
                      <p className="font-black text-white">{user?.full_name || user?.email || 'Utilisateur'}</p>
                      <p className="mt-1 truncate text-xs text-carbon-400">{user?.email || '—'}</p>
                    </div>
                    <p className="truncate text-sm text-carbon-300">{agency?.agencyName || 'Agence inconnue'}</p>
                    <p className="truncate text-sm text-carbon-300">{session.device_label || session.device_name || 'Appareil inconnu'}</p>
                    <p className="text-sm text-carbon-400">{session.browser || '—'}</p>
                    <p className="text-sm text-carbon-400">{session.os || '—'}</p>
                    <p className="text-xs text-carbon-400">{formatActivityTime(session.last_seen_at || session.last_activity_at)}</p>
                    <Badge>{activityLabel(session.last_seen_at, session.revoked_at)}</Badge>
                    {!session.revoked_at ? <Button variant="secondary" className="h-9 px-3 text-xs" loading={Boolean(actionLoading[`admin-session-revoke-${session.id}`])} onClick={() => runAction(`admin-session-revoke-${session.id}`, async () => revokeSingleSession(session.id))}>Déconnecter</Button> : <span />}
                  </div>
              );
            })}
          </div>
        </Card>
        ) : null}

        {activeView === 'reports' ? (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Rapports</p>
            <h2 className="mt-1 text-xl font-bold">Performance plateforme</h2>
            <p className="mt-1 text-sm text-carbon-400">Analysez les performances de la plateforme avec les données disponibles.</p>
          </div>
          <div className="grid gap-3 border-b border-white/10 p-5 sm:grid-cols-2 lg:grid-cols-6">
            <MiniMetric label="Revenu total" value={formatMAD(agencySummary.revenue)} icon={Banknote} tone="gold" />
            <MiniMetric label="Agences actives" value={String(agencySummary.active)} icon={Users} tone="green" />
            <MiniMetric label="Nouvelles demandes" value={String(allAccessRequests.filter((r) => Date.now() - new Date(r.created_at).getTime() <= 30 * 86400000).length)} icon={Mail} tone="blue" />
            <MiniMetric label="Conversion" value={`${allAccessRequests.length ? Math.round((allAccessRequests.filter((r) => r.status === 'approved').length / allAccessRequests.length) * 100) : 0}%`} icon={Activity} tone="green" />
            <MiniMetric label="Retards" value={String(agencies.filter((a) => a.billingStatus === 'overdue').length)} icon={AlertTriangle} tone="red" />
            <MiniMetric label="Utilisateurs" value={String(allAdminUsers.length)} icon={UserPlus} tone="gold" />
          </div>
          <div className="grid gap-4 p-5 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 lg:col-span-2">
              <p className="font-black text-white">Agences par plan</p>
              <div className="mt-4 space-y-3">
                {planStats.map(({ plan, agencies: planAgencies }) => {
                  const percent = agencies.length ? Math.round((planAgencies.length / agencies.length) * 100) : 0;
                  return (
                    <div key={`bar-${plan}`}>
                      <div className="flex items-center justify-between text-sm"><span className="font-semibold text-carbon-300">{planLabel(plan)}</span><span className="font-black text-white">{planAgencies.length}</span></div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#E3B117]" style={{ width: `${percent}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
              <p className="font-black text-white">Paiements</p>
              <div className="mt-4 space-y-3 text-sm text-carbon-300">
                <p className="flex justify-between"><span>Payés</span><strong className="text-emerald-200">{agencySummary.paid}</strong></p>
                <p className="flex justify-between"><span>Non payés</span><strong className="text-rose-200">{agencySummary.unpaid}</strong></p>
                <p className="flex justify-between"><span>Essais</span><strong className="text-sky-200">{agencySummary.trial}</strong></p>
              </div>
            </div>
          </div>
        </Card>
        ) : null}

        {(activeView === 'settings' || activeView === 'support') ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {activeView === 'settings' ? (
          <Card className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Paramètres</p>
            <h2 className="mt-1 text-xl font-bold text-white">Paramètres Super Admin</h2>
            <p className="mt-2 text-sm leading-6 text-carbon-400">Aucun module de paramètres Super Admin séparé n’est disponible dans cette page. Les actions existantes restent accessibles depuis les cartes agences.</p>
          </Card>
          ) : null}
          {activeView === 'support' ? (
          <Card className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F5C542]">Support</p>
            <h2 className="mt-1 text-xl font-bold text-white">Support plateforme</h2>
            <p className="mt-2 text-sm leading-6 text-carbon-400">Aucun backend support dédié n’existe ici. Les emails d’activation et liens client utilisent les handlers déjà présents.</p>
          </Card>
          ) : null}
        </div>
        ) : null}
        </div>
        </main>
      </div>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(86vw,320px)]">
            <SuperAdminSidebar revenue={agencySummary.revenue} profileName={profile.fullName || 'Younes Mekki'} activeView={activeView} onSelectView={setActiveView} mode="mobile" onClose={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      ) : null}

      {selectedAgencyDetails ? (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Fermer les détails" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedAgencyDetails(null)} />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-[760px] flex-col overflow-hidden border-l border-white/10 bg-gradient-to-b from-carbon-950 via-carbon-950 to-black shadow-[0_30px_90px_rgba(0,0,0,.45)] sm:rounded-l-[30px]">
            <div className="sticky top-0 z-10 border-b border-white/10 bg-carbon-950/95 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#F5C542]">Fiche agence</p>
                  <h2 className="mt-1 text-2xl font-black text-white">{selectedAgencyDetails.agencyName}</h2>
                  <p className="mt-1 text-sm text-carbon-300">{selectedAgencyDetails.ownerName} · {selectedAgencyDetails.email}</p>
                </div>
                <button type="button" onClick={() => setSelectedAgencyDetails(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 text-carbon-300 hover:bg-white/[0.05] hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill className={statusPillClass('plan', selectedAgencyDetails.plan)}>{planLabel(selectedAgencyDetails.plan)}</StatusPill>
                <StatusPill className={statusPillClass('billing', selectedAgencyDetails.billingStatus)}>{billingLabel(selectedAgencyDetails.billingStatus)}</StatusPill>
                <StatusPill className={statusPillClass('account', selectedAgencyDetails.accountStatus)}>{accountLabel(selectedAgencyDetails.accountStatus)}</StatusPill>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div className="rounded-3xl border border-[#E3B117]/20 bg-[#E3B117]/10 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-carbon-400">Plan actuel</p>
                    <p className="mt-1 font-black text-white">{planLabel(selectedAgencyDetails.plan)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-carbon-400">Prix</p>
                    <p className="mt-1 font-black text-white">{formatMAD(selectedAgencyDetails.monthlyPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-carbon-400">Échéance</p>
                    <p className="mt-1 font-black text-white">{dueState(selectedAgencyDetails.nextPaymentDueDate).label}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Statut compte', accountLabel(selectedAgencyDetails.accountStatus)],
                  ['Prochaine échéance', selectedAgencyDetails.nextPaymentDueDate || 'Non planifiée'],
                  ['Véhicules', String(selectedAgencyDetails.vehiclesCount)],
                  ['Utilisateurs', String(selectedAgencyDetails.usersCount)],
                  ['Création', formatSince(selectedAgencyDetails.createdAt)],
                  ['Dernière activité', formatActivityTime(selectedAgencyDetails.latestActivityAt)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-carbon-500">{label}</p>
                    <p className="mt-1 font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-carbon-950/55 p-4">
                <p className="text-sm font-black text-white">Historique abonnement</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-carbon-500">Rappel 3 jours</p>
                    <p className={`mt-1 text-sm font-bold ${selectedAgencyDetails.trialReminder3dSentAt ? 'text-emerald-200' : 'text-amber-200'}`}>
                      {selectedAgencyDetails.trialReminder3dSentAt ? 'Envoyé' : 'Non envoyé'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-carbon-500">Rappel 1 jour</p>
                    <p className={`mt-1 text-sm font-bold ${selectedAgencyDetails.trialReminder1dSentAt ? 'text-emerald-200' : 'text-amber-200'}`}>
                      {selectedAgencyDetails.trialReminder1dSentAt ? 'Envoyé' : 'Non envoyé'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    { label: 'Essai activé', date: selectedAgencyDetails.trialStartedAt },
                    { label: 'Rappel 3 jours envoyé', date: selectedAgencyDetails.trialReminder3dSentAt },
                    { label: 'Rappel 1 jour envoyé', date: selectedAgencyDetails.trialReminder1dSentAt },
                    { label: 'Essai prolongé par admin', date: selectedAgencyDetails.lastTrialExtendedAt },
                    { label: 'Essai expiré', date: effectiveAdminStatus(selectedAgencyDetails) === 'trial_expired' ? selectedAgencyDetails.trialEndsAt : null },
                    { label: 'Paiement en attente', date: effectiveAdminStatus(selectedAgencyDetails) === 'payment_pending' ? selectedAgencyDetails.trialEndsAt || selectedAgencyDetails.paidUntil : null },
                    { label: 'Marqué comme payé', date: selectedAgencyDetails.lastPaymentDate },
                    { label: 'Compte suspendu', date: effectiveAdminStatus(selectedAgencyDetails) === 'suspended' ? selectedAgencyDetails.latestActivityAt : null },
                  ].filter((item) => item.date).map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#E3B117]" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <p className="text-xs text-carbon-400">{formatActivityTime(item.date)}</p>
                      </div>
                    </div>
                  ))}
                  {!selectedAgencyDetails.trialStartedAt && !selectedAgencyDetails.lastPaymentDate ? (
                    <p className="text-sm text-carbon-400">Aucun événement horodaté disponible.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-carbon-950/55 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">Actions rapides</p>
                    <p className="mt-1 text-xs text-carbon-400">Accès temporaire et journalisé</p>
                  </div>
                  <div title={isSupportMode ? 'Une session d’assistance est déjà active' : undefined}>
                    <Button
                      icon={<Headphones className="h-4 w-4" />}
                      disabled={isSupportMode}
                      className="border border-[#F5C542]/70 bg-[#E3B117] text-carbon-950 shadow-[0_10px_28px_rgba(227,177,23,.18)] hover:bg-[#F5C542] hover:shadow-[0_14px_34px_rgba(227,177,23,.28)] disabled:border-white/10 disabled:bg-white/5 disabled:text-carbon-500 disabled:shadow-none"
                      onClick={() => {
                        setSupportAgency(selectedAgencyDetails);
                        setSupportReason('');
                        setSupportAccessMode('read_only');
                      }}
                    >
                      Ouvrir en assistance
                    </Button>
                  </div>
                </div>
                {isSupportMode ? <p className="mt-2 text-xs font-semibold text-amber-200">Mode assistance indisponible: une session est déjà active.</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" icon={<Crown className="h-4 w-4" />} loading={Boolean(actionLoading[`drawer-plan-${selectedAgencyDetails.id}`])} onClick={() => runAction(`drawer-plan-${selectedAgencyDetails.id}`, async () => changeAgencyPlan(selectedAgencyDetails, selectedAgencyDetails.plan === 'starter' ? 'pro' : selectedAgencyDetails.plan === 'pro' ? 'business' : selectedAgencyDetails.plan === 'business' ? 'lifetime' : 'starter'))}>Changer plan</Button>
                  <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => { setTrialExtensionDays(7); setTrialExtensionAgency(selectedAgencyDetails); }}>Prolonger essai</Button>
                  <Button variant="secondary" icon={<Banknote className="h-4 w-4" />} onClick={() => { setPaymentDuration(1); setPaymentMethod(selectedAgencyDetails.paymentMethod || 'bank_transfer'); setPaymentNote(selectedAgencyDetails.paymentNotes); setPaymentAgency(selectedAgencyDetails); }}>Marquer comme payé</Button>
                  <Button variant="secondary" icon={<Mail className="h-4 w-4" />} loading={Boolean(actionLoading[`drawer-resend-${selectedAgencyDetails.id}`])} onClick={() => runAction(`drawer-resend-${selectedAgencyDetails.id}`, async () => resendAgencyActivationEmail(selectedAgencyDetails))}>Renvoyer email</Button>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E3B117]/20 bg-carbon-950/55 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">Support & journal</p>
                    <p className="mt-1 text-xs text-carbon-400">{selectedAgencySupportLogs.length} session{selectedAgencySupportLogs.length > 1 ? 's' : ''} enregistrée{selectedAgencySupportLogs.length > 1 ? 's' : ''}</p>
                  </div>
                  <Button
                    variant="secondary"
                    icon={<Eye className="h-4 w-4" />}
                    onClick={() => {
                      setShowSupportHistory((current) => !current);
                      setShowAllSupportLogs(false);
                    }}
                  >
                    Voir journal support
                  </Button>
                </div>

                {selectedAgencySupportLogs[0] ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {[
                      ['Dernier accès', formatActivityTime(selectedAgencySupportLogs[0].started_at)],
                      ['Mode', selectedAgencySupportLogs[0].mode === 'read_only' ? 'Lecture seule' : 'Accès complet'],
                      ['Dernier admin', selectedAgencySupportLogs[0].adminName],
                      ['Motif', selectedAgencySupportLogs[0].reason],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-carbon-500">{label}</p>
                        <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-carbon-400">Aucun accès support enregistré pour cette agence.</p>
                )}

                {showSupportHistory && selectedAgencySupportLogs.length ? (
                  <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                    {selectedAgencySupportLogs.slice(0, showAllSupportLogs ? undefined : 5).map((log) => {
                      const status = supportLogStatus(log);
                      return (
                        <div key={log.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-white">{log.adminName}</p>
                              <p className="break-all text-xs text-carbon-400">{log.adminEmail}</p>
                            </div>
                            <StatusPill className={status === 'active' ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200' : status === 'expired' ? 'border-rose-300/30 bg-rose-400/15 text-rose-200' : 'border-white/15 bg-white/[0.05] text-carbon-200'}>
                              {status === 'active' ? 'Actif' : status === 'expired' ? 'Expiré' : 'Terminé'}
                            </StatusPill>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-carbon-300">
                            <span>{formatActivityTime(log.started_at)}</span>
                            <span>{log.mode === 'read_only' ? 'Lecture seule' : 'Accès complet'}</span>
                            <span>{supportLogDuration(log)}</span>
                            {log.ended_at ? <span>Fin: {formatActivityTime(log.ended_at)}</span> : null}
                          </div>
                          <p className="mt-2 break-words text-sm leading-5 text-carbon-200">{log.reason}</p>
                        </div>
                      );
                    })}
                    {selectedAgencySupportLogs.length > 5 ? (
                      <button type="button" className="w-full rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-[#F5C542] transition hover:border-[#E3B117]/40 hover:bg-[#E3B117]/10" onClick={() => setShowAllSupportLogs((current) => !current)}>
                        {showAllSupportLogs ? 'Afficher les 5 dernières' : 'Voir tout l’historique'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-carbon-950/55 p-4">
                <p className="text-sm font-black text-white">Utilisateurs</p>
                <div className="mt-3 space-y-2">
                  {(agencyUsers[selectedAgencyDetails.id] || []).length === 0 ? (
                    <p className="text-sm text-carbon-400">Aucun utilisateur disponible.</p>
                  ) : (agencyUsers[selectedAgencyDetails.id] || []).map((user) => (
                    <div key={user.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{user.full_name || 'Utilisateur'}</p>
                        <p className="text-xs text-carbon-400">{user.email || '—'} · {user.role || '—'}</p>
                      </div>
                      <Badge>{accountLabel(user.account_status)}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-carbon-950/55 p-4">
                <p className="text-sm font-black text-white">Sessions</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-carbon-500">Sessions actives</p>
                    <p className="mt-1 text-lg font-black text-white">{(agencySessions[selectedAgencyDetails.id] || []).filter((session) => !session.revoked_at).length}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-carbon-500">Sessions totales</p>
                    <p className="mt-1 text-lg font-black text-white">{(agencySessions[selectedAgencyDetails.id] || []).length}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs text-carbon-500">Dernière session</p>
                    <p className="mt-1 text-sm font-semibold text-white">{formatActivityTime((agencySessions[selectedAgencyDetails.id] || [])[0]?.last_seen_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <Modal
        open={Boolean(trialExtensionAgency)}
        onClose={() => setTrialExtensionAgency(null)}
        title="Prolonger l’essai"
        subtitle={trialExtensionAgency?.agencyName}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--app-text-soft)]">
            La nouvelle durée repart de la date de fin actuelle si elle est encore valide, sinon d’aujourd’hui. L’accès sera réactivé immédiatement.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([1, 3, 7] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setTrialExtensionDays(days)}
                className={`min-h-12 rounded-xl border px-3 text-sm font-black transition ${
                  trialExtensionDays === days
                    ? 'border-[#E3B117] bg-[#E3B117] text-carbon-950'
                    : 'border-[var(--app-border)] bg-[var(--app-surface-soft)] text-[var(--app-text)]'
                }`}
              >
                +{days} jour{days > 1 ? 's' : ''}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTrialExtensionAgency(null)}>Annuler</Button>
            <Button
              loading={Boolean(actionLoading['extend-trial-modal'])}
              onClick={() => runAction('extend-trial-modal', async () => {
                if (!trialExtensionAgency) return;
                await extendTrial(trialExtensionAgency, trialExtensionDays);
              })}
            >
              Confirmer
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(crmLeadToEdit)}
        onClose={() => setCrmLeadToEdit(null)}
        title="Mettre à jour le suivi CRM"
        subtitle={crmLeadToEdit ? `${crmLeadToEdit.agencyName} · ${crmLeadToEdit.source === 'agency' ? 'Agence active' : 'Demande d’accès'}` : undefined}
        panelClassName="sm:max-w-xl"
      >
        {crmLeadToEdit ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#E3B117]/20 bg-[#E3B117]/10 p-4">
              <p className="font-black text-white">{crmLeadToEdit.ownerName}</p>
              <p className="mt-1 break-all text-sm text-carbon-300">{crmLeadToEdit.email}</p>
              {crmLeadToEdit.phone ? <p className="mt-1 text-sm text-carbon-300">{crmLeadToEdit.phone}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-white">Étape du pipeline</span>
                <select className="form-control" value={crmDraft.pipeline_status || 'new'} onChange={(event) => setCrmDraft((current) => ({ ...current, pipeline_status: event.target.value as PipelineStatus }))}>
                  {pipelineStages.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-white">État commercial</span>
                <select className="form-control" value={crmDraft.health_score || 'follow_up'} onChange={(event) => setCrmDraft((current) => ({ ...current, health_score: event.target.value as HealthScore }))}>
                  {(Object.entries(healthLabels) as Array<[HealthScore, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-white">Date de relance</span>
              <input className="form-control" type="date" value={crmDraft.follow_up_date || ''} onChange={(event) => setCrmDraft((current) => ({ ...current, follow_up_date: event.target.value }))} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold text-white">Notes internes</span>
              <textarea className="form-control min-h-28 resize-y" maxLength={2000} value={crmDraft.internal_notes || ''} onChange={(event) => setCrmDraft((current) => ({ ...current, internal_notes: event.target.value }))} placeholder="Résumé du contact, objections, prochaine action..." />
              <span className="text-right text-xs text-carbon-500">{String(crmDraft.internal_notes || '').length}/2000</span>
            </label>
            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
              <Button variant="secondary" disabled={Boolean(actionLoading['save-crm'])} onClick={() => setCrmLeadToEdit(null)}>Annuler</Button>
              <Button loading={Boolean(actionLoading['save-crm'])} onClick={() => runAction('save-crm', saveCrmMetadata)}>Enregistrer</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(paymentAgency)}
        onClose={() => setPaymentAgency(null)}
        title="Marquer comme payé"
        subtitle={paymentAgency?.agencyName}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[var(--app-text)]">Durée du paiement</span>
            <select className="form-control" value={paymentDuration} onChange={(event) => setPaymentDuration(Number(event.target.value) as 1 | 3 | 6 | 12)}>
              <option value={1}>1 mois</option>
              <option value={3}>3 mois</option>
              <option value={6}>6 mois</option>
              <option value={12}>12 mois</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[var(--app-text)]">Méthode de paiement</span>
            <select className="form-control" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
              <option value="cash">Espèces</option>
              <option value="bank_transfer">Virement bancaire</option>
              <option value="cih">CIH</option>
              <option value="paypal">PayPal</option>
              <option value="card">Carte</option>
              <option value="other">Autre</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[var(--app-text)]">Note de paiement</span>
            <textarea className="form-control min-h-28 resize-y" value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Référence, montant reçu ou remarque interne..." />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPaymentAgency(null)}>Annuler</Button>
            <Button
              loading={Boolean(actionLoading['payment-modal'])}
              onClick={() => runAction('payment-modal', async () => {
                if (!paymentAgency) return;
                await activatePaidSubscription(paymentAgency, paymentDuration, paymentMethod, paymentNote.trim());
              })}
            >
              Confirmer le paiement
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(supportAgency)}
        onClose={() => {
          if (startingSupport) return;
          setSupportAgency(null);
          setSupportReason('');
        }}
        title="Ouvrir en assistance"
        subtitle="Accès temporaire, limité à 30 minutes et entièrement audité."
        panelClassName="sm:max-w-xl"
      >
        {supportAgency ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#E3B117]/25 bg-[#E3B117]/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#F5C542]">Agence sélectionnée</p>
              <p className="mt-1 text-lg font-black text-white">{supportAgency.agencyName}</p>
              <p className="mt-1 text-sm text-carbon-300">{supportAgency.ownerName} · {supportAgency.email}</p>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-white">Raison de l’accès</span>
              <textarea
                className="form-control min-h-24 resize-y"
                value={supportReason}
                onChange={(event) => setSupportReason(event.target.value)}
                placeholder={'Ex: Aider l’agence à corriger une réservation\nEx: Vérifier un problème de contrat PDF'}
                maxLength={500}
              />
              <span className={`flex flex-wrap justify-between gap-2 text-xs ${supportReason.trim().length >= SUPPORT_REASON_MIN_LENGTH ? 'text-emerald-300' : 'text-carbon-400'}`}>
                <span>Minimum {SUPPORT_REASON_MIN_LENGTH} caractères</span>
                <span>{supportReason.trim().length}/500</span>
              </span>
            </label>

            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-bold text-white">Niveau d’accès</legend>
              {([
                ['read_only', 'Lecture seule', 'Consulter les données sans pouvoir créer, modifier ou supprimer.'],
                ['full_access', 'Accès complet', 'Actions autorisées et automatiquement enregistrées dans le journal.'],
              ] as const).map(([mode, label, description]) => (
                <label key={mode} className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${supportAccessMode === mode ? 'border-[#E3B117]/60 bg-[#E3B117]/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}>
                  <input
                    type="radio"
                    name="support-mode"
                    value={mode}
                    checked={supportAccessMode === mode}
                    onChange={() => setSupportAccessMode(mode)}
                    className="mt-1 accent-[#E3B117]"
                  />
                  <span>
                    <span className="block font-black text-white">{label}</span>
                    <span className="mt-1 block text-sm text-carbon-400">{description}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Toutes les actions seront enregistrées dans le journal d’audit.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
              <Button variant="secondary" disabled={startingSupport} onClick={() => setSupportAgency(null)}>Annuler</Button>
              <Button
                icon={<Headphones className="h-4 w-4" />}
                loading={startingSupport}
                disabled={supportReason.trim().length < SUPPORT_REASON_MIN_LENGTH}
                onClick={() => void confirmSupportMode()}
              >
                Confirmer
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(requestToDelete)} onClose={() => { setRequestToDelete(null); setAdminDeleteConfirmText(''); }} title="Confirmer la suppression">
        <div className="space-y-3">
        <p className="text-sm text-carbon-300">Voulez-vous vraiment supprimer cette demande ? Tapez <strong>SUPPRIMER</strong> pour confirmer.</p>
        <input className="form-control" value={adminDeleteConfirmText} onChange={(e) => setAdminDeleteConfirmText(e.target.value)} placeholder="SUPPRIMER" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setRequestToDelete(null); setAdminDeleteConfirmText(''); }}>Annuler</Button>
          <Button variant="danger" disabled={adminDeleteConfirmText !== 'SUPPRIMER'} loading={Boolean(actionLoading['delete-request'])} onClick={() => runAction('delete-request', async () => { if (adminDeleteConfirmText !== 'SUPPRIMER') throw new Error('Tapez SUPPRIMER pour confirmer.'); await deleteRequest(); setAdminDeleteConfirmText(''); })}>Supprimer</Button>
        </div>
      </Modal>

      <Modal open={Boolean(pendingUserToDelete)} onClose={() => { setPendingUserToDelete(null); setAdminDeleteConfirmText(''); }} title="Supprimer définitivement">
        <div className="space-y-3">
          <p className="text-sm text-carbon-300">Cette action supprime définitivement ce compte Auth et son profil. Tapez <strong>SUPPRIMER</strong>.</p>
          <input className="form-control" value={adminDeleteConfirmText} onChange={(e) => setAdminDeleteConfirmText(e.target.value)} placeholder="SUPPRIMER" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setPendingUserToDelete(null); setAdminDeleteConfirmText(''); }}>Annuler</Button>
          <Button variant="danger" disabled={adminDeleteConfirmText !== 'SUPPRIMER'} loading={Boolean(actionLoading[`delete-pending-${pendingUserToDelete?.id}`])} onClick={() => runAction(`delete-pending-${pendingUserToDelete?.id}`, async () => {
            if (!pendingUserToDelete) return;
            await deletePendingAccountNow(pendingUserToDelete);
            setPendingUserToDelete(null);
          })}>Supprimer maintenant</Button>
        </div>
      </Modal>

      <Modal open={Boolean(agencyToDelete)} onClose={() => { setAgencyToDelete(null); setAdminDeleteConfirmText(''); }} title="Confirmer la suppression">
        <div className="space-y-3">
        <p className="text-sm text-carbon-300">Cette action désactive immédiatement le compte agence et programme sa suppression définitive après 30 jours. Il apparaîtra dans <strong>Comptes en cours de suppression</strong>. Tapez <strong>SUPPRIMER</strong> pour confirmer.</p>
        <input className="form-control" value={adminDeleteConfirmText} onChange={(e) => setAdminDeleteConfirmText(e.target.value)} placeholder="SUPPRIMER" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setAgencyToDelete(null); setAdminDeleteConfirmText(''); }}>Annuler</Button>
          <Button
            variant="danger"
            disabled={adminDeleteConfirmText !== 'SUPPRIMER'}
            loading={Boolean(actionLoading['delete-agency'])}
            onClick={() => runAction('delete-agency', async () => {
              if (!agencyToDelete) return;
              if (adminDeleteConfirmText !== 'SUPPRIMER') throw new Error('Tapez SUPPRIMER pour confirmer.');
              await deleteAgency(agencyToDelete);
              setAgencyToDelete(null);
              setAdminDeleteConfirmText('');
            })}
          >
            Programmer la suppression
          </Button>
        </div>
      </Modal>
    </div>
  );
}
