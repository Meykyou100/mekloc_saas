import { BellRing, Building2, Camera, Copy, ExternalLink, FileSignature, Globe2, Link2, Loader2, Mail, MessageCircle, Percent, RefreshCw, Save, Settings, ShieldAlert, ShieldCheck, Smartphone, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field, SelectField } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '../config/app';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { normalizeText, sanitizeText, validateEmail, validateFileUpload, validatePhone } from '../lib/security';
import { getNotificationPreferences, type NotificationPreferenceKey, type NotificationPreferences } from '../lib/notificationPreferences';
import { uploadAgencyLogo } from '../lib/storage';
import { supabase } from '../lib/supabase';

type TeamMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  account_status: string | null;
};

type AccountSession = {
  id: string;
  session_key?: string | null;
  device_name: string | null;
  device_label?: string | null;
  browser: string | null;
  os: string | null;
  user_agent?: string | null;
  location?: string | null;
  location_city?: string | null;
  location_country?: string | null;
  last_seen_at: string | null;
  first_seen_at: string | null;
  revoked_at: string | null;
};

type TeamRole = 'owner' | 'manager' | 'agent' | 'accountant';
type SettingsTab = 'Général' | 'Contrats' | 'Facturation' | 'Abonnement' | 'Équipe' | 'Notifications' | 'Sécurité';
type ActivationLinkMember = Pick<TeamMember, 'full_name' | 'email' | 'role' | 'account_status'> & { id?: string };
const settingsTabs: SettingsTab[] = ['Général', 'Contrats', 'Facturation', 'Abonnement', 'Équipe', 'Notifications', 'Sécurité'];
const settingsTabStorageKey = 'mekloc-settings-active-tab';
const sessionStorageKey = 'mekloc_session_id';
const notificationPreferenceItems: Array<{ key: NotificationPreferenceKey; label: string }> = [
  { key: 'reservationConfirmation', label: 'Confirmation réservation' },
  { key: 'paymentReminder', label: 'Rappel paiement' },
  { key: 'returnReminder', label: 'Rappel retour' },
  { key: 'contractSending', label: 'Envoi contrat' },
];

const teamRoleOptions: Array<{ value: TeamRole; label: string }> = [
  { value: 'owner', label: 'Propriétaire' },
  { value: 'manager', label: 'Manager' },
  { value: 'agent', label: 'Agent' },
  { value: 'accountant', label: 'Comptable' },
];

const notificationDescriptions: Record<NotificationPreferenceKey, string> = {
  reservationConfirmation: 'Prépare un message WhatsApp pour confirmer les dates, le véhicule et le montant.',
  paymentReminder: 'Prépare un rappel de paiement avec le montant et la date limite.',
  returnReminder: 'Prépare un rappel avant le retour du véhicule.',
  contractSending: 'Prépare un message pour envoyer ou rappeler le contrat au client.',
};

function normalizeTeamRole(role: string | null | undefined): TeamRole {
  const value = String(role || '').trim().toLowerCase();
  if (value === 'owner' || value === 'admin') return 'owner';
  if (value === 'manager') return 'manager';
  if (value === 'accountant') return 'accountant';
  return 'agent';
}

function roleFr(role: string | null | undefined) {
  const normalized = normalizeTeamRole(role);
  if (normalized === 'owner') return 'Propriétaire';
  if (normalized === 'manager') return 'Manager';
  if (normalized === 'accountant') return 'Comptable';
  return 'Agent';
}

function accountStatusFr(status: string | null | undefined) {
  if (status === 'active') return 'Actif';
  if (status === 'pending') return 'En attente';
  if (status === 'suspended') return 'Suspendu';
  if (status === 'rejected') return 'Refusé';
  if (status === 'pending_deletion') return 'Suppression programmée';
  return '—';
}

function teamStatusClass(status: string | null | undefined) {
  if (status === 'active') return 'bg-emerald-400/15 text-emerald-700 dark:text-emerald-200';
  if (status === 'pending') return 'bg-sky-400/15 text-sky-700 dark:text-sky-200';
  if (status === 'suspended') return 'bg-rose-400/15 text-rose-200';
  if (status === 'pending_deletion') return 'bg-rose-400/15 text-[var(--app-danger)]';
  return 'bg-slate-400/15 text-slate-200';
}

function extractErrorMessage(error: unknown) {
  if (!error) return 'Réessayez.';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const maybe = error as { message?: unknown; details?: unknown; hint?: unknown };
    const msg = typeof maybe.message === 'string' ? maybe.message : '';
    const details = typeof maybe.details === 'string' ? maybe.details : '';
    const hint = typeof maybe.hint === 'string' ? maybe.hint : '';
    return [msg, details, hint].filter(Boolean).join(' · ') || 'Réessayez.';
  }
  return 'Réessayez.';
}

function extractMissingColumnName(message: string) {
  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];
  const postgresMatch = message.match(/column ["']?([a-zA-Z0-9_]+)["']? does not exist/i);
  if (postgresMatch?.[1]) return postgresMatch[1];
  return null;
}

function readInitialSettingsTab(): SettingsTab {
  if (typeof window === 'undefined') return 'Général';
  const stored = window.localStorage.getItem(settingsTabStorageKey);
  return settingsTabs.includes(stored as SettingsTab) ? (stored as SettingsTab) : 'Général';
}

function formatSecurityDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-MA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function normalizeDateValue(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

function settingValue(settings: Record<string, unknown> | undefined, key: string) {
  const value = settings?.[key];
  return typeof value === 'string' ? value : '';
}

function settingNumber(settings: Record<string, unknown> | undefined, key: string, fallback: number) {
  const value = Number(settings?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function formatBillingDate(value: string | null | undefined) {
  const dateKey = normalizeDateValue(value);
  if (!dateKey) return '—';
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function sessionDeviceLabel(sessionItem: AccountSession) {
  return sessionItem.device_label || sessionItem.device_name || sessionItem.browser || 'Appareil';
}

function sessionLocationLabel(sessionItem: AccountSession) {
  if (sessionItem.location) return sessionItem.location;
  return [sessionItem.location_city, sessionItem.location_country].filter(Boolean).join(', ') || 'Localisation non disponible';
}

export default function SettingsPage() {
  const { notify, theme, setTheme } = useApp();
  const { agencyId, isSupabaseEnabled, profile, signOut, deleteAccountWithPassword, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<SettingsTab>(readInitialSettingsTab);
  const tabs = settingsTabs;
  const agency = profile?.agency;
  const billingStatusFr =
    agency?.billingStatus === 'trial' ? 'Essai' :
    agency?.billingStatus === 'paid' ? 'Payé' :
    agency?.billingStatus === 'unpaid' ? 'Non payé' :
    agency?.billingStatus === 'overdue' ? 'En retard' : 'Annulé';
  const billingTypeFr = agency?.billingType === 'lifetime' ? 'Lifetime' : agency?.billingType === 'annual' ? 'Annuel' : 'Mensuel';
  const displayedPlanPrice = agency?.billingType === 'lifetime'
    ? `${agency.annualPrice || agency.monthlyPrice || 5999} MAD à vie`
    : `${agency?.monthlyPrice || 199} MAD / mois`;
  const nextPaymentDate = agency?.nextPaymentDueDate || null;
  const effectiveLastPaymentDate =
    agency?.lastPaymentDate ||
    (agency?.billingStatus === 'paid' ? agency?.subscriptionStartDate || normalizeDateValue(agency?.createdAt) : null);
  const effectiveSubscriptionEndDate = agency?.subscriptionEndDate || agency?.nextPaymentDueDate || null;
  const now = new Date();
  const nextDiff = nextPaymentDate ? Math.ceil((new Date(nextPaymentDate).getTime() - now.getTime()) / 86400000) : null;
  const endDiff = effectiveSubscriptionEndDate ? Math.ceil((new Date(effectiveSubscriptionEndDate).getTime() - now.getTime()) / 86400000) : null;
  const contactPhone = SUPPORT_PHONE.replace(/^\+/, '');
  const contactEmail = SUPPORT_EMAIL;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [emailChangePassword, setEmailChangePassword] = useState('');
  const [emailChanging, setEmailChanging] = useState(false);
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [disconnectingDevices, setDisconnectingDevices] = useState(false);
  const [disconnectingSessionId, setDisconnectingSessionId] = useState<string | null>(null);
  const [accountSessions, setAccountSessions] = useState<AccountSession[]>([]);
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState(profile?.agency?.name || '');
  const [agencyEmail, setAgencyEmail] = useState(profile?.agency?.email || '');
  const [agencyPhone, setAgencyPhone] = useState(profile?.agency?.phone || '');
  const [agencyAddress, setAgencyAddress] = useState('');
  const [agencyActivityLabel, setAgencyActivityLabel] = useState('');
  const [agencyCity, setAgencyCity] = useState('');
  const [agencyWhatsapp, setAgencyWhatsapp] = useState('');
  const [agencyWebsite, setAgencyWebsite] = useState('');
  const [agencyIce, setAgencyIce] = useState('');
  const [agencyRc, setAgencyRc] = useState('');
  const [agencyIfNumber, setAgencyIfNumber] = useState('');
  const [agencyCnss, setAgencyCnss] = useState('');
  const [agencyFooterNote, setAgencyFooterNote] = useState('');
  const [contractLogoWidth, setContractLogoWidth] = useState(250);
  const [contractLogoHeight, setContractLogoHeight] = useState(92);
  const [logoFileName, setLogoFileName] = useState('');
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [logoPreviewBroken, setLogoPreviewBroken] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [rawLogoUrl, setRawLogoUrl] = useState('');
  const [cropScale, setCropScale] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [cropApplying, setCropApplying] = useState(false);
  const cropFrameRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [memberStatusTarget, setMemberStatusTarget] = useState<TeamMember | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamActionLoading, setTeamActionLoading] = useState<Record<string, boolean>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('agent');
  const [inviteLink, setInviteLink] = useState('');
  const [generatedActivationLink, setGeneratedActivationLink] = useState('');
  const [selectedMemberForActivation, setSelectedMemberForActivation] = useState<ActivationLinkMember | null>(null);
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() =>
    getNotificationPreferences(profile?.agency?.settings),
  );
  const logoBadgeClass = 'grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-gold-200/25 bg-gradient-to-br from-carbon-900 via-carbon-950 to-[#3f2b07] p-2 shadow-[0_12px_26px_rgba(212,160,23,.18)] light:border-gold-500/30 light:from-white light:via-gold-50 light:to-gold-100';
  const canManageTeam = profile?.role === 'owner' || profile?.role === 'manager' || Boolean(profile?.isSuperAdmin);
  const hasChanges = useMemo(() => {
    const baseName = profile?.agency?.name || '';
    const basePhone = profile?.agency?.phone || '';
    const baseAddress = profile?.agency?.address || '';
    const baseLogo = profile?.agency?.logoUrl || '';
    const baseSettings = profile?.agency?.settings;
    const baseNotifications = getNotificationPreferences(profile?.agency?.settings);
    return (
      agencyName !== baseName ||
      agencyPhone !== (settingValue(baseSettings, 'contract_phone') || basePhone || profile?.phone || '') ||
      agencyAddress !== baseAddress ||
      agencyEmail !== (settingValue(baseSettings, 'contract_email') || profile?.agency?.email || profile?.email || '') ||
      agencyActivityLabel !== settingValue(baseSettings, 'activity_label') ||
      agencyCity !== settingValue(baseSettings, 'city') ||
      agencyWhatsapp !== settingValue(baseSettings, 'whatsapp') ||
      agencyWebsite !== settingValue(baseSettings, 'website') ||
      agencyIce !== (settingValue(baseSettings, 'contract_ice') || profile?.agency?.ice || '') ||
      agencyRc !== (settingValue(baseSettings, 'contract_rc') || profile?.agency?.rc || '') ||
      agencyIfNumber !== settingValue(baseSettings, 'if_number') ||
      agencyCnss !== settingValue(baseSettings, 'cnss') ||
      agencyFooterNote !== settingValue(baseSettings, 'contract_footer_note') ||
      contractLogoWidth !== settingNumber(baseSettings, 'contract_logo_width', 250) ||
      contractLogoHeight !== settingNumber(baseSettings, 'contract_logo_height', 92) ||
      logoPreviewUrl !== baseLogo ||
      Boolean(pendingLogoFile) ||
      notificationPreferenceItems.some((item) => notificationPreferences[item.key] !== baseNotifications[item.key])
    );
  }, [agencyActivityLabel, agencyAddress, agencyCity, agencyCnss, agencyEmail, agencyFooterNote, agencyIce, agencyIfNumber, agencyName, agencyPhone, agencyRc, agencyWebsite, agencyWhatsapp, contractLogoHeight, contractLogoWidth, logoPreviewUrl, notificationPreferences, pendingLogoFile, profile?.agency?.address, profile?.agency?.email, profile?.agency?.ice, profile?.agency?.logoUrl, profile?.agency?.name, profile?.agency?.phone, profile?.agency?.rc, profile?.agency?.settings, profile?.email, profile?.phone]);
  useEffect(() => {
    setAgencyName(profile?.agency?.name || '');
    const settings = profile?.agency?.settings;
    setAgencyEmail(settingValue(settings, 'contract_email') || profile?.agency?.email || profile?.email || '');
    setAgencyPhone(settingValue(settings, 'contract_phone') || profile?.agency?.phone || profile?.phone || '');
    setAgencyAddress(profile?.agency?.address || '');
    setAgencyActivityLabel(settingValue(settings, 'activity_label'));
    setAgencyCity(settingValue(settings, 'city'));
    setAgencyWhatsapp(settingValue(settings, 'whatsapp'));
    setAgencyWebsite(settingValue(settings, 'website'));
    setAgencyIce(settingValue(settings, 'contract_ice') || profile?.agency?.ice || '');
    setAgencyRc(settingValue(settings, 'contract_rc') || profile?.agency?.rc || '');
    setAgencyIfNumber(settingValue(settings, 'if_number'));
    setAgencyCnss(settingValue(settings, 'cnss'));
    setAgencyFooterNote(settingValue(settings, 'contract_footer_note'));
    setContractLogoWidth(settingNumber(settings, 'contract_logo_width', 250));
    setContractLogoHeight(settingNumber(settings, 'contract_logo_height', 92));
    setLogoPreviewUrl(profile?.agency?.logoUrl || '');
    setPendingLogoFile(null);
    setLogoFileName('');
    setNotificationPreferences(getNotificationPreferences(profile?.agency?.settings));
    setSaveState('idle');
    setLogoPreviewBroken(false);
  }, [profile?.agency?.address, profile?.agency?.email, profile?.agency?.ice, profile?.agency?.logoUrl, profile?.agency?.name, profile?.agency?.phone, profile?.agency?.rc, profile?.agency?.settings, profile?.email, profile?.phone]);

  useEffect(() => {
    setLogoPreviewBroken(false);
  }, [logoPreviewUrl]);

  useEffect(() => {
    if (!hasChanges) {
      if (saveState !== 'saving') setSaveState('idle');
      return;
    }
    if (saveState !== 'saving') setSaveState('dirty');
  }, [hasChanges, saveState]);

  const loadTeamMembers = useCallback(async () => {
    if (!isSupabaseEnabled || !supabase || !agencyId) {
      setTeamMembers([]);
      return;
    }

    setTeamLoading(true);
    try {
      const { data, error } = await supabase
        .from('users_profiles')
        .select('id, full_name, email, role, account_status')
        .eq('agency_id', agencyId)
        .order('full_name', { ascending: true });
      if (error) {
        notify({
          title: 'Chargement équipe impossible',
          message: extractErrorMessage(error),
          type: 'warning',
        });
        setTeamMembers([]);
        return;
      }
      setTeamMembers((data || []) as TeamMember[]);
    } finally {
      setTeamLoading(false);
    }
  }, [agencyId, isSupabaseEnabled, notify]);

  useEffect(() => {
    if (tab !== 'Équipe') return;
    void loadTeamMembers();
  }, [loadTeamMembers, tab]);

  const loadSecurityCenter = useCallback(async () => {
    if (!isSupabaseEnabled || !supabase || !profile?.id) {
      setAccountSessions([]);
      setLastLoginAt(null);
      return;
    }
    setSecurityLoading(true);
    try {
      const [profileRes, sessionsRes] = await Promise.all([
        supabase.from('users_profiles').select('last_login_at,last_seen_at').eq('id', profile.id).maybeSingle(),
        supabase
          .from('user_sessions')
          .select('*')
          .eq('user_id', profile.id)
          .order('last_seen_at', { ascending: false }),
      ]);
      if (!profileRes.error) {
        const row = profileRes.data as { last_login_at?: string | null; last_seen_at?: string | null } | null;
        setLastLoginAt(row?.last_login_at || row?.last_seen_at || null);
      }
      if (!sessionsRes.error) {
        setAccountSessions((sessionsRes.data || []) as AccountSession[]);
      } else if (!/relation .*user_sessions.* does not exist/i.test(sessionsRes.error.message || '')) {
        throw sessionsRes.error;
      }
    } catch (error) {
      notify({ title: 'Sécurité indisponible', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setSecurityLoading(false);
    }
  }, [isSupabaseEnabled, notify, profile?.id]);

  useEffect(() => {
    void loadSecurityCenter();
  }, [loadSecurityCenter]);

  function selectSettingsTab(nextTab: SettingsTab) {
    setTab(nextTab);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(settingsTabStorageKey, nextTab);
    }
  }

  async function runTeamAction(key: string, action: () => Promise<void>) {
    setTeamActionLoading((curr) => ({ ...curr, [key]: true }));
    try {
      await action();
    } catch (error) {
      notify({ title: 'Action équipe impossible', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setTeamActionLoading((curr) => ({ ...curr, [key]: false }));
    }
  }

  async function getFreshAccessToken() {
    if (!supabase) return null;
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) return refreshed.session.access_token;
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  }

  async function postTeamEndpoint(functionName: string, body: unknown, configuredWebhook?: string) {
    if (!supabase) throw new Error('Supabase indisponible.');
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const webhook = configuredWebhook || (supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}` : '');
    if (!webhook || !anonKey) throw new Error('Configuration Supabase manquante.');
    let token = await getFreshAccessToken();
    if (!token) throw new Error('Session introuvable. Reconnectez-vous puis réessayez.');

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

  async function postTeamWebhook(body: unknown) {
    return postTeamEndpoint('invite-agency-member', body, import.meta.env.VITE_INVITE_AGENCY_MEMBER_WEBHOOK as string | undefined);
  }

  async function postDeleteTeamMemberWebhook(body: unknown) {
    return postTeamEndpoint('delete-agency-member', body, import.meta.env.VITE_DELETE_AGENCY_MEMBER_WEBHOOK as string | undefined);
  }

  async function postGenerateTeamMemberLinkWebhook(body: unknown) {
    return postTeamEndpoint('generate-agency-member-link', body, import.meta.env.VITE_GENERATE_AGENCY_MEMBER_LINK_WEBHOOK as string | undefined);
  }

  async function writeTextToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        return copied;
      } catch {
        return false;
      }
    }
  }

  async function copyActivationLink(link: string) {
    const copied = await writeTextToClipboard(link);
    notify({
      title: copied ? 'Lien copié' : 'Copie manuelle',
      message: copied ? 'Le lien activation est dans le presse-papiers.' : 'Sélectionnez le lien affiché puis copiez-le.',
      type: copied ? 'success' : 'warning',
    });
  }

  function openActivationLinkModal(member: ActivationLinkMember, link: string) {
    selectSettingsTab('Équipe');
    setSelectedMemberForActivation(member);
    setGeneratedActivationLink(link);
    setIsActivationModalOpen(true);
  }

  function closeActivationLinkModal() {
    setIsActivationModalOpen(false);
  }

  async function handleChangeMemberRole(member: TeamMember, nextRole: TeamRole) {
    const client = supabase;
    if (!client || !agencyId || !canManageTeam) return;
    if (member.id === profile?.id) {
      notify({ title: 'Action bloquée', message: 'Votre propre rôle doit être modifié par un autre propriétaire.', type: 'warning' });
      return;
    }
    if (normalizeTeamRole(member.role) === nextRole) return;
    if (nextRole === 'owner' && !window.confirm('Confirmer le passage de ce membre en propriétaire ?')) return;

    await runTeamAction(`role-${member.id}`, async () => {
      const { error } = await client.from('users_profiles').update({ role: nextRole }).eq('id', member.id).eq('agency_id', agencyId);
      if (error) throw error;
      notify({ title: 'Rôle mis à jour', message: `${member.full_name || member.email || 'Membre'} est maintenant ${roleFr(nextRole)}.`, type: 'success' });
      await loadTeamMembers();
    });
  }

  async function confirmToggleMemberStatus() {
    const member = memberStatusTarget;
    if (!member) return;
    const client = supabase;
    if (!client || !agencyId || !canManageTeam) return;
    if (member.id === profile?.id) {
      notify({ title: 'Action bloquée', message: 'Vous ne pouvez pas suspendre votre propre accès.', type: 'warning' });
      return;
    }
    const nextStatus = member.account_status === 'suspended' || member.account_status === 'rejected' ? 'active' : 'suspended';
    const nowIso = new Date().toISOString();

    await runTeamAction(`status-${member.id}`, async () => {
      const patch: Record<string, string> = { account_status: nextStatus };
      if (nextStatus === 'suspended') patch.force_logout_at = nowIso;
      const update = await client.from('users_profiles').update(patch).eq('id', member.id).eq('agency_id', agencyId);
      if (update.error) {
        if (patch.force_logout_at && /force_logout_at|schema cache/i.test(update.error.message || '')) {
          const retry = await client.from('users_profiles').update({ account_status: nextStatus }).eq('id', member.id).eq('agency_id', agencyId);
          if (retry.error) throw retry.error;
        } else {
          throw update.error;
        }
      }

      if (nextStatus === 'suspended') {
        try {
          await client
            .from('user_sessions')
            .update({ revoked_at: nowIso })
            .eq('agency_id', agencyId)
            .eq('user_id', member.id)
            .is('revoked_at', null);
        } catch {
          // Session revocation is best-effort if the migration is not deployed yet.
        }
      }

      notify({
        title: nextStatus === 'active' ? 'Utilisateur réactivé' : 'Utilisateur suspendu',
        message: member.full_name || member.email || 'Membre mis à jour',
        type: 'success',
      });
      await loadTeamMembers();
      setMemberStatusTarget(null);
    });
  }

  async function handleGenerateMemberLink(member: TeamMember) {
    if (!member.email) {
      notify({ title: 'Email manquant', message: 'Impossible de générer un lien sans email.', type: 'warning' });
      return;
    }
    selectSettingsTab('Équipe');
    setTeamActionLoading((curr) => ({ ...curr, [`link-${member.id}`]: true }));
    try {
      const response = await postGenerateTeamMemberLinkWebhook({
        memberId: member.id,
        email: member.email,
        redirectTo: `${window.location.origin}/set-password`,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Génération du lien impossible');
      const link = typeof payload?.activationLink === 'string' ? payload.activationLink : '';
      if (!link) throw new Error('Lien activation absent.');
      openActivationLinkModal(member, link);
      notify({
        title: 'Lien d’activation prêt',
        message: 'Le lien est affiché dans la fenêtre.',
        type: 'success',
      });
    } catch (error) {
      notify({ title: 'Impossible de générer le lien', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setTeamActionLoading((curr) => ({ ...curr, [`link-${member.id}`]: false }));
    }
  }

  async function handleDeleteMember(member: TeamMember) {
    if (member.id === profile?.id) {
      notify({ title: 'Action bloquée', message: 'Vous ne pouvez pas supprimer votre propre accès.', type: 'warning' });
      return;
    }
    if (!window.confirm(`Supprimer ${member.full_name || member.email || 'cet utilisateur'} de cette agence ?`)) return;
    await runTeamAction(`delete-${member.id}`, async () => {
      const response = await postDeleteTeamMemberWebhook({ memberId: member.id });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Suppression impossible');
      if (selectedMemberForActivation?.email === member.email) {
        setGeneratedActivationLink('');
        setSelectedMemberForActivation(null);
        setIsActivationModalOpen(false);
      }
      notify({ title: 'Utilisateur supprimé', message: member.full_name || member.email || 'Membre supprimé', type: 'success' });
      await loadTeamMembers();
    });
  }

  async function handleInviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const safeEmail = normalizeText(inviteEmail, 254).toLowerCase();
    const safeName = sanitizeText(inviteFullName, 100);
    if (!safeEmail || !validateEmail(safeEmail)) {
      notify({ title: 'Email invalide', message: 'Veuillez vérifier l’adresse email.', type: 'warning' });
      return;
    }
    if (!agencyId) {
      notify({ title: 'Agence introuvable', message: 'Reconnectez-vous puis réessayez.', type: 'warning' });
      return;
    }

    setInviteSending(true);
    setInviteLink('');
    try {
      const response = await postTeamWebhook({
        email: safeEmail,
        fullName: safeName,
        role: inviteRole,
        redirectTo: `${window.location.origin}/set-password`,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Invitation impossible');

      const nextInviteLink = typeof payload?.activationLink === 'string' ? payload.activationLink : '';
      if (payload?.inviteSent === false && !nextInviteLink) {
        throw new Error('Email non envoyé et lien activation absent. Réessayez après redéploiement de la fonction invitation.');
      }
      if (nextInviteLink) {
        setInviteLink(nextInviteLink);
        openActivationLinkModal(
          { id: '', full_name: safeName || null, email: safeEmail, role: inviteRole, account_status: 'pending' },
          nextInviteLink,
        );
      }
      notify({
        title: payload?.inviteSent === false || nextInviteLink ? 'Lien activation prêt' : 'Invitation envoyée',
        message: payload?.inviteSent === false ? 'Email non envoyé automatiquement. Le lien est affiché dans une fenêtre.' : nextInviteLink ? 'Email envoyé, et le lien reste disponible à copier.' : 'Le membre a reçu un email d’activation.',
        type: payload?.inviteSent === false ? 'warning' : 'success',
      });
      if (payload?.inviteSent !== false && !nextInviteLink) {
        setInviteOpen(false);
        setInviteEmail('');
        setInviteFullName('');
        setInviteRole('agent');
      }
      await loadTeamMembers();
    } catch (error) {
      notify({ title: 'Invitation impossible', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setInviteSending(false);
    }
  }
  function downloadBillingReceipt() {
    const lines = [
      'Recu abonnement MekLoc',
      `Agence: ${agency?.name || 'Agence'}`,
      `Plan: ${(agency?.plan || 'starter').toUpperCase()}`,
      `Statut paiement: ${billingStatusFr}`,
      `Date: ${new Date().toLocaleDateString('fr-MA')}`,
      `Dernier paiement: ${formatBillingDate(effectiveLastPaymentDate)}`,
      `Prochain paiement: ${formatBillingDate(agency?.nextPaymentDueDate || null)}`,
      `Fin abonnement: ${formatBillingDate(effectiveSubscriptionEndDate)}`,
    ];
    const textStream = lines.map((line, i) => `BT /F1 11 Tf 50 ${780 - i * 18} Td (${line.replace(/[()\\]/g, '')}) Tj ET`).join('\n');
    const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${textStream.length} >> stream
${textStream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000243 00000 n 
000000${(260 + textStream.length).toString().padStart(10, '0')} 00000 n 
trailer << /Root 1 0 R /Size 6 >>
startxref
0
%%EOF`;
    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recu-abonnement-${(agency?.name || 'mekloc').replace(/\s+/g, '-').toLowerCase()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    notify({ title: 'Reçu PDF', message: 'Le reçu PDF a été téléchargé.', type: 'success' });
  }

  async function handleLogoUpload(file: File | undefined) {
    if (!file) return;
    const validation = validateFileUpload(file, {
      maxSizeMb: 3,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    });
    if (validation) {
      notify({ title: 'Fichier non autorisé', message: validation, type: 'warning' });
      return;
    }
    setLogoFileName(file.name);
    const localPreview = URL.createObjectURL(file);
    setRawLogoUrl(localPreview);
    setPendingLogoFile(file);
    setCropScale(1);
    setCropX(0);
    setCropY(0);
    setCropOpen(true);
  }

  async function handleRemoveLogo() {
    setLogoFileName('');
    setLogoPreviewUrl('');
    setPendingLogoFile(null);
    if (!isSupabaseEnabled || !agencyId || !supabase) {
      notify({ title: 'Logo supprimé', message: 'Suppression locale effectuée.', type: 'success' });
      setSaveState('dirty');
      return;
    }
    try {
      setLogoUploading(true);
      const previousPath = profile?.agency?.logoPath;
      if (previousPath) {
        await supabase.storage.from('logos').remove([previousPath]);
      }
      const { error } = await supabase.from('agencies').update({ logo_path: null, logo_url: null }).eq('id', agencyId);
      if (error) throw error;
      await refreshProfile();
      notify({ title: 'Logo supprimé', message: 'Le logo agence a été retiré.', type: 'success' });
      setSaveState('saved');
    } catch (error) {
      notify({ title: 'Suppression impossible', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setLogoUploading(false);
    }
  }

  function handleCropPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!cropFrameRef.current) return;
    const rect = cropFrameRef.current.getBoundingClientRect();
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: cropX,
      offsetY: cropY,
    };
    setDragging(true);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      setDragging(false);
      dragStartRef.current = null;
    }
  }

  function handleCropPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !dragStartRef.current) return;
    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;
    setCropX(dragStartRef.current.offsetX + dx);
    setCropY(dragStartRef.current.offsetY + dy);
  }

  function handleCropPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    setDragging(false);
    dragStartRef.current = null;
  }

  async function applyLogoCrop() {
    if (!pendingLogoFile || !rawLogoUrl || !cropFrameRef.current) return;
    setCropApplying(true);
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = rawLogoUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Image invalide.'));
      });
      const size = 600;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas indisponible');
      context.clearRect(0, 0, size, size);
      const frameRect = cropFrameRef.current.getBoundingClientRect();
      const baseScale = Math.min(frameRect.width / image.width, frameRect.height / image.height);
      const finalScale = baseScale * cropScale;
      const drawWidth = image.width * finalScale * (size / frameRect.width);
      const drawHeight = image.height * finalScale * (size / frameRect.height);
      const drawX = (size - drawWidth) / 2 + (cropX * size) / frameRect.width;
      const drawY = (size - drawHeight) / 2 + (cropY * size) / frameRect.height;
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((out) => resolve(out), 'image/png', 0.95));
      if (!blob) throw new Error('Impossible de traiter le logo.');
      const file = new File([blob], `logo-cropped-${Date.now()}.png`, { type: 'image/png' });
      setPendingLogoFile(file);
      setLogoPreviewUrl(URL.createObjectURL(blob));
      setCropOpen(false);
      if (rawLogoUrl) URL.revokeObjectURL(rawLogoUrl);
      setRawLogoUrl('');
      notify({ title: 'Logo ajusté', message: 'Cliquez sur Enregistrer pour confirmer.', type: 'info' });
    } catch (error) {
      notify({ title: 'Ajustement impossible', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setCropApplying(false);
    }
  }

  function resetCropView() {
    setCropScale(1);
    setCropX(0);
    setCropY(0);
  }

  async function handleSaveSettings() {
    if (!isSupabaseEnabled || !agencyId || !profile?.id) {
      notify({ title: 'Paramètres enregistrés', message: 'Mode démonstration actif.', type: 'success' });
      return;
    }
    try {
      const safeAgencyName = sanitizeText(agencyName, 100);
      const safeAgencyAddress = sanitizeText(agencyAddress, 220);
      const safeAgencyPhone = normalizeText(agencyPhone, 20);
      const safeAgencyEmail = sanitizeText(agencyEmail, 160);

      if (!safeAgencyName) {
        notify({ title: 'Champ obligatoire', message: "Le nom de l’agence est obligatoire.", type: 'warning' });
        return;
      }
      if (safeAgencyPhone && !validatePhone(safeAgencyPhone)) {
        notify({ title: 'Numéro invalide', message: 'Veuillez vérifier votre numéro WhatsApp.', type: 'warning' });
        return;
      }
      if (safeAgencyEmail && !validateEmail(safeAgencyEmail)) {
        notify({ title: 'Email invalide', message: "Veuillez vérifier l’email de l’agence.", type: 'warning' });
        return;
      }

      setSettingsSaving(true);
      setSaveState('saving');
      if (!supabase) throw new Error('Supabase non configuré');
      if (pendingLogoFile && agencyId) {
        await uploadAgencyLogo(agencyId, pendingLogoFile);
      }
      const nextAgencySettings = {
        ...(profile?.agency?.settings || {}),
        notifications: notificationPreferences,
        activity_label: sanitizeText(agencyActivityLabel, 120),
        city: sanitizeText(agencyCity, 100),
        contract_phone: safeAgencyPhone,
        contract_email: safeAgencyEmail,
        contract_ice: sanitizeText(agencyIce, 60),
        contract_rc: sanitizeText(agencyRc, 60),
        whatsapp: normalizeText(agencyWhatsapp, 20),
        website: sanitizeText(agencyWebsite, 180),
        if_number: sanitizeText(agencyIfNumber, 60),
        cnss: sanitizeText(agencyCnss, 60),
        contract_footer_note: sanitizeText(agencyFooterNote, 300),
        contract_logo_width: Math.min(300, Math.max(160, contractLogoWidth)),
        contract_logo_height: Math.min(120, Math.max(55, contractLogoHeight)),
      };
      const agencyPayload: Record<string, unknown> = {
        name: safeAgencyName,
        address: safeAgencyAddress,
        settings: nextAgencySettings,
      };
      type SavedAgencySettingsRow = {
        name?: string | null;
        address?: string | null;
        settings?: Record<string, unknown> | null;
      };
      const { data: savedAgencyData, error: agencyErr } = await supabase
        .from('agencies')
        .update(agencyPayload)
        .eq('id', agencyId)
        .select('name,address,settings')
        .single();
      if (agencyErr) {
        const missingColumn = extractMissingColumnName(agencyErr.message || '');
        if (missingColumn === 'address') {
          throw new Error('Colonne agencies.address manquante. Appliquez la migration agencies_address_safe.sql dans Supabase.');
        }
        if (missingColumn === 'settings') {
          throw new Error('Colonne agencies.settings manquante. Appliquez la migration agency_settings_notifications_safe.sql dans Supabase.');
        }
        throw agencyErr;
      }
      const savedAgency = savedAgencyData as SavedAgencySettingsRow | null;
      if (!savedAgency) {
        throw new Error('Les paramètres agence n’ont pas été enregistrés.');
      }
      if (String(savedAgency.name || '') !== safeAgencyName) {
        throw new Error("Le nom de l’agence n’a pas été enregistré.");
      }
      if (String(savedAgency.address || '') !== safeAgencyAddress) {
        throw new Error('Adresse non enregistrée dans Supabase. Vérifiez la colonne agencies.address et les règles RLS.');
      }
      const savedSettings = savedAgency.settings || {};
      const settingsChecks: Array<[string, string | number]> = [
        ['activity_label', nextAgencySettings.activity_label],
        ['city', nextAgencySettings.city],
        ['contract_phone', nextAgencySettings.contract_phone],
        ['contract_email', nextAgencySettings.contract_email],
        ['contract_ice', nextAgencySettings.contract_ice],
        ['contract_rc', nextAgencySettings.contract_rc],
        ['whatsapp', nextAgencySettings.whatsapp],
        ['website', nextAgencySettings.website],
        ['if_number', nextAgencySettings.if_number],
        ['cnss', nextAgencySettings.cnss],
        ['contract_footer_note', nextAgencySettings.contract_footer_note],
        ['contract_logo_width', nextAgencySettings.contract_logo_width],
        ['contract_logo_height', nextAgencySettings.contract_logo_height],
      ];
      const unsavedSetting = settingsChecks.find(([key, expected]) => String(savedSettings[key] ?? '') !== String(expected));
      if (unsavedSetting) {
        throw new Error(`Le paramètre contrat « ${unsavedSetting[0]} » n’a pas été enregistré.`);
      }

      let profileErr: { message?: string } | null = null;
      const profilePayload: Record<string, unknown> = {
        phone: safeAgencyPhone,
        full_name: profile.fullName,
      };
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const profileUpdate = await supabase.from('users_profiles').update(profilePayload).eq('id', profile.id);
        profileErr = profileUpdate.error;
        if (!profileErr) break;
        const missingColumn = extractMissingColumnName(profileErr.message || '');
        if (!missingColumn || !(missingColumn in profilePayload)) break;
        delete profilePayload[missingColumn];
        if (Object.keys(profilePayload).length === 0) break;
      }
      if (profileErr && !/permission denied|row-level security/i.test(profileErr.message || '')) throw profileErr;
      await refreshProfile();
      setPendingLogoFile(null);
      setLogoFileName('');

      notify({ title: 'Paramètres enregistrés', message: 'Profil agence mis à jour.', type: 'success' });
      setSaveState('saved');
    } catch (error) {
      notify({ title: 'Enregistrement impossible', message: extractErrorMessage(error), type: 'warning' });
      setSaveState('dirty');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleLogout() {
    await signOut();
    navigate('/auth');
  }

  async function handleDeleteAccount() {
    if (!deletePassword) return;
    try {
      await deleteAccountWithPassword(deletePassword);
      notify({ title: 'Suppression programmée', message: 'Votre compte est désactivé et sera supprimé définitivement après 30 jours.', type: 'success' });
      setDeleteOpen(false);
      setDeletePassword('');
      navigate('/auth');
    } catch (error) {
      notify({ title: 'Suppression impossible', message: extractErrorMessage(error), type: 'warning' });
    }
  }

  function openEmailChangeModal() {
    setNewAccountEmail(profile?.email || agencyEmail || '');
    setEmailChangePassword('');
    setEmailChangeOpen(true);
  }

  async function handleChangeEmail() {
    if (!supabase || !profile?.email) {
      notify({ title: 'Session introuvable', message: 'Reconnectez-vous puis réessayez.', type: 'warning' });
      return;
    }
    const safeEmail = normalizeText(newAccountEmail, 254).toLowerCase();
    if (!safeEmail || !validateEmail(safeEmail)) {
      notify({ title: 'Email invalide', message: 'Veuillez vérifier la nouvelle adresse email.', type: 'warning' });
      return;
    }
    if (!emailChangePassword) {
      notify({ title: 'Mot de passe requis', message: 'Entrez votre mot de passe actuel.', type: 'warning' });
      return;
    }
    setEmailChanging(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: emailChangePassword,
      });
      if (authError) throw new Error('Mot de passe incorrect');
      const { error } = await supabase.auth.updateUser({ email: safeEmail });
      if (error) throw error;
      notify({
        title: 'Confirmation envoyée',
        message: 'Un email de confirmation a été envoyé. Le changement sera appliqué après validation.',
        type: 'success',
      });
      setEmailChangeOpen(false);
      setEmailChangePassword('');
    } catch (error) {
      notify({ title: 'Changement email impossible', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setEmailChanging(false);
    }
  }

  async function handleChangePassword() {
    if (!supabase || !profile?.email) {
      notify({ title: 'Session introuvable', message: 'Reconnectez-vous puis réessayez.', type: 'warning' });
      return;
    }
    if (!currentPassword) {
      notify({ title: 'Mot de passe requis', message: 'Entrez votre mot de passe actuel.', type: 'warning' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      notify({ title: 'Les mots de passe ne correspondent pas', message: 'Confirmez le même nouveau mot de passe.', type: 'warning' });
      return;
    }
    if (newPassword.length < 8) {
      notify({ title: 'Mot de passe trop court', message: 'Utilisez au moins 8 caractères.', type: 'warning' });
      return;
    }
    setPasswordChanging(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });
      if (authError) throw new Error('Mot de passe incorrect');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      notify({ title: 'Mot de passe modifié', message: 'Votre mot de passe a été mis à jour.', type: 'success' });
      setPasswordChangeOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      notify({ title: 'Changement mot de passe impossible', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setPasswordChanging(false);
    }
  }

  async function handleDisconnectAllDevices() {
    if (!supabase || !profile?.id) return;
    setDisconnectingDevices(true);
    try {
      const nowIso = new Date().toISOString();
      const sessionsUpdate = await supabase
        .from('user_sessions')
        .update({ revoked_at: nowIso })
        .eq('user_id', profile.id)
        .is('revoked_at', null);
      if (sessionsUpdate.error && !/relation .*user_sessions.* does not exist/i.test(sessionsUpdate.error.message || '')) {
        throw sessionsUpdate.error;
      }
      const profileUpdate = await supabase
        .from('users_profiles')
        .update({ force_logout_at: nowIso })
        .eq('id', profile.id);
      if (profileUpdate.error) {
        if (/force_logout_at|schema cache/i.test(profileUpdate.error.message || '')) {
          throw new Error('Gestion des sessions non prête: appliquez la migration user_sessions_management_safe.sql dans Supabase.');
        }
        throw profileUpdate.error;
      }
      notify({ title: 'Appareils déconnectés', message: 'Toutes les sessions actives ont été fermées.', type: 'success' });
      await signOut();
      navigate('/auth?revoked=1');
    } catch (error) {
      notify({ title: 'Déconnexion impossible', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setDisconnectingDevices(false);
    }
  }

  async function handleDisconnectSession(sessionItem: AccountSession) {
    if (!supabase || !profile?.id) return;
    setDisconnectingSessionId(sessionItem.id);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('user_sessions')
        .update({ revoked_at: nowIso })
        .eq('id', sessionItem.id)
        .eq('user_id', profile.id)
        .is('revoked_at', null);
      if (error) throw error;
      notify({ title: 'Appareil déconnecté', type: 'success' });
      const currentSessionKey = typeof window !== 'undefined' ? window.localStorage.getItem(sessionStorageKey) : null;
      if (sessionItem.session_key && currentSessionKey && sessionItem.session_key === currentSessionKey) {
        await signOut();
        navigate('/auth?revoked=1');
        return;
      }
      await loadSecurityCenter();
    } catch (error) {
      notify({ title: 'Déconnexion impossible', message: extractErrorMessage(error), type: 'warning' });
    } finally {
      setDisconnectingSessionId(null);
    }
  }

  return (
    <div className="overflow-x-hidden pb-[calc(108px+env(safe-area-inset-bottom))] md:pb-8">
      <div className="mb-3 rounded-2xl border border-[var(--app-border)] bg-[linear-gradient(135deg,var(--app-card),var(--app-surface))] p-3 shadow-[0_14px_34px_rgba(16,24,32,.10),inset_0_1px_0_rgba(255,255,255,.06)] md:hidden">
        <div className="grid gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--app-gold-text)]">WORKSPACE</p>
            <h1 className="mt-0.5 text-2xl font-black leading-none text-[var(--app-text)]">Paramètres</h1>
            <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">Configurez votre espace agence.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button className="h-11 rounded-2xl px-3 text-xs" icon={settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} onClick={handleSaveSettings} loading={settingsSaving} disabled={!hasChanges && !settingsSaving}>
              {settingsSaving ? '...' : 'Enregistrer'}
            </Button>
            <Button variant="secondary" className="h-11 rounded-2xl px-3 text-xs" onClick={handleLogout}>Déconnexion</Button>
          </div>
        </div>
      </div>
      <div className="hidden md:block">
        <PageHeader
          eyebrow="Workspace"
          title="Paramètres"
          description="Configurez votre espace agence."
          action={<div className="flex gap-2"><Button icon={settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} onClick={handleSaveSettings} loading={settingsSaving} disabled={!hasChanges && !settingsSaving}>{settingsSaving ? 'Enregistrement...' : 'Enregistrer'}</Button><Button variant="secondary" onClick={handleLogout}>Déconnexion</Button></div>}
        />
      </div>
      <div className="mb-2 md:mb-3">
        {saveState === 'dirty' ? <p className="text-sm text-[var(--app-gold-text)]">Modifications non enregistrées</p> : null}
        {saveState === 'saved' ? <p className="text-sm text-emerald-300">Enregistré</p> : null}
      </div>

      <Card className="sticky top-0 z-20 mb-3 rounded-2xl border-[var(--app-border)] bg-[var(--app-modal)]/95 p-2 backdrop-blur md:static md:mb-6 md:rounded-3xl">
        <div className="no-scrollbar flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible">
          {tabs.map((item) => (
            <button
              key={item}
              className={`focus-ring h-9 shrink-0 rounded-full px-3 text-xs font-black transition md:h-10 md:rounded-xl md:px-4 md:text-sm ${tab === item ? 'bg-gold-400 text-[#101820] shadow-[0_10px_24px_rgba(227,177,23,.14)]' : 'border border-transparent text-[var(--app-text-soft)] hover:border-[var(--app-border)] hover:bg-[var(--app-surface-soft)] '}`}
              onClick={() => selectSettingsTab(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </Card>

      {tab === 'Général' ? (
        <div className="grid gap-3 md:gap-6 xl:grid-cols-[1fr_0.8fr]">
          <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-4 md:rounded-3xl md:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:mb-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gold-400/12 text-[var(--app-gold-text)] md:h-11 md:w-11">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-[var(--app-text)] ">Profil agence</h2>
                  <p className="text-xs text-[var(--app-text-muted)] md:text-sm">Informations visibles dans vos documents et communications.</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:gap-4">
              <Field label="Nom de l’agence" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
              <Field label="Numéro WhatsApp" value={agencyPhone} onChange={(e) => setAgencyPhone(e.target.value)} />
              <div className="grid gap-2">
                <Field
                  label="Email"
                  value={profile?.email || ''}
                  disabled
                  readOnly
                  className="cursor-not-allowed opacity-75"
                />
                <Button type="button" variant="secondary" className="h-9 w-fit px-3 text-xs" onClick={openEmailChangeModal}>
                  Changer email
                </Button>
              </div>
              <Field label="Adresse" value={agencyAddress} onChange={(e) => setAgencyAddress(e.target.value)} placeholder="Adresse agence" />
            </div>
            <div className="mt-4 rounded-2xl border border-gold-300/25 bg-[linear-gradient(135deg,var(--app-gold-soft),var(--app-card-soft))] p-4 md:mt-5 md:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-400 text-[#101820] md:h-14 md:w-14">
                  <Camera className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div>
                  <p className="font-bold text-[var(--app-text)] ">Logo agence</p>
                  <p className="text-sm text-[var(--app-text-muted)]">Logo unique utilisé dans MekLoc, les contrats PDF et les factures.</p>
                  {logoFileName ? <p className="mt-1 text-xs text-[var(--app-gold-text)]">{logoFileName}</p> : null}
                </div>
              </div>
                <div className="grid min-h-20 min-w-44 place-items-center overflow-hidden rounded-2xl border border-[var(--app-border)] bg-white p-3 shadow-inner">
                  {logoPreviewUrl && !logoPreviewBroken ? (
                    <img
                      src={logoPreviewUrl}
                      alt="Aperçu du logo agence"
                      className="max-w-full object-contain"
                      style={{
                        width: `${Math.min(210, contractLogoWidth * 0.7)}px`,
                        height: `${Math.min(84, contractLogoHeight * 0.7)}px`,
                      }}
                      onError={() => setLogoPreviewBroken(true)}
                    />
                  ) : (
                    <div className={logoBadgeClass}>
                      <div className="grid h-full w-full place-items-center text-xl font-black text-[var(--app-gold-text)]">M</div>
                    </div>
                  )}
                </div>
              </div>
              <input
                ref={logoInputRef}
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                onChange={(event) => handleLogoUpload(event.target.files?.[0])}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => logoInputRef.current?.click()} loading={logoUploading}>
                  {logoPreviewUrl ? 'Modifier le logo' : 'Choisir le logo'}
                </Button>
                {logoPreviewUrl ? (
                  <Button type="button" variant="danger" onClick={handleRemoveLogo} loading={logoUploading}>
                    Supprimer le logo
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3 border-t border-[var(--app-border)] pt-4 sm:grid-cols-2">
                <Field
                  label="Largeur du logo dans le contrat (px)"
                  type="number"
                  min="160"
                  max="300"
                  value={contractLogoWidth}
                  onChange={(event) => setContractLogoWidth(Number(event.target.value) || 250)}
                />
                <Field
                  label="Hauteur maximale dans le contrat (px)"
                  type="number"
                  min="55"
                  max="120"
                  value={contractLogoHeight}
                  onChange={(event) => setContractLogoHeight(Number(event.target.value) || 92)}
                />
                <div className="sm:col-span-2">
                  <p className="text-xs leading-5 text-[var(--app-text-muted)]">
                    Recommandé: largeur 220–270 px et hauteur 75–100 px. Le logo conserve automatiquement ses proportions.
                  </p>
                </div>
              </div>
            </div>
          </Card>
          <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-4 md:rounded-3xl md:p-5">
            <div className="mb-4 flex items-center gap-3 md:mb-5">
              <Globe2 className="h-5 w-5 text-[var(--app-gold-text)]" />
              <h2 className="font-semibold text-[var(--app-text)] ">Paramètres de devise</h2>
            </div>
            <div className="grid gap-4">
              <SelectField label="Devise" defaultValue="MAD">
                <option>MAD</option>
                <option>EUR</option>
                <option>USD</option>
              </SelectField>
              <SelectField label="Format numérique" defaultValue="fr-MA">
                <option>fr-MA</option>
                <option>ar-MA</option>
              </SelectField>
            </div>
          </Card>
          <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-4 md:rounded-3xl md:p-5">
            <div className="mb-4 flex items-center gap-3 md:mb-5">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gold-400/12 text-[var(--app-gold-text)]">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-[var(--app-text)] ">Apparence</h2>
                <p className="text-xs text-[var(--app-text-muted)] md:text-sm">Choisissez le thème de votre espace agence.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-1.5 ">
              {[
                { value: 'dark', label: 'Mode sombre' },
                { value: 'light', label: 'Mode clair' },
              ].map((item) => {
                const active = theme === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTheme(item.value as 'dark' | 'light')}
                    className={`focus-ring min-h-11 rounded-xl px-3 text-sm font-black transition ${
                      active
                        ? 'bg-gold-400 text-[#101820] shadow-[0_10px_24px_rgba(227,177,23,.14)]'
                        : 'text-[var(--app-text-soft)] hover:bg-[var(--app-surface-soft)] hover:text-[var(--app-text)]   '
                    }`}
                    aria-pressed={active}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'Contrats' ? (
        <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
          <Card className="h-fit rounded-2xl border-gold-300/20 bg-[linear-gradient(145deg,var(--app-card),var(--app-gold-soft))] p-4 md:rounded-3xl md:p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-400 text-[#101820]">
                <FileSignature className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-[var(--app-text)]">Identité du contrat PDF</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--app-text-muted)]">
                  Ces informations sont injectées automatiquement dans l’en-tête, les clauses et le pied de page.
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-white p-4 text-[#111820] shadow-inner">
              <div className="flex min-h-20 items-center justify-center">
                {logoPreviewUrl && !logoPreviewBroken ? (
                  <img
                    src={logoPreviewUrl}
                    alt="Logo utilisé dans le contrat"
                    className="max-w-full object-contain"
                    style={{
                      width: `${Math.min(250, contractLogoWidth * 0.82)}px`,
                      height: `${Math.min(98, contractLogoHeight * 0.82)}px`,
                    }}
                    onError={() => setLogoPreviewBroken(true)}
                  />
                ) : (
                  <span className="text-sm font-bold text-slate-500">Aucun logo enregistré</span>
                )}
              </div>
              <div className="mt-3 border-t border-slate-200 pt-3 text-center">
                <p className="font-black uppercase">{agencyName || 'Nom de l’agence'}</p>
                <p className="mt-1 text-xs text-slate-600">{agencyActivityLabel || 'Location de voiture'}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-sm">
              {[
                ['Logo', logoPreviewUrl ? 'Configuré' : 'À ajouter'],
                ['Adresse', agencyAddress || 'À compléter dans Général'],
                ['Téléphone', agencyPhone || 'À compléter dans Général'],
                ['Ville', agencyCity || 'À compléter'],
                ['Identifiants légaux', agencyIce || agencyRc || agencyIfNumber || agencyCnss ? 'Configurés' : 'Optionnels'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] px-3 py-2.5">
                  <span className="font-semibold text-[var(--app-text)]">{label}</span>
                  <span className="text-right text-xs text-[var(--app-text-muted)]">{value}</span>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs leading-5 text-[var(--app-text-muted)]">
              Le logo et sa taille se modifient une seule fois dans l’onglet Général.
            </p>
          </Card>

          <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-4 md:rounded-3xl md:p-5">
            <div className="mb-4 flex items-center gap-3">
              <FileSignature className="h-5 w-5 text-[var(--app-gold-text)]" />
              <div>
                <h2 className="font-semibold text-[var(--app-text)]">Informations contrat</h2>
                <p className="text-xs text-[var(--app-text-muted)]">Uniquement les informations réellement affichées dans le PDF.</p>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Coordonnées PDF</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Activité / slogan" value={agencyActivityLabel} onChange={(event) => setAgencyActivityLabel(event.target.value)} placeholder="Location de voiture" />
                  <Field label="Ville / juridiction" value={agencyCity} onChange={(event) => setAgencyCity(event.target.value)} placeholder="Meknès" />
                  <Field label="Email agence" value={agencyEmail} onChange={(event) => setAgencyEmail(event.target.value)} placeholder="contact@agence.ma" />
                  <Field label="WhatsApp contrat" value={agencyWhatsapp} onChange={(event) => setAgencyWhatsapp(event.target.value)} placeholder="+212..." />
                  <div className="sm:col-span-2">
                    <Field label="Site web" value={agencyWebsite} onChange={(event) => setAgencyWebsite(event.target.value)} placeholder="https://..." />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[var(--app-gold-text)]">Identifiants légaux</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="ICE" value={agencyIce} onChange={(event) => setAgencyIce(event.target.value)} />
                  <Field label="RC" value={agencyRc} onChange={(event) => setAgencyRc(event.target.value)} />
                  <Field label="IF / Identifiant fiscal" value={agencyIfNumber} onChange={(event) => setAgencyIfNumber(event.target.value)} />
                  <Field label="CNSS" value={agencyCnss} onChange={(event) => setAgencyCnss(event.target.value)} />
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
                <Field label="Note de pied de page" value={agencyFooterNote} onChange={(event) => setAgencyFooterNote(event.target.value)} placeholder="Mention légale ou note de contact optionnelle" />
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'Facturation' ? (
        <div className="grid gap-3 md:gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-4 md:rounded-3xl md:p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-400/12 text-[var(--app-gold-text)]">
                <Percent className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-[var(--app-text)] ">Paramètres fiscaux</h2>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">TVA et affichage des taxes sur les factures.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
              <div className="grid gap-4">
              <Field label="Taux TVA" defaultValue="20" type="number" />
              <SelectField label="Affichage taxe facture" defaultValue="Incluse">
                <option>Incluse</option>
                <option>Exclue</option>
              </SelectField>
              </div>
            </div>
          </Card>
          <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-4 md:rounded-3xl md:p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/12 text-emerald-700 dark:text-emerald-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-[var(--app-text)] ">Facturation abonnement</h2>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">Plan actuel et méthode de règlement préférée.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
              <div className="grid gap-4">
              <SelectField label="Plan actuel" defaultValue="Pro">
                <option>Gratuit</option>
                <option>Starter</option>
                <option>Pro</option>
                <option>Business</option>
                <option>Lifetime</option>
              </SelectField>
              <SelectField label="Méthode de paiement" defaultValue="Virement bancaire">
                <option>Espèces</option>
                <option>Virement bancaire</option>
                <option>Carte</option>
              </SelectField>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'Abonnement' ? (
        <div className="grid gap-3 md:gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-0 md:rounded-3xl">
            <div className="border-b border-[var(--app-border)] bg-gradient-to-br from-gold-400/16 via-white/[0.035] to-transparent p-4 md:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Plan actuel</p>
                  <h2 className="mt-2 text-3xl font-black capitalize text-[var(--app-text)] ">{agency?.plan || 'starter'}</h2>
                  <p className="mt-1 text-sm text-[var(--app-text-muted)]">{billingTypeFr} · {displayedPlanPrice}</p>
                </div>
                <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-bold ${agency?.billingStatus === 'paid' ? 'bg-emerald-400/15 text-emerald-700 dark:text-emerald-200' : agency?.billingStatus === 'trial' ? 'bg-sky-400/15 text-sky-700 dark:text-sky-200' : agency?.billingStatus === 'overdue' ? 'bg-orange-400/15 text-orange-700 dark:text-orange-200' : agency?.billingStatus === 'unpaid' ? 'bg-rose-400/15 text-rose-700 dark:text-rose-200' : 'bg-slate-400/15 text-slate-700 dark:text-slate-200'}`}>{billingStatusFr}</span>
              </div>
            </div>
            <div className="p-4 md:p-5">
              <div className="grid gap-3 sm:grid-cols-2">
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-[var(--app-text-muted)]">Type facturation</p><p className="mt-1 font-semibold">{billingTypeFr}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-[var(--app-text-muted)]">Statut paiement</p><p className="mt-1 font-semibold">{billingStatusFr}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-[var(--app-text-muted)]">Dernier paiement</p><p className="mt-1 font-semibold">{formatBillingDate(effectiveLastPaymentDate)}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-[var(--app-text-muted)]">Prochain paiement</p><p className="mt-1 font-semibold">{formatBillingDate(agency?.nextPaymentDueDate || null)}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-[var(--app-text-muted)]">Fin d’abonnement</p><p className="mt-1 font-semibold">{formatBillingDate(effectiveSubscriptionEndDate)}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-[var(--app-text-muted)]">Méthode de paiement</p><p className="mt-1 font-semibold">{agency?.paymentMethod || 'other'}</p></div>
            </div>
            {agency?.paymentNotes ? <p className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 text-sm text-[var(--app-text-soft)]">Notes paiement: {agency.paymentNotes}</p> : null}
            </div>
          </Card>
          <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-4 md:rounded-3xl md:p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-400/12 text-sky-700 dark:text-sky-200">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-[var(--app-text)] ">Alertes abonnement</h2>
                <p className="text-sm text-[var(--app-text-muted)]">Suivi paiement, échéance et support MekLoc.</p>
              </div>
            </div>
            <div className="grid gap-3">
              {nextDiff !== null && nextDiff >= 0 && nextDiff <= 7 ? <p className="rounded-2xl border border-gold-300/25 bg-gold-400/10 p-3 text-sm text-[var(--app-gold-text)]">Votre abonnement expire bientôt. Prochain paiement le {nextPaymentDate}.</p> : null}
              {agency?.billingStatus === 'unpaid' ? <p className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm text-[var(--app-danger)]">Votre paiement est en attente. Merci de régulariser votre abonnement.</p> : null}
              {agency?.billingStatus === 'overdue' ? <p className="rounded-2xl border border-orange-300/25 bg-orange-400/10 p-3 text-sm text-orange-100">Votre abonnement est en retard. Contactez MekLoc pour éviter la suspension.</p> : null}
              {endDiff !== null && endDiff < 0 ? <p className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm text-[var(--app-danger)]">Votre abonnement a expiré.</p> : null}
            </div>
            <div className="mt-4 grid gap-2">
              <Button type="button" onClick={() => window.open(`https://wa.me/${contactPhone}`, '_blank', 'noopener,noreferrer')}>Contacter MekLoc sur WhatsApp</Button>
              <Button type="button" variant="secondary" onClick={() => window.location.href = '/pricing'}>Voir les plans</Button>
              <Button type="button" variant="secondary" onClick={downloadBillingReceipt}>Télécharger reçu</Button>
              <Button type="button" variant="secondary" onClick={() => window.location.href = `mailto:${contactEmail}?subject=Contact%20MekLoc`}>Contacter MekLoc par email</Button>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'Équipe' ? (
          <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-4 md:rounded-3xl md:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <UsersRound className="h-5 w-5 text-[var(--app-gold-text)]" />
                <h2 className="font-semibold text-[var(--app-text)] ">Gestion équipe</h2>
              </div>
              <Button
                type="button"
                icon={<UserPlus className="h-4 w-4" />}
                onClick={() => setInviteOpen(true)}
                disabled={!canManageTeam}
              >
                Inviter un membre
              </Button>
            </div>
            {teamLoading ? (
              <div className="grid gap-2">
                <div className="h-14 animate-pulse rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]" />
                <div className="h-14 animate-pulse rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-soft)]" />
              </div>
            ) : teamMembers.length ? (
              <div className="space-y-3">
                <div className="premium-surface rounded-2xl p-4 text-sm text-[var(--app-text-soft)]">
                  <p className="font-semibold text-[var(--app-text)] ">
                    {teamMembers.length} membre{teamMembers.length > 1 ? 's' : ''} dans votre agence
                  </p>
                </div>
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="premium-surface grid gap-4 rounded-2xl border border-[var(--app-border)] p-4 xl:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--app-surface-soft)] text-sm font-black text-[var(--app-gold-text)]">
                        {(member.full_name || member.email || 'U').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-[var(--app-text)] ">
                            {member.full_name || 'Utilisateur'}
                          </p>
                          {member.id === profile?.id ? (
                            <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-[11px] font-bold text-[var(--app-gold-text)]">Vous</span>
                          ) : null}
                        </div>
                        <p className="truncate text-sm text-[var(--app-text-muted)]">{member.email || 'Email non renseigné'}</p>
                        <p className="mt-1 text-xs text-[var(--app-text-muted)]">{roleFr(member.role)}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[170px_auto] xl:grid-cols-[170px_auto_auto] xl:items-center">
                      <select
                        aria-label={`Changer le rôle de ${member.full_name || member.email || 'ce membre'}`}
                        className="form-control focus-ring w-full"
                        value={normalizeTeamRole(member.role)}
                        disabled={!canManageTeam || member.id === profile?.id || Boolean(teamActionLoading[`role-${member.id}`])}
                        onChange={(event) => handleChangeMemberRole(member, event.target.value as TeamRole)}
                      >
                        {teamRoleOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <span className={`inline-flex min-h-10 items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold ${teamStatusClass(member.account_status)}`}>
                        {accountStatusFr(member.account_status)}
                      </span>
                      <div className="flex flex-wrap gap-2 lg:col-span-2 xl:col-span-1 xl:justify-end">
                        <Button
                          type="button"
                          variant="secondary"
                          icon={<Link2 className="h-4 w-4" />}
                          loading={Boolean(teamActionLoading[`link-${member.id}`])}
                          disabled={!canManageTeam || !member.email}
                          onClick={() => handleGenerateMemberLink(member)}
                        >
                          Générer lien
                        </Button>
                        <Button
                          type="button"
                          variant={member.account_status === 'suspended' || member.account_status === 'rejected' ? 'secondary' : 'danger'}
                          icon={member.account_status === 'suspended' || member.account_status === 'rejected' ? <RefreshCw className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                          loading={Boolean(teamActionLoading[`status-${member.id}`])}
                          disabled={!canManageTeam || member.id === profile?.id}
                          onClick={() => setMemberStatusTarget(member)}
                        >
                          {member.account_status === 'suspended' || member.account_status === 'rejected' ? 'Réactiver' : 'Suspendre'}
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          icon={<Trash2 className="h-4 w-4" />}
                          loading={Boolean(teamActionLoading[`delete-${member.id}`])}
                          disabled={!canManageTeam || member.id === profile?.id}
                          onClick={() => handleDeleteMember(member)}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="premium-surface rounded-2xl p-4 text-sm text-[var(--app-text-soft)]">
                Aucun membre trouvé pour cette agence.
              </div>
            )}
          </Card>
      ) : null}

      {tab === 'Notifications' ? (
        <div className="grid gap-3 md:gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-4 md:rounded-3xl md:p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-400/12 text-[var(--app-gold-text)]">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-[var(--app-text)] ">Préférences notifications</h2>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">Canal et horaire utilisés pour préparer les rappels.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4">
              <div className="grid gap-4">
              <Field label="Numéro WhatsApp" defaultValue={agencyPhone || '+212 6 00 00 00 00'} />
              <SelectField label="Heure rappel par défaut" defaultValue="09:00">
                <option>09:00</option>
                <option>12:00</option>
                <option>18:00</option>
              </SelectField>
              </div>
            </div>
          </Card>
          <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-4 md:rounded-3xl md:p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/12 text-emerald-700 dark:text-emerald-200">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-[var(--app-text)] ">Automatisation WhatsApp</h2>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">Active les boutons WhatsApp dans les écrans opérationnels.</p>
              </div>
            </div>
            <div className="grid gap-3">
              {notificationPreferenceItems.map((item) => {
                const enabled = notificationPreferences[item.key];
                return (
                <div key={item.key} className="premium-surface flex items-start justify-between gap-4 rounded-2xl border border-[var(--app-border)] p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <MessageCircle className={`h-4 w-4 ${enabled ? 'text-emerald-300' : 'text-[var(--app-text-muted)]'}`} />
                    <p className="font-bold text-[var(--app-text)] ">{item.label}</p>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">{notificationDescriptions[item.key]}</p>
                    <p className={`mt-2 text-xs font-semibold ${enabled ? 'text-emerald-300' : 'text-[var(--app-text-muted)]'}`}>{enabled ? 'Bouton WhatsApp actif' : 'Bouton WhatsApp désactivé'}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    className={`h-6 w-11 rounded-full p-1 transition ${enabled ? 'bg-gold-400' : 'bg-[var(--app-surface-soft)]'}`}
                    onClick={() => setNotificationPreferences((current) => ({ ...current, [item.key]: !current[item.key] }))}
                  >
                    <span className={`block h-4 w-4 rounded-full bg-white transition ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                );
              })}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'Sécurité' ? (
        <div className="grid gap-5">
          <Card className="overflow-hidden rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-0 md:rounded-3xl">
            <div className="border-b border-[var(--app-border)] bg-gradient-to-br from-gold-400/12 via-white/[0.03] to-transparent p-4 md:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-400/12 text-[var(--app-gold-text)]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Security Center</p>
                    <h2 className="mt-1 text-xl font-black text-[var(--app-text)] ">Sécurité du compte</h2>
                    <p className="mt-1 text-sm text-[var(--app-text-muted)]">Gérez vos accès, vos identifiants et les appareils connectés.</p>
                  </div>
                </div>
                <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={securityLoading} onClick={loadSecurityCenter}>
                  Actualiser
                </Button>
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Email compte', agencyEmail || '—'],
                ['Mot de passe', 'Protégé'],
                ['Sessions actives', String(accountSessions.filter((sessionItem) => !sessionItem.revoked_at).length)],
                ['Dernière connexion', formatSecurityDate(lastLoginAt)],
              ].map(([label, value]) => (
                <div key={label} className="min-h-[92px] rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 ">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">{label}</p>
                  <p className="mt-2 break-words text-sm font-bold text-[var(--app-text)] ">{value}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
            <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-4 md:rounded-3xl md:p-5">
              <div className="mb-4">
                <h3 className="font-bold text-[var(--app-text)] ">Actions compte</h3>
                <p className="mt-1 text-sm text-[var(--app-text-muted)]">Modifications sensibles et accès au compte.</p>
              </div>
              <div className="grid gap-3">
                <button type="button" className="focus-ring flex items-center justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-left transition hover:border-gold-300/30 hover:bg-[var(--app-surface-soft)]" onClick={openEmailChangeModal}>
                  <span><span className="block font-semibold text-[var(--app-text)] ">Changer email</span><span className="mt-1 block break-all text-xs text-[var(--app-text-muted)]">{agencyEmail || 'Email non renseigné'}</span></span>
                  <span className="text-xs font-bold text-[var(--app-gold-text)]">Modifier</span>
                </button>
                <button type="button" className="focus-ring flex items-center justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-left transition hover:border-gold-300/30 hover:bg-[var(--app-surface-soft)]" onClick={() => setPasswordChangeOpen(true)}>
                  <span><span className="block font-semibold text-[var(--app-text)] ">Changer mot de passe</span><span className="mt-1 block text-xs text-[var(--app-text-muted)]">Revalidation du mot de passe actuel requise.</span></span>
                  <span className="text-xs font-bold text-[var(--app-gold-text)]">Modifier</span>
                </button>
                <button type="button" className="focus-ring flex items-center justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-left transition hover:border-gold-300/30 hover:bg-[var(--app-surface-soft)]" onClick={() => selectSettingsTab('Général')}>
                  <span><span className="block font-semibold text-[var(--app-text)] ">Changer numéro WhatsApp</span><span className="mt-1 block text-xs text-[var(--app-text-muted)]">{agencyPhone || 'Numéro non renseigné'}</span></span>
                  <span className="text-xs font-bold text-[var(--app-gold-text)]">Général</span>
                </button>
                <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
                  <p className="font-semibold text-[var(--app-danger)]">Zone sensible</p>
                  <p className="mt-1 text-sm text-[var(--app-text-soft)]">Désactivation immédiate, suppression définitive après 30 jours.</p>
                  <Button type="button" variant="danger" className="mt-3 h-9 px-3 text-xs" onClick={() => setDeleteOpen(true)}>Supprimer mon compte</Button>
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border-[var(--app-border)] bg-[var(--app-card)] p-4 md:rounded-3xl md:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-bold text-[var(--app-text)] ">Sessions actives</h3>
                  <p className="mt-1 text-sm text-[var(--app-text-muted)]">Appareils connectés et dernière activité.</p>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  className="h-9 px-3 text-xs"
                  loading={disconnectingDevices}
                  onClick={handleDisconnectAllDevices}
                >
                  Déconnecter tous les appareils
                </Button>
              </div>
              <div className="grid gap-2">
                {accountSessions.filter((sessionItem) => !sessionItem.revoked_at).map((sessionItem) => {
                  const currentSessionKey = typeof window !== 'undefined' ? window.localStorage.getItem(sessionStorageKey) : null;
                  const isCurrentSession = Boolean(sessionItem.session_key && currentSessionKey && sessionItem.session_key === currentSessionKey);
                  return (
                    <div key={sessionItem.id} className="grid gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gold-400/10 text-[var(--app-gold-text)]">
                          <Smartphone className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-[var(--app-text)] ">{sessionDeviceLabel(sessionItem)}</p>
                            {isCurrentSession ? (
                              <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-bold text-[var(--app-gold-text)]">Session actuelle</span>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-[var(--app-text-muted)]">{sessionItem.browser || 'Navigateur'} · {sessionItem.os || 'Système'}</p>
                          <p className="truncate text-xs text-[var(--app-text-muted)]">{sessionLocationLabel(sessionItem)} · {formatSecurityDate(sessionItem.last_seen_at)}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-8 px-3 text-xs sm:justify-self-end"
                        loading={disconnectingSessionId === sessionItem.id}
                        onClick={() => handleDisconnectSession(sessionItem)}
                      >
                        Déconnecter
                      </Button>
                    </div>
                  );
                })}
                {accountSessions.filter((sessionItem) => !sessionItem.revoked_at).length === 0 ? (
                  <p className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-soft)] p-4 text-sm text-[var(--app-text-muted)]">Aucune session active enregistrée.</p>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
      <Modal open={Boolean(memberStatusTarget)} onClose={() => setMemberStatusTarget(null)} title={memberStatusTarget?.account_status === 'suspended' || memberStatusTarget?.account_status === 'rejected' ? 'Réactiver le membre' : 'Suspendre le membre'}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
            <p className="font-semibold text-[var(--app-danger)]">
              {memberStatusTarget?.account_status === 'suspended' || memberStatusTarget?.account_status === 'rejected' ? 'Ce membre retrouvera son accès.' : 'Ce membre perdra immédiatement l’accès à l’application.'}
            </p>
            <p className="mt-2 text-sm text-[var(--app-text-soft)]">
              {memberStatusTarget?.account_status === 'suspended' || memberStatusTarget?.account_status === 'rejected'
                ? 'Vérifiez que cette personne doit bien pouvoir accéder aux données de l’agence.'
                : 'Ses sessions actives seront révoquées si la gestion des sessions est disponible.'}
            </p>
          </div>
          <p className="text-sm text-[var(--app-text-soft)]">Membre: <strong>{memberStatusTarget?.full_name || memberStatusTarget?.email}</strong></p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMemberStatusTarget(null)}>Annuler</Button>
            <Button type="button" variant={memberStatusTarget?.account_status === 'suspended' || memberStatusTarget?.account_status === 'rejected' ? 'secondary' : 'danger'} onClick={confirmToggleMemberStatus}>
              {memberStatusTarget?.account_status === 'suspended' || memberStatusTarget?.account_status === 'rejected' ? 'Réactiver' : 'Suspendre'}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal open={emailChangeOpen} onClose={() => { if (!emailChanging) setEmailChangeOpen(false); }} title="Changer email">
        <div className="space-y-4">
          <p className="text-sm text-[var(--app-text-muted)]">Le nouvel email devra être confirmé avant d’être appliqué à votre compte.</p>
          <Field
            label="Nouvel email"
            name="newAccountEmail"
            type="email"
            value={newAccountEmail}
            onChange={(event) => setNewAccountEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <Field
            label="Mot de passe actuel"
            name="emailChangePassword"
            type="password"
            value={emailChangePassword}
            onChange={(event) => setEmailChangePassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={emailChanging} onClick={() => setEmailChangeOpen(false)}>Annuler</Button>
            <Button type="button" loading={emailChanging} onClick={handleChangeEmail}>Envoyer confirmation</Button>
          </div>
        </div>
      </Modal>

      <Modal open={passwordChangeOpen} onClose={() => { if (!passwordChanging) setPasswordChangeOpen(false); }} title="Changer mot de passe">
        <div className="space-y-4">
          <Field
            label="Mot de passe actuel"
            name="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <Field
            label="Nouveau mot de passe"
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
          <Field
            label="Confirmer nouveau mot de passe"
            name="confirmNewPassword"
            type="password"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={passwordChanging} onClick={() => setPasswordChangeOpen(false)}>Annuler</Button>
            <Button type="button" loading={passwordChanging} onClick={handleChangePassword}>Mettre à jour</Button>
          </div>
        </div>
      </Modal>
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Supprimer mon compte">
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
            <p className="text-sm font-semibold text-[var(--app-danger)]">Votre compte sera désactivé maintenant et supprimé définitivement après 30 jours.</p>
            <p className="mt-2 text-sm text-[var(--app-text-soft)]">Confirmez votre mot de passe actuel pour programmer la suppression. Un administrateur peut encore annuler pendant la période de grâce.</p>
          </div>
          <Field label="Mot de passe" name="deletePassword" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>Annuler</Button>
            <Button type="button" variant="danger" onClick={handleDeleteAccount}>Programmer la suppression</Button>
          </div>
        </div>
      </Modal>

      <Modal open={inviteOpen} onClose={() => { if (!inviteSending) setInviteOpen(false); }} title="Inviter un membre">
        <form className="space-y-4" onSubmit={handleInviteMember}>
          <Field
            label="Email"
            name="inviteEmail"
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            required
          />
          <Field
            label="Nom complet"
            name="inviteFullName"
            value={inviteFullName}
            onChange={(event) => setInviteFullName(event.target.value)}
          />
          <SelectField
            label="Rôle"
            value={inviteRole}
            onChange={(event) => setInviteRole(event.target.value as TeamRole)}
          >
            {teamRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectField>
          {inviteLink ? (
            <div className="rounded-2xl border border-gold-300/25 bg-gold-400/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Lien activation</p>
              <p className="mt-2 break-all text-sm text-[var(--app-text)]">{inviteLink}</p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                icon={<Mail className="h-4 w-4" />}
                onClick={() => copyActivationLink(inviteLink)}
              >
                Copier le lien
              </Button>
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)} disabled={inviteSending}>Annuler</Button>
            <Button type="submit" icon={<UserPlus className="h-4 w-4" />} loading={inviteSending}>Envoyer l’invitation</Button>
          </div>
        </form>
      </Modal>

      <Modal open={isActivationModalOpen && Boolean(generatedActivationLink)} onClose={closeActivationLinkModal} title="Lien d’activation">
        {selectedMemberForActivation && generatedActivationLink ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--app-text-soft)] ">
              Envoyez ce lien au membre pour activer son compte.
            </p>
            <div className="rounded-2xl border border-gold-300/25 bg-gold-400/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--app-gold-text)]">Membre</p>
              <p className="mt-2 text-sm font-semibold text-[var(--app-text)] ">
                {selectedMemberForActivation.full_name || selectedMemberForActivation.email || 'Membre'}
              </p>
              <p className="mt-1 break-all text-sm text-[var(--app-text-soft)]">{selectedMemberForActivation.email || 'Email non renseigné'}</p>
              <p className="mt-2 inline-flex rounded-full bg-[var(--app-surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--app-text-soft)]">
                {roleFr(selectedMemberForActivation.role)}
              </p>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--app-text-soft)] ">Lien activation</span>
              <input
                className="form-control w-full text-sm"
                value={generatedActivationLink}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={closeActivationLinkModal}>
                Fermer
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon={<ExternalLink className="h-4 w-4" />}
                onClick={() => window.open(generatedActivationLink, '_blank', 'noopener,noreferrer')}
              >
                Ouvrir le lien
              </Button>
              <Button type="button" icon={<Copy className="h-4 w-4" />} onClick={() => copyActivationLink(generatedActivationLink)}>
                Copier le lien
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={cropOpen} onClose={() => { setCropOpen(false); if (rawLogoUrl) URL.revokeObjectURL(rawLogoUrl); setRawLogoUrl(''); }} title="Ajuster le logo">
        <div className="space-y-4">
          <p className="text-sm text-[var(--app-text-soft)]">Ajustez votre logo pour qu’il apparaisse correctement dans MekLoc, les contrats et les factures.</p>
          <div
            ref={cropFrameRef}
            onPointerDown={handleCropPointerDown}
            onPointerMove={handleCropPointerMove}
            onPointerUp={handleCropPointerUp}
            onPointerCancel={handleCropPointerUp}
            className="relative mx-auto grid h-72 w-full max-w-md touch-none place-items-center overflow-hidden rounded-3xl border border-[var(--app-border)] bg-[var(--app-card-soft)]"
          >
            {rawLogoUrl ? (
              <img
                src={rawLogoUrl}
                alt="Prévisualisation logo"
                className="pointer-events-none max-h-none max-w-none select-none"
                style={{
                  transform: `translate(${cropX}px, ${cropY}px) scale(${cropScale})`,
                  width: '86%',
                  height: '86%',
                  objectFit: 'contain',
                }}
              />
            ) : null}
            <div className="pointer-events-none absolute inset-5 rounded-3xl border-2 border-gold-300/70 shadow-[0_0_0_9999px_rgba(0,0,0,.35)]" />
          </div>
          <label className="grid gap-2 text-sm text-[var(--app-text-soft)]">
            Zoom
            <input
              type="range"
              min={1}
              max={2.5}
              step={0.01}
              value={cropScale}
              onChange={(event) => setCropScale(Number(event.target.value))}
              className="w-full accent-[#D4A017]"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setCropOpen(false)}>Annuler</Button>
            <Button type="button" variant="secondary" onClick={resetCropView}>Réinitialiser</Button>
            <Button type="button" onClick={applyLogoCrop} loading={cropApplying}>Valider le logo</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
