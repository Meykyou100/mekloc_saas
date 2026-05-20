import { BellRing, Building2, Camera, Copy, ExternalLink, FileSignature, Globe2, Link2, Loader2, Mail, MessageCircle, Percent, RefreshCw, Save, ShieldAlert, ShieldCheck, Smartphone, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { Field, SelectField } from '../components/ui/Form';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
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
type SettingsTab = 'Général' | 'Contrats' | 'Facturation' | 'Abonnement' | 'Équipe' | 'Notifications';
type ActivationLinkMember = Pick<TeamMember, 'full_name' | 'email' | 'role' | 'account_status'> & { id?: string };
const settingsTabs: SettingsTab[] = ['Général', 'Contrats', 'Facturation', 'Abonnement', 'Équipe', 'Notifications'];
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

const contractSettingCards = [
  { title: 'Valeurs par défaut', text: 'Langue, modèles et règles appliqués aux nouveaux contrats.' },
  { title: 'Caution', text: 'Montant ou méthode utilisée pour sécuriser chaque location.' },
  { title: 'Retards', text: 'Frais horaires affichés clairement dans les documents client.' },
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
  if (status === 'active') return 'bg-emerald-400/15 text-emerald-200';
  if (status === 'pending') return 'bg-sky-400/15 text-sky-200';
  if (status === 'suspended') return 'bg-rose-400/15 text-rose-200';
  if (status === 'pending_deletion') return 'bg-rose-400/15 text-rose-100';
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

function sessionDeviceLabel(sessionItem: AccountSession) {
  return sessionItem.device_label || sessionItem.device_name || sessionItem.browser || 'Appareil';
}

function sessionLocationLabel(sessionItem: AccountSession) {
  if (sessionItem.location) return sessionItem.location;
  return [sessionItem.location_city, sessionItem.location_country].filter(Boolean).join(', ') || 'Localisation non disponible';
}

export default function SettingsPage() {
  const { notify } = useApp();
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
  const billingTypeFr = (agency as { billingType?: 'monthly' | 'annual' } | null)?.billingType === 'annual' ? 'Annuel' : 'Mensuel';
  const nextPaymentDate = agency?.nextPaymentDueDate || null;
  const endDate = agency?.subscriptionEndDate || null;
  const now = new Date();
  const nextDiff = nextPaymentDate ? Math.ceil((new Date(nextPaymentDate).getTime() - now.getTime()) / 86400000) : null;
  const endDiff = endDate ? Math.ceil((new Date(endDate).getTime() - now.getTime()) / 86400000) : null;
  const contactPhone = '212762971653';
  const contactEmail = 'younesmekki100@gmail.com';
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
  const [agencyEmail, setAgencyEmail] = useState(profile?.email || '');
  const [agencyPhone, setAgencyPhone] = useState(profile?.phone || '');
  const [agencyAddress, setAgencyAddress] = useState('');
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
    const basePhone = profile?.agency?.phone || profile?.phone || '';
    const baseAddress = profile?.agency?.address || '';
    const baseLogo = profile?.agency?.logoUrl || '';
    const baseNotifications = getNotificationPreferences(profile?.agency?.settings);
    return (
      agencyName !== baseName ||
      agencyPhone !== basePhone ||
      agencyAddress !== baseAddress ||
      logoPreviewUrl !== baseLogo ||
      Boolean(pendingLogoFile) ||
      notificationPreferenceItems.some((item) => notificationPreferences[item.key] !== baseNotifications[item.key])
    );
  }, [agencyAddress, agencyName, agencyPhone, logoPreviewUrl, notificationPreferences, pendingLogoFile, profile?.agency?.address, profile?.agency?.logoUrl, profile?.agency?.name, profile?.agency?.phone, profile?.agency?.settings, profile?.email, profile?.phone]);
  useEffect(() => {
    setAgencyName(profile?.agency?.name || '');
    setAgencyEmail(profile?.email || '');
    setAgencyPhone(profile?.agency?.phone || profile?.phone || '');
    setAgencyAddress(profile?.agency?.address || '');
    setLogoPreviewUrl(profile?.agency?.logoUrl || '');
    setPendingLogoFile(null);
    setLogoFileName('');
    setNotificationPreferences(getNotificationPreferences(profile?.agency?.settings));
    setSaveState('idle');
    setLogoPreviewBroken(false);
  }, [profile?.agency?.address, profile?.agency?.email, profile?.agency?.logoUrl, profile?.agency?.name, profile?.agency?.phone, profile?.agency?.settings, profile?.email, profile?.phone]);

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
      `Prochain paiement: ${agency?.nextPaymentDueDate || '-'}`,
      `Fin abonnement: ${agency?.subscriptionEndDate || '-'}`,
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
      context.fillStyle = '#111315';
      context.fillRect(0, 0, size, size);
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

      if (!safeAgencyName) {
        notify({ title: 'Champ obligatoire', message: "Le nom de l’agence est obligatoire.", type: 'warning' });
        return;
      }
      if (safeAgencyPhone && !validatePhone(safeAgencyPhone)) {
        notify({ title: 'Numéro invalide', message: 'Veuillez vérifier votre numéro WhatsApp.', type: 'warning' });
        return;
      }

      setSettingsSaving(true);
      setSaveState('saving');
      if (!supabase) throw new Error('Supabase non configuré');
      if (pendingLogoFile && agencyId) {
        await uploadAgencyLogo(agencyId, pendingLogoFile);
      }
      const agencyPayload: Record<string, unknown> = {
        name: safeAgencyName,
        address: safeAgencyAddress || null,
        phone: safeAgencyPhone || null,
        settings: {
          ...(profile?.agency?.settings || {}),
          notifications: notificationPreferences,
        },
      };
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const { error: agencyErr } = await supabase.from('agencies').update(agencyPayload).eq('id', agencyId);
        if (!agencyErr) break;
        const missingColumn = extractMissingColumnName(agencyErr.message || '');
        if (!missingColumn || !(missingColumn in agencyPayload)) throw agencyErr;
        delete agencyPayload[missingColumn];
        if (Object.keys(agencyPayload).length === 0) throw agencyErr;
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
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Paramètres"
        description="Configurez le profil agence, les contrats, la devise, la fiscalité, WhatsApp et les rôles."
        action={<div className="flex gap-2"><Button icon={settingsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} onClick={handleSaveSettings} loading={settingsSaving} disabled={!hasChanges && !settingsSaving}>{settingsSaving ? 'Enregistrement...' : 'Enregistrer'}</Button><Button variant="secondary" onClick={handleLogout}>Déconnexion</Button></div>}
      />
      <div className="mb-3">
        {saveState === 'dirty' ? <p className="text-sm text-gold-200">Modifications non enregistrées</p> : null}
        {saveState === 'saved' ? <p className="text-sm text-emerald-300">Enregistré</p> : null}
      </div>

      <Card className="mb-6 p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item}
              className={`focus-ring rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === item ? 'bg-gold-400 text-carbon-950' : 'text-carbon-300 hover:bg-white/10 light:text-carbon-700'}`}
              onClick={() => selectSettingsTab(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </Card>

      {tab === 'Général' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <Card className="p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-400/12 text-gold-200">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-white light:text-carbon-950">Profil agence</h2>
                  <p className="text-sm text-carbon-400">Informations visibles dans vos documents et communications.</p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de l’agence" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
              <Field label="Numéro WhatsApp" value={agencyPhone} onChange={(e) => setAgencyPhone(e.target.value)} />
              <div className="grid gap-2">
                <Field
                  label="Email"
                  value={agencyEmail}
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
            <div className="mt-5 grid gap-4 rounded-2xl border border-dashed border-gold-300/30 bg-gradient-to-br from-gold-400/10 via-white/[0.025] to-black/10 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gold-400 text-carbon-950">
                  <Camera className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-white light:text-carbon-950">Logo agence</p>
                  <p className="text-sm text-carbon-400">PNG, JPG, ou SVG pour contrats et factures.</p>
                  {logoFileName ? <p className="mt-1 text-xs text-gold-200">{logoFileName}</p> : null}
                </div>
              </div>
              <div className="flex items-center gap-3 lg:justify-end">
                <div className={logoBadgeClass}>
                  {logoPreviewUrl && !logoPreviewBroken ? (
                    <img
                      src={logoPreviewUrl}
                      alt="Logo agence"
                      className="h-full w-full object-contain"
                      onError={() => setLogoPreviewBroken(true)}
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xl font-black text-gold-100 light:text-carbon-950">M</div>
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
              <div className="flex flex-wrap gap-2 lg:col-span-2">
                <Button type="button" variant="secondary" onClick={() => logoInputRef.current?.click()} loading={logoUploading}>
                  {logoPreviewUrl ? 'Modifier le logo' : 'Choisir le logo'}
                </Button>
                {logoPreviewUrl ? (
                  <Button type="button" variant="danger" onClick={handleRemoveLogo} loading={logoUploading}>
                    Supprimer le logo
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#0d1117] p-4 shadow-inner light:bg-white">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-gold-200">Aperçu du logo</p>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 light:bg-carbon-950">
                <div className={logoBadgeClass}>
                  {logoPreviewUrl && !logoPreviewBroken ? (
                    <img
                      src={logoPreviewUrl}
                      alt="Aperçu logo agence"
                      className="h-full w-full object-contain"
                      onError={() => setLogoPreviewBroken(true)}
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xl font-black text-gold-100 light:text-carbon-950">M</div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-black tracking-wide text-white light:text-carbon-950">MekLoc</p>
                  <p className="max-w-[220px] text-xs leading-4 text-carbon-400">Smart Rental Management System</p>
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <Globe2 className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Paramètres de devise</h2>
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
        </div>
      ) : null}

      {tab === 'Contrats' ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-4">
            {contractSettingCards.map((item, index) => (
              <Card key={item.title} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-400/12 text-gold-200">
                    {index === 0 ? <FileSignature className="h-5 w-5" /> : index === 1 ? <ShieldCheck className="h-5 w-5" /> : <Percent className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white light:text-carbon-950">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-carbon-400">{item.text}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Card className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <FileSignature className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Paramètres contrats</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Langue contrat par défaut" defaultValue="Français">
                <option>Français</option>
                <option>العربية</option>
              </SelectField>
              <SelectField label="Règle de caution" defaultValue="Fixe">
                <option>Fixe</option>
                <option>Pourcentage</option>
                <option>Catégorie véhicule</option>
              </SelectField>
              <Field label="Caution par défaut" defaultValue="4000" type="number" />
              <Field label="Frais retard / heure" defaultValue="150" type="number" />
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'Facturation' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-5 flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-400/12 text-gold-200">
                <Percent className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-white light:text-carbon-950">Paramètres fiscaux</h2>
                <p className="mt-1 text-sm text-carbon-400">TVA et affichage des taxes sur les factures.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="grid gap-4">
              <Field label="Taux TVA" defaultValue="20" type="number" />
              <SelectField label="Affichage taxe facture" defaultValue="Incluse">
                <option>Incluse</option>
                <option>Exclue</option>
              </SelectField>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-5 flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/12 text-emerald-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-white light:text-carbon-950">Facturation abonnement</h2>
                <p className="mt-1 text-sm text-carbon-400">Plan actuel et méthode de règlement préférée.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="grid gap-4">
              <SelectField label="Plan actuel" defaultValue="Pro">
                <option>Gratuit</option>
                <option>Pro</option>
                <option>Business</option>
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
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-white/10 bg-gradient-to-br from-gold-400/16 via-white/[0.035] to-transparent p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-200">Plan actuel</p>
                  <h2 className="mt-2 text-3xl font-black capitalize text-white light:text-carbon-950">{agency?.plan || 'starter'}</h2>
                  <p className="mt-1 text-sm text-carbon-400">{billingTypeFr} · {agency?.monthlyPrice ? `${agency.monthlyPrice} MAD / mois` : '99 MAD / mois'}</p>
                </div>
                <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-bold ${agency?.billingStatus === 'paid' ? 'bg-emerald-400/15 text-emerald-200' : agency?.billingStatus === 'trial' ? 'bg-sky-400/15 text-sky-200' : agency?.billingStatus === 'overdue' ? 'bg-orange-400/15 text-orange-200' : agency?.billingStatus === 'unpaid' ? 'bg-rose-400/15 text-rose-200' : 'bg-slate-400/15 text-slate-200'}`}>{billingStatusFr}</span>
              </div>
            </div>
            <div className="p-5">
              <div className="grid gap-3 sm:grid-cols-2">
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-carbon-500">Type facturation</p><p className="mt-1 font-semibold">{billingTypeFr}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-carbon-500">Statut paiement</p><p className="mt-1 font-semibold">{billingStatusFr}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-carbon-500">Dernier paiement</p><p className="mt-1 font-semibold">{agency?.lastPaymentDate || '—'}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-carbon-500">Prochain paiement</p><p className="mt-1 font-semibold">{agency?.nextPaymentDueDate || '—'}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-carbon-500">Fin d’abonnement</p><p className="mt-1 font-semibold">{agency?.subscriptionEndDate || '—'}</p></div>
              <div className="premium-surface rounded-2xl p-4"><p className="text-xs text-carbon-500">Méthode de paiement</p><p className="mt-1 font-semibold">{agency?.paymentMethod || 'other'}</p></div>
            </div>
            {agency?.paymentNotes ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-carbon-300">Notes paiement: {agency.paymentNotes}</p> : null}
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-400/12 text-sky-200">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-white light:text-carbon-950">Alertes abonnement</h2>
                <p className="text-sm text-carbon-400">Suivi paiement, échéance et support MekLoc.</p>
              </div>
            </div>
            <div className="grid gap-3">
              {nextDiff !== null && nextDiff >= 0 && nextDiff <= 7 ? <p className="rounded-2xl border border-gold-300/25 bg-gold-400/10 p-3 text-sm text-gold-100">Votre abonnement expire bientôt. Prochain paiement le {nextPaymentDate}.</p> : null}
              {agency?.billingStatus === 'unpaid' ? <p className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm text-rose-100">Votre paiement est en attente. Merci de régulariser votre abonnement.</p> : null}
              {agency?.billingStatus === 'overdue' ? <p className="rounded-2xl border border-orange-300/25 bg-orange-400/10 p-3 text-sm text-orange-100">Votre abonnement est en retard. Contactez MekLoc pour éviter la suspension.</p> : null}
              {endDiff !== null && endDiff < 0 ? <p className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm text-rose-100">Votre abonnement a expiré.</p> : null}
            </div>
            <div className="mt-5 grid gap-2">
              <Button type="button" onClick={() => window.open(`https://wa.me/${contactPhone}`, '_blank', 'noopener,noreferrer')}>Contacter MekLoc sur WhatsApp</Button>
              <Button type="button" variant="secondary" onClick={() => window.location.href = '/pricing'}>Voir les plans</Button>
              <Button type="button" variant="secondary" onClick={downloadBillingReceipt}>Télécharger reçu</Button>
              <Button type="button" variant="secondary" onClick={() => window.location.href = `mailto:${contactEmail}?subject=Contact%20MekLoc`}>Contacter MekLoc par email</Button>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === 'Équipe' ? (
          <Card className="p-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <UsersRound className="h-5 w-5 text-gold-300" />
                <h2 className="font-semibold text-white light:text-carbon-950">Gestion équipe</h2>
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
                <div className="h-14 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
                <div className="h-14 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]" />
              </div>
            ) : teamMembers.length ? (
              <div className="space-y-3">
                <div className="premium-surface rounded-2xl p-4 text-sm text-carbon-300">
                  <p className="font-semibold text-white light:text-carbon-900">
                    {teamMembers.length} membre{teamMembers.length > 1 ? 's' : ''} dans votre agence
                  </p>
                </div>
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="premium-surface grid gap-4 rounded-2xl border border-white/10 p-4 xl:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-sm font-black text-gold-100">
                        {(member.full_name || member.email || 'U').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-white light:text-carbon-900">
                            {member.full_name || 'Utilisateur'}
                          </p>
                          {member.id === profile?.id ? (
                            <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-[11px] font-bold text-gold-100">Vous</span>
                          ) : null}
                        </div>
                        <p className="truncate text-sm text-carbon-400">{member.email || 'Email non renseigné'}</p>
                        <p className="mt-1 text-xs text-carbon-500">{roleFr(member.role)}</p>
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
              <div className="premium-surface rounded-2xl p-4 text-sm text-carbon-300">
                Aucun membre trouvé pour cette agence.
              </div>
            )}
          </Card>
      ) : null}

      {tab === 'Notifications' ? (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-5">
            <div className="mb-5 flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-400/12 text-gold-200">
                <BellRing className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-white light:text-carbon-950">Préférences notifications</h2>
                <p className="mt-1 text-sm text-carbon-400">Canal et horaire utilisés pour préparer les rappels.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
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
          <Card className="p-5">
            <div className="mb-5 flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/12 text-emerald-200">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-white light:text-carbon-950">Automatisation WhatsApp</h2>
                <p className="mt-1 text-sm text-carbon-400">Active les boutons WhatsApp dans les écrans opérationnels.</p>
              </div>
            </div>
            <div className="grid gap-3">
              {notificationPreferenceItems.map((item) => {
                const enabled = notificationPreferences[item.key];
                return (
                <div key={item.key} className="premium-surface flex items-start justify-between gap-4 rounded-2xl border border-white/10 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <MessageCircle className={`h-4 w-4 ${enabled ? 'text-emerald-300' : 'text-carbon-500'}`} />
                    <p className="font-bold text-white light:text-carbon-950">{item.label}</p>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-carbon-400">{notificationDescriptions[item.key]}</p>
                    <p className={`mt-2 text-xs font-semibold ${enabled ? 'text-emerald-300' : 'text-carbon-500'}`}>{enabled ? 'Bouton WhatsApp actif' : 'Bouton WhatsApp désactivé'}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    className={`h-6 w-11 rounded-full p-1 transition ${enabled ? 'bg-gold-400' : 'bg-white/15'}`}
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

      <Card className="mt-6 overflow-hidden p-0">
        <div className="border-b border-white/10 bg-gradient-to-br from-gold-400/12 via-white/[0.03] to-transparent p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gold-400/12 text-gold-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-200">Security Center</p>
                <h2 className="mt-1 text-xl font-black text-white light:text-carbon-950">Sécurité du compte</h2>
                <p className="mt-1 text-sm text-carbon-400">Gérez vos accès, vos identifiants et les appareils connectés.</p>
              </div>
            </div>
            <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={securityLoading} onClick={loadSecurityCenter}>
              Actualiser
            </Button>
          </div>
        </div>
        <div className="grid gap-4 p-5 xl:grid-cols-[1fr_0.95fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="premium-surface rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-carbon-500">Email compte</p>
              <p className="mt-2 break-all text-sm font-semibold text-white light:text-carbon-950">{agencyEmail || '—'}</p>
              <Button type="button" variant="secondary" className="mt-3 h-8 px-3 text-xs" onClick={openEmailChangeModal}>Changer email</Button>
            </div>
            <div className="premium-surface rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-carbon-500">Mot de passe</p>
              <p className="mt-2 text-sm text-carbon-300">Dernière mise à jour sécurisée via Supabase Auth.</p>
              <Button type="button" variant="secondary" className="mt-3 h-8 px-3 text-xs" onClick={() => setPasswordChangeOpen(true)}>Changer mot de passe</Button>
            </div>
            <div className="premium-surface rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-carbon-500">Numéro WhatsApp</p>
              <p className="mt-2 text-sm font-semibold text-white light:text-carbon-950">{agencyPhone || '—'}</p>
              <Button type="button" variant="secondary" className="mt-3 h-8 px-3 text-xs" onClick={() => selectSettingsTab('Général')}>Changer numéro WhatsApp</Button>
            </div>
            <div className="premium-surface rounded-2xl border border-rose-300/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-200">Zone sensible</p>
              <p className="mt-2 text-sm text-carbon-300">Désactivation immédiate, suppression définitive après 30 jours.</p>
              <Button type="button" variant="danger" className="mt-3 h-8 px-3 text-xs" onClick={() => setDeleteOpen(true)}>Supprimer mon compte</Button>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-carbon-950/50 p-4 light:bg-white">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-carbon-500">Sessions actives</p>
                <p className="mt-2 text-2xl font-black text-white light:text-carbon-950">{accountSessions.filter((sessionItem) => !sessionItem.revoked_at).length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-carbon-950/50 p-4 light:bg-white">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-carbon-500">Dernière connexion</p>
                <p className="mt-2 text-sm font-semibold text-white light:text-carbon-950">{formatSecurityDate(lastLoginAt)}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-carbon-950/50 p-4 light:bg-white">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-semibold text-white light:text-carbon-950">Appareils connectés</p>
                <Button
                  type="button"
                  variant="danger"
                  className="h-8 px-3 text-xs"
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
                  <div key={sessionItem.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Smartphone className="h-4 w-4 shrink-0 text-gold-200" />
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white light:text-carbon-950">{sessionDeviceLabel(sessionItem)}</p>
                          {isCurrentSession ? (
                            <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-bold text-gold-100">Session actuelle</span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-carbon-400">{sessionItem.browser || 'Navigateur'} · {sessionItem.os || 'Système'}</p>
                        <p className="truncate text-xs text-carbon-500">{sessionLocationLabel(sessionItem)}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <p className="text-xs text-carbon-500">{formatSecurityDate(sessionItem.last_seen_at)}</p>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-7 px-2 text-[11px]"
                        loading={disconnectingSessionId === sessionItem.id}
                        onClick={() => handleDisconnectSession(sessionItem)}
                      >
                        Déconnecter cet appareil
                      </Button>
                    </div>
                  </div>
                  );
                })}
                {accountSessions.filter((sessionItem) => !sessionItem.revoked_at).length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-carbon-400">Aucune session active enregistrée.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Card>
      <Modal open={Boolean(memberStatusTarget)} onClose={() => setMemberStatusTarget(null)} title={memberStatusTarget?.account_status === 'suspended' || memberStatusTarget?.account_status === 'rejected' ? 'Réactiver le membre' : 'Suspendre le membre'}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
            <p className="font-semibold text-rose-100">
              {memberStatusTarget?.account_status === 'suspended' || memberStatusTarget?.account_status === 'rejected' ? 'Ce membre retrouvera son accès.' : 'Ce membre perdra immédiatement l’accès à l’application.'}
            </p>
            <p className="mt-2 text-sm text-carbon-300">
              {memberStatusTarget?.account_status === 'suspended' || memberStatusTarget?.account_status === 'rejected'
                ? 'Vérifiez que cette personne doit bien pouvoir accéder aux données de l’agence.'
                : 'Ses sessions actives seront révoquées si la gestion des sessions est disponible.'}
            </p>
          </div>
          <p className="text-sm text-carbon-300">Membre: <strong>{memberStatusTarget?.full_name || memberStatusTarget?.email}</strong></p>
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
          <p className="text-sm text-carbon-400">Le nouvel email devra être confirmé avant d’être appliqué à votre compte.</p>
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
            <p className="text-sm font-semibold text-rose-100">Votre compte sera désactivé maintenant et supprimé définitivement après 30 jours.</p>
            <p className="mt-2 text-sm text-carbon-300">Confirmez votre mot de passe actuel pour programmer la suppression. Un administrateur peut encore annuler pendant la période de grâce.</p>
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-200">Lien activation</p>
              <p className="mt-2 break-all text-sm text-carbon-100">{inviteLink}</p>
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
            <p className="text-sm text-carbon-300 light:text-carbon-600">
              Envoyez ce lien au membre pour activer son compte.
            </p>
            <div className="rounded-2xl border border-gold-300/25 bg-gold-400/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-200">Membre</p>
              <p className="mt-2 text-sm font-semibold text-white light:text-carbon-950">
                {selectedMemberForActivation.full_name || selectedMemberForActivation.email || 'Membre'}
              </p>
              <p className="mt-1 break-all text-sm text-carbon-300">{selectedMemberForActivation.email || 'Email non renseigné'}</p>
              <p className="mt-2 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-carbon-200">
                {roleFr(selectedMemberForActivation.role)}
              </p>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-carbon-200 light:text-carbon-700">Lien activation</span>
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
          <p className="text-sm text-carbon-300">Ajustez votre logo pour qu’il apparaisse correctement dans MekLoc, les contrats et les factures.</p>
          <div
            ref={cropFrameRef}
            onPointerDown={handleCropPointerDown}
            onPointerMove={handleCropPointerMove}
            onPointerUp={handleCropPointerUp}
            onPointerCancel={handleCropPointerUp}
            className="relative mx-auto grid h-72 w-full max-w-md touch-none place-items-center overflow-hidden rounded-3xl border border-white/10 bg-[#0e1218]"
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
          <label className="grid gap-2 text-sm text-carbon-300">
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
