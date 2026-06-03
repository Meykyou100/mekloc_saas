import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getRoleLabel } from '../lib/permissions';

export type UserProfile = {
  id: string;
  agencyId: string | null;
  fullName: string;
  email: string;
  phone: string;
  role: 'owner' | 'manager' | 'agent' | 'accountant';
  accountStatus: AccountStatus;
  deletionRequestedAt: string | null;
  deletionScheduledAt: string | null;
  isSuperAdmin: boolean;
  agency: AgencySubscription | null;
};

export type AccountStatus = 'pending' | 'active' | 'rejected' | 'suspended' | 'pending_deletion';
export type AgencyPlan = 'starter' | 'pro' | 'business' | 'lifetime';
export type BillingStatus = 'trial' | 'paid' | 'unpaid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'other';

export type AgencySubscription = {
  id: string;
  name: string;
  logoPath?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  ice?: string | null;
  rc?: string | null;
  plan: AgencyPlan;
  billingStatus: BillingStatus;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  lastPaymentDate: string | null;
  nextPaymentDueDate: string | null;
  billingType?: 'monthly' | 'annual' | 'lifetime';
  monthlyPrice: number;
  annualPrice?: number;
  paymentMethod: PaymentMethod;
  paymentNotes: string;
  createdAt: string;
  settings?: Record<string, unknown>;
};

type SignUpInput = {
  email: string;
  password: string;
  agencyName: string;
  fullName?: string;
  phone?: string;
};

type AuthActionResult = {
  needsEmailConfirmation?: boolean;
  profile?: UserProfile | null;
  approvedProfileRepairNeeded?: boolean;
};

type AuthContextValue = {
  isSupabaseEnabled: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  profileLoadError: string | null;
  agencyId: string | null;
  loading: boolean;
  isInitialized: boolean;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signInWithGoogle: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<AuthActionResult>;
  createAgencyProfile: (agencyName: string, fullName?: string, phone?: string) => Promise<UserProfile>;
  refreshProfile: () => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  deleteAccountWithPassword: (password: string) => Promise<void>;
  recoverActivationSession: () => Promise<boolean>;
  updatePassword: (password: string) => Promise<void>;
  getAccessRequestStatusByEmail: (email: string) => Promise<{ status: string; agencyName: string; plan: string; createdAt: string } | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const demoAuthKey = 'mekloc-demo-auth';
const sessionStorageKey = 'mekloc_session_id';
const deviceStorageKey = 'mekloc_device_id';
const sessionStartedAtKey = 'mekloc_session_started_at';
const demoEmail = 'demo@mekloc.ma';
const demoPassword = 'demo123456';
const allowDemoMode = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';
const authRequestTimeoutMs = 12000;

type ProfileRow = {
  id: string;
  agency_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  account_status: AccountStatus;
  deletion_requested_at: string | null;
  deletion_scheduled_at: string | null;
  is_super_admin: boolean;
  agencies: AgencyRow | AgencyRow[] | null;
};

type AgencyRow = {
  id: string;
  name: string;
  logo_path: string | null;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  ice?: string | null;
  rc?: string | null;
  plan: AgencyPlan | null;
  billing_status: BillingStatus | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  last_payment_date: string | null;
  next_payment_due_date: string | null;
  billing_type?: 'monthly' | 'annual' | 'lifetime' | null;
  monthly_price: number | null;
  annual_price?: number | null;
  payment_method: PaymentMethod | null;
  payment_notes: string | null;
  created_at: string;
  settings?: Record<string, unknown> | null;
};

const demoAgency: AgencySubscription = {
  id: 'demo-agency',
  name: 'Atlas Rent Marrakech',
  plan: 'pro',
  billingStatus: 'trial',
  subscriptionStartDate: '2026-05-01',
  subscriptionEndDate: '2026-06-01',
  lastPaymentDate: '2026-05-01',
  nextPaymentDueDate: '2026-06-01',
  monthlyPrice: 250,
  paymentMethod: 'bank_transfer',
  paymentNotes: 'Local demo account with mock operational data.',
  createdAt: '2026-05-01',
};

const demoProfile: UserProfile = {
  id: 'demo-user',
  agencyId: 'demo-agency',
  fullName: 'MekLoc Demo Owner',
  email: demoEmail,
  phone: '+212 6 00 00 00 00',
  role: 'owner',
  accountStatus: 'active',
  deletionRequestedAt: null,
  deletionScheduledAt: null,
  isSuperAdmin: false,
  agency: demoAgency,
};

const demoUser = {
  id: 'demo-user',
  email: demoEmail,
  user_metadata: { full_name: 'MekLoc Demo Owner' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2026-05-01T00:00:00.000Z',
} as User;

const demoSession = {
  access_token: 'demo-access-token',
  refresh_token: 'demo-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: demoUser,
} as Session;

function mapAgency(row: AgencyRow | AgencyRow[] | null): AgencySubscription | null {
  const agency = Array.isArray(row) ? row[0] : row;
  if (!agency) return null;

  return {
    id: agency.id,
    name: agency.name,
    logoPath: agency.logo_path || null,
    logoUrl: agency.logo_url || null,
    address: agency.address || null,
    phone: agency.phone || null,
    email: agency.email || null,
    ice: agency.ice || null,
    rc: agency.rc || null,
    plan: agency.plan || 'starter',
    billingStatus: agency.billing_status || 'trial',
    subscriptionStartDate: agency.subscription_start_date,
    subscriptionEndDate: agency.subscription_end_date,
    lastPaymentDate: agency.last_payment_date,
    nextPaymentDueDate: agency.next_payment_due_date,
    billingType: agency.billing_type || 'monthly',
    monthlyPrice: Number(agency.monthly_price ?? 0),
    annualPrice: Number(agency.annual_price ?? 0),
    paymentMethod: agency.payment_method || 'other',
    paymentNotes: agency.payment_notes || '',
    createdAt: agency.created_at,
    settings: agency.settings || {},
  };
}

function mapProfile(row: ProfileRow): UserProfile {
  const agency = mapAgency(row.agencies);

  return {
    id: row.id,
    agencyId: row.agency_id || agency?.id || null,
    fullName: row.full_name || 'MekLoc User',
    email: row.email || '',
    phone: row.phone || '',
    role: getRoleLabel(row.role),
    accountStatus: row.account_status || 'pending',
    deletionRequestedAt: row.deletion_requested_at || null,
    deletionScheduledAt: row.deletion_scheduled_at || null,
    isSuperAdmin: Boolean(row.is_super_admin),
    agency,
  };
}

const profileSelect = `
  id,
  agency_id,
  full_name,
  email,
  phone,
  role,
  account_status,
  deletion_requested_at,
  deletion_scheduled_at,
  is_super_admin,
  agencies (*)
`;

async function fetchAgencyById(agencyId: string): Promise<AgencyRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('id', agencyId)
    .maybeSingle();
  if (error) throw error;
  return data as AgencyRow | null;
}

async function fetchProfile(userId: string, email?: string | null): Promise<UserProfile | null> {
  if (!supabase) return null;

  const normalizedEmail = email ? normalizeEmail(email) : '';
  if (import.meta.env.DEV) {
    console.log('MekLoc profile loader: start', { userId, email: normalizedEmail || null });
  }

  const byId = await supabase
    .from('users_profiles')
    .select(profileSelect)
    .eq('id', userId)
    .maybeSingle();

  if (byId.error) throw byId.error;

  let data = byId.data;
  if (!data && normalizedEmail) {
    const byEmail = await supabase
      .from('users_profiles')
      .select(profileSelect)
      .ilike('email', normalizedEmail)
      .maybeSingle();
    if (byEmail.error) throw byEmail.error;
    data = byEmail.data;
    if (import.meta.env.DEV) {
      console.log('MekLoc profile loader: email fallback', {
        userId,
        email: normalizedEmail,
        profileFound: Boolean(data),
        profileId: (data as ProfileRow | null)?.id,
      });
    }
  }

  if (!data) {
    if (import.meta.env.DEV) {
      console.log('MekLoc profile loader: profile not found', { userId, email: normalizedEmail || null });
    }
    return null;
  }

  const row = data as ProfileRow;
  if (row.id === userId && normalizedEmail && normalizeEmail(row.email || '') !== normalizedEmail) {
    const { error: syncEmailError } = await supabase
      .from('users_profiles')
      .update({ email: normalizedEmail })
      .eq('id', row.id);
    if (!syncEmailError) row.email = normalizedEmail;
  }
  let agency = Array.isArray(row.agencies) ? row.agencies[0] : row.agencies;
  if (!agency && row.agency_id) {
    agency = await fetchAgencyById(row.agency_id);
    row.agencies = agency;
  }
  if (row.id === userId && normalizedEmail && agency?.id && normalizeEmail(agency.email || '') !== normalizedEmail) {
    const { error: syncAgencyEmailError } = await supabase
      .from('agencies')
      .update({ email: normalizedEmail })
      .eq('id', agency.id);
    if (!syncAgencyEmailError) agency.email = normalizedEmail;
  }
  if (import.meta.env.DEV) {
    console.log('MekLoc profile loader: result', {
      authUserId: userId,
      authEmail: normalizedEmail || null,
      profileRow: {
        id: row.id,
        email: row.email,
        agency_id: row.agency_id,
        account_status: row.account_status,
        role: row.role,
      },
      agencyId: row.agency_id,
      agencyFound: Boolean(agency),
      redirectReason: row.agency_id && row.account_status === 'active' && agency ? 'active_profile_ready' : 'profile_missing_agency_or_inactive',
    });
  }
  if (agency?.logo_path) {
    const candidateBuckets = ['logos', 'agency-assets'];
    let resolvedLogoUrl: string | null = null;
    for (const bucket of candidateBuckets) {
      const signed = await supabase.storage.from(bucket).createSignedUrl(agency.logo_path, 60 * 60);
      if (!signed.error && signed.data?.signedUrl) {
        resolvedLogoUrl = signed.data.signedUrl;
        break;
      }
    }
    if (resolvedLogoUrl) {
      agency.logo_url = resolvedLogoUrl;
    }
  }

  return mapProfile(row);
}

function fetchProfileWithTimeout(userId: string, email?: string | null) {
  return withTimeout(fetchProfile(userId, email), authRequestTimeoutMs, 'Chargement du profil trop long.');
}

async function hasApprovedAccessRequest(email: string | null | undefined): Promise<boolean> {
  if (!supabase || !email) return false;
  const normalized = normalizeEmail(email);
  const { data, error } = await supabase
    .from('access_requests')
    .select('id')
    .eq('email', normalized)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

async function repairApprovedProfile(): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke('repair-approved-profile');
  if (error) throw error;
  const repaired = data as { success?: boolean; repaired?: boolean; agency_id?: string; agencyId?: string; profile_id?: string; profileId?: string; error?: string };
  if (!repaired?.success) throw new Error(repaired?.error || 'Réparation du profil impossible.');
  if (import.meta.env.DEV) {
    console.log('MekLoc repair-approved-profile response', {
      repaired: repaired.repaired,
      agencyId: repaired.agency_id || repaired.agencyId,
      profileId: repaired.profile_id || repaired.profileId,
    });
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError || new Error('Session utilisateur introuvable.');
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  return fetchProfile(userData.user.id, userData.user.email);
}

async function isDeletedByEmail(email: string | null | undefined): Promise<boolean> {
  if (!supabase || !email) return false;
  const { data, error } = await supabase.rpc('is_deleted_account', { target_email: email });
  if (error) return false;
  return Boolean(data);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function formatPendingDeletionDate(value: string | null | undefined) {
  if (!value) return 'la date prévue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'la date prévue';
  return date.toLocaleDateString('fr-MA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function pendingDeletionMessage(profile: UserProfile) {
  return `Ce compte est en cours de suppression. Suppression définitive prévue le ${formatPendingDeletionDate(profile.deletionScheduledAt)}. Contactez l’administrateur pour annuler.`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}

function getUrlAuthParams() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  return {
    code: url.searchParams.get('code'),
    tokenHash: hash.get('token_hash') || url.searchParams.get('token_hash'),
    type: hash.get('type') || url.searchParams.get('type'),
    accessToken: hash.get('access_token') || url.searchParams.get('access_token'),
    refreshToken: hash.get('refresh_token') || url.searchParams.get('refresh_token'),
    errorDescription: hash.get('error_description') || url.searchParams.get('error_description'),
  };
}

async function waitForRecoveredSession() {
  if (!supabase) return null;

  const initial = await supabase.auth.getSession();
  if (initial.data.session) return initial.data.session;

  const { code, tokenHash, type, accessToken, refreshToken, errorDescription } = getUrlAuthParams();
  if (errorDescription) throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));

  if (code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) throw exchanged.error;
    if (exchanged.data.session) return exchanged.data.session;
  }

  if (accessToken && refreshToken) {
    const restored = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (restored.error) throw restored.error;
    if (restored.data.session) return restored.data.session;
  }

  if (tokenHash && (type === 'recovery' || type === 'invite')) {
    const verified = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (verified.error) throw verified.error;
    if (verified.data.session) return verified.data.session;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < 3500) {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const next = await supabase.auth.getSession();
    if (next.data.session) return next.data.session;
  }

  return null;
}

function getOrCreateSessionKey() {
  const existing = localStorage.getItem(sessionStorageKey);
  if (existing) return existing;
  const next = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(sessionStorageKey, next);
  return next;
}

function getOrCreateDeviceId() {
  const existing = localStorage.getItem(deviceStorageKey);
  if (existing) return existing;
  const next = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  localStorage.setItem(deviceStorageKey, next);
  return next;
}

function getOrCreateSessionStartedAt() {
  const existing = localStorage.getItem(sessionStartedAtKey);
  if (existing) return existing;
  const nowIso = new Date().toISOString();
  localStorage.setItem(sessionStartedAtKey, nowIso);
  return nowIso;
}

function parseDevice(userAgent: string) {
  const ua = userAgent || '';
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /chrome\//i.test(ua) && !/edg\//i.test(ua)
      ? 'Chrome'
      : /safari/i.test(ua) && !/chrome/i.test(ua)
        ? 'Safari'
        : /firefox/i.test(ua)
          ? 'Firefox'
          : 'Navigateur';

  const os = /iphone|ipad|ios/i.test(ua)
    ? 'iOS'
    : /android/i.test(ua)
      ? 'Android'
      : /mac os x|macintosh/i.test(ua)
        ? 'macOS'
        : /windows/i.test(ua)
          ? 'Windows'
          : /linux/i.test(ua)
            ? 'Linux'
            : 'Système';

  const deviceType = /iphone/i.test(ua)
    ? 'iPhone'
    : /ipad/i.test(ua)
      ? 'iPad'
      : /android/i.test(ua)
        ? 'Android'
        : /macintosh|mac os x/i.test(ua)
          ? 'MacBook'
          : /windows/i.test(ua)
            ? 'PC Windows'
            : 'Appareil';

  return { browser, os, deviceName: deviceType, deviceType };
}

function createSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

async function createAgencyAndProfile(
  user: User,
  agencyName: string,
  fullName?: string,
  phone?: string,
): Promise<UserProfile> {
  if (!supabase) throw new Error('Supabase is not configured.');

  const today = new Date();
  const trialEnd = addDays(today, 14);

  const { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .insert({
      name: agencyName,
      slug: `${createSlug(agencyName)}-${Date.now().toString().slice(-5)}`,
      created_by: user.id,
      plan: 'starter',
      billing_status: 'trial',
      subscription_start_date: today.toISOString().slice(0, 10),
      subscription_end_date: trialEnd,
      next_payment_due_date: trialEnd,
      monthly_price: 0,
      payment_method: 'other',
    })
    .select('id')
    .single();

  if (agencyError) {
    throw new Error(
      `${agencyError.message}. If email confirmations are enabled, confirm the user first or disable confirmations for local testing.`,
    );
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('users_profiles')
    .insert({
      id: user.id,
      agency_id: (agency as { id: string }).id,
      full_name: fullName || user.user_metadata?.full_name || agencyName,
      email: user.email || '',
      phone: phone || '',
      role: 'owner',
      account_status: 'pending',
      is_super_admin: false,
    })
    .select(`
      id,
      agency_id,
      full_name,
      email,
      phone,
      role,
      account_status,
      is_super_admin,
      agencies (*)
    `)
    .single();

  if (profileError) throw profileError;
  return mapProfile(profileRow as ProfileRow);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [isDemoSession, setIsDemoSession] = useState(() => allowDemoMode && localStorage.getItem(demoAuthKey) === 'true');
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [isInitialized, setIsInitialized] = useState(!isSupabaseConfigured);
  const lastSeenUpdateRef = useRef<number>(0);
  const lastRevocationCheckRef = useRef<number>(0);
  const hasCompletedInitialLoadRef = useRef(false);

  async function syncSessionActivity(currentUser: User, currentProfile: UserProfile | null, options?: { isLogin?: boolean }) {
    if (!supabase || !currentProfile?.agencyId) return;
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const minGapMs = 5 * 60 * 1000;
    const shouldSkipSeenUpdate = !options?.isLogin && nowMs - lastSeenUpdateRef.current < minGapMs;

    try {
      if (!shouldSkipSeenUpdate) {
        const profilePatch: Record<string, string> = { last_seen_at: nowIso };
        if (options?.isLogin) profilePatch.last_login_at = nowIso;
        await supabase.from('users_profiles').update(profilePatch).eq('id', currentUser.id);
        lastSeenUpdateRef.current = nowMs;
      }

      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      const { browser, os, deviceName, deviceType } = parseDevice(ua);
      const sessionKey = getOrCreateSessionKey();
      const deviceId = getOrCreateDeviceId();
      const upsertPayload = {
        user_id: currentUser.id,
        agency_id: currentProfile.agencyId,
        device_id: deviceId,
        session_key: sessionKey,
        device_name: deviceName,
        device_label: `${deviceName} · ${browser} · ${os}`,
        device_type: deviceType,
        browser,
        os,
        user_agent: ua,
        last_seen_at: nowIso,
        last_activity_at: nowIso,
        ...(options?.isLogin ? { revoked_at: null } : {}),
      };

      const { data: existing, error: existingError } = await supabase
        .from('user_sessions')
        .select('id,revoked_at')
        .eq('user_id', currentUser.id)
        .eq('device_id', deviceId)
        .maybeSingle();

      if (!existingError && existing?.id) {
        if (existing.revoked_at && !options?.isLogin) return;
        await supabase.from('user_sessions').update(upsertPayload).eq('id', existing.id);
      } else {
        await supabase.from('user_sessions').insert({
          ...upsertPayload,
          revoked_at: null,
          first_seen_at: nowIso,
        });
      }
    } catch {
      // Keep login/session flow resilient even if activity tracking table is not applied yet.
    }
  }

  async function checkRevokedSession(currentUser: User) {
    if (!supabase) return;
    const sessionKey = localStorage.getItem(sessionStorageKey);
    if (!sessionKey) return;
    const nowMs = Date.now();
    if (nowMs - lastRevocationCheckRef.current < 2 * 60 * 1000) return;
    lastRevocationCheckRef.current = nowMs;
    try {
      const { data } = await supabase
        .from('user_sessions')
        .select('revoked_at')
        .eq('user_id', currentUser.id)
        .eq('session_key', sessionKey)
        .maybeSingle();
      if (data?.revoked_at) {
        await supabase.auth.signOut();
        localStorage.removeItem(sessionStorageKey);
        localStorage.removeItem(sessionStartedAtKey);
        window.location.href = '/auth?revoked=1';
        return;
      }

      const startedAt = getOrCreateSessionStartedAt();
      const { data: profileRow, error: profileErr } = await supabase
        .from('users_profiles')
        .select('force_logout_at')
        .eq('id', currentUser.id)
        .maybeSingle();
      if (!profileErr && profileRow?.force_logout_at && new Date(profileRow.force_logout_at).getTime() > new Date(startedAt).getTime()) {
        await supabase.auth.signOut();
        localStorage.removeItem(sessionStorageKey);
        localStorage.removeItem(sessionStartedAtKey);
        window.location.href = '/auth?revoked=1';
      }
    } catch {
      // silent check; if table/policy unavailable we keep app usable.
    }
  }

  useEffect(() => {
    if (!allowDemoMode && localStorage.getItem(demoAuthKey)) {
      localStorage.removeItem(demoAuthKey);
    }
    if (isDemoSession) {
      setSession(demoSession);
      setUser(demoUser);
      setProfile(demoProfile);
      setProfileLoadError(null);
      setIsInitialized(true);
      setLoading(false);
      return undefined;
    }

    if (!supabase) {
      setIsInitialized(true);
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    async function loadInitialSession() {
      setIsInitialized(false);
      try {
        const { data, error } = await withTimeout(
          supabase!.auth.getSession(),
          authRequestTimeoutMs,
          'Vérification de session trop longue.',
        );
        if (!mounted) return;
        if (error) return;

        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          const nextProfile = await fetchProfileWithTimeout(data.session.user.id, data.session.user.email);
          if (!mounted) return;
          setProfile(nextProfile);
          setProfileLoadError(null);
          if (nextProfile) {
            await syncSessionActivity(data.session.user, nextProfile);
            await checkRevokedSession(data.session.user);
          }
        } else {
          setProfile(null);
          setProfileLoadError(null);
        }
      } catch (error) {
        if (mounted) setProfileLoadError(error instanceof Error ? error.message : 'Chargement du profil impossible.');
      } finally {
        hasCompletedInitialLoadRef.current = true;
        if (mounted) setIsInitialized(true);
        setLoading(false);
      }
    }

    loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        const shouldBlockUi = !hasCompletedInitialLoadRef.current || event === 'SIGNED_IN';
        if (shouldBlockUi) setLoading(true);
        fetchProfileWithTimeout(nextSession.user.id, nextSession.user.email)
          .then((nextProfile) => {
            if (mounted) {
              setProfile(nextProfile);
              setProfileLoadError(null);
              syncSessionActivity(nextSession.user, nextProfile, { isLogin: event === 'SIGNED_IN' }).catch(() => undefined);
              checkRevokedSession(nextSession.user).catch(() => undefined);
            }
          })
          .catch((error) => {
            if (mounted) {
              setProfileLoadError(error instanceof Error ? error.message : 'Chargement du profil impossible.');
            }
          })
          .finally(() => {
            if (mounted && shouldBlockUi) {
              hasCompletedInitialLoadRef.current = true;
              setIsInitialized(true);
              setLoading(false);
            }
          });
      } else {
        setProfile(null);
        setProfileLoadError(null);
        hasCompletedInitialLoadRef.current = true;
        setIsInitialized(true);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isDemoSession]);

  useEffect(() => {
    if (!supabase || !session?.user || !profile) return;
    syncSessionActivity(session.user, profile).catch(() => undefined);
    const interval = window.setInterval(() => {
      syncSessionActivity(session.user, profile).catch(() => undefined);
      checkRevokedSession(session.user).catch(() => undefined);
    }, 2 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [session?.user, profile?.agencyId, profile?.agency?.id]);

  useEffect(() => {
    if (!supabase || !session?.user || !profile) return undefined;
    const client = supabase;
    let cancelled = false;

    const refreshOnReturn = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const { data, error } = await withTimeout(
          client.auth.getSession(),
          authRequestTimeoutMs,
          'Vérification de session trop longue.',
        );
        if (cancelled || error) return;
        if (!data.session) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setProfileLoadError(null);
          return;
        }
        setSession(data.session);
        setUser(data.session.user);
        const nextProfile = await fetchProfileWithTimeout(data.session.user.id, data.session.user.email);
        if (cancelled) return;
        setProfile(nextProfile);
        setProfileLoadError(null);
        if (nextProfile) {
          await syncSessionActivity(data.session.user, nextProfile);
          await checkRevokedSession(data.session.user);
        }
      } catch {
        // Temporary network or browser-tab throttling failure: keep the current UI/session visible.
      }
    };

    document.addEventListener('visibilitychange', refreshOnReturn);
    window.addEventListener('focus', refreshOnReturn);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', refreshOnReturn);
      window.removeEventListener('focus', refreshOnReturn);
    };
  }, [session?.user, profile?.agencyId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isSupabaseEnabled: isSupabaseConfigured && !isDemoSession,
      session,
      user,
      profile,
      profileLoadError,
      agencyId: profile?.agencyId || profile?.agency?.id || null,
      loading,
      isInitialized,
      signIn: async (email, password) => {
        if (allowDemoMode && email.trim().toLowerCase() === demoEmail && password === demoPassword) {
          localStorage.setItem(demoAuthKey, 'true');
          setIsDemoSession(true);
          setSession(demoSession);
          setUser(demoUser);
          setProfile(demoProfile);
          setProfileLoadError(null);
          setIsInitialized(true);
          setLoading(false);
          return { profile: demoProfile };
        }

        if (!supabase) return {};

        setLoading(true);
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;

          setSession(data.session);
          setUser(data.user);
          setProfileLoadError(null);
          localStorage.setItem(sessionStartedAtKey, new Date().toISOString());
          if (import.meta.env.DEV) {
            console.log('MekLoc login: auth user', {
              userId: data.user?.id,
              email: data.user?.email,
            });
          }
          const deleted = await isDeletedByEmail(data.user?.email);
          if (deleted) {
            await supabase.auth.signOut();
            throw new Error('Ce compte a été supprimé. Contactez MekLoc pour réactivation.');
          }
          let nextProfile = data.user ? await fetchProfile(data.user.id, data.user.email) : null;
          if (import.meta.env.DEV) {
            console.log('MekLoc login: profile lookup', {
              userId: data.user?.id,
              profileFound: Boolean(nextProfile),
              profileId: nextProfile?.id,
              agencyId: nextProfile?.agencyId,
              agencyFound: Boolean(nextProfile?.agency),
              accountStatus: nextProfile?.accountStatus,
            });
          }

          if (nextProfile?.accountStatus === 'pending_deletion') {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            setProfileLoadError(null);
            throw new Error(pendingDeletionMessage(nextProfile));
          }

          // Self-heal legacy rows: if approved request exists but profile still pending,
          // activate the current profile automatically.
          if (
            supabase &&
            nextProfile &&
            nextProfile.accountStatus !== 'active' &&
            data.user?.email &&
            await hasApprovedAccessRequest(data.user.email)
          ) {
            const { error: activateError } = await supabase
              .from('users_profiles')
              .update({ account_status: 'active' })
              .eq('id', nextProfile.id);
            if (!activateError) {
              nextProfile = await fetchProfile(data.user.id, data.user.email);
              if (import.meta.env.DEV) {
                console.log('MekLoc login: profile auto-activated from approved access request', {
                  userId: data.user.id,
                  profileId: nextProfile?.id,
                  agencyId: nextProfile?.agencyId,
                });
              }
            }
          }

          if (!nextProfile && data.user?.email && await hasApprovedAccessRequest(data.user.email)) {
            if (import.meta.env.DEV) {
              console.log('MekLoc login: approved access without profile, attempting repair', {
                userId: data.user.id,
                email: data.user.email,
              });
            }
            try {
              nextProfile = await repairApprovedProfile();
              if (import.meta.env.DEV) {
                console.log('MekLoc login: approved profile repair result', {
                  userId: data.user.id,
                  profileFound: Boolean(nextProfile),
                  agencyId: nextProfile?.agencyId,
                  agencyFound: Boolean(nextProfile?.agency),
                  accountStatus: nextProfile?.accountStatus,
                });
              }
            } catch (repairError) {
              if (import.meta.env.DEV) {
                console.log('MekLoc login: approved profile repair failed', {
                  userId: data.user.id,
                  error: repairError instanceof Error ? repairError.message : repairError,
                });
              }
              return { profile: null, approvedProfileRepairNeeded: true };
            }
          }

          if (nextProfile?.accountStatus === 'pending_deletion') {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            setProfileLoadError(null);
            throw new Error(pendingDeletionMessage(nextProfile));
          }

          setProfile(nextProfile);
          setProfileLoadError(null);
          if (data.user && nextProfile) {
            await syncSessionActivity(data.user, nextProfile, { isLogin: true });
            await checkRevokedSession(data.user);
          }
          return { profile: nextProfile };
        } finally {
          setLoading(false);
        }
      },
      signInWithGoogle: async () => {
        if (!supabase) return;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (error) throw error;
      },
      signUp: async ({ email, password, agencyName, fullName, phone }) => {
        if (!supabase) return {};

        setLoading(true);
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                agency_name: agencyName,
                full_name: fullName || agencyName,
                phone: phone || '',
              },
            },
          });
          if (error) throw error;
          if (!data.user) throw new Error('Supabase did not return a new user.');

          if (!data.session) {
            setSession(null);
            setUser(data.user);
            setProfile(null);
            setProfileLoadError(null);
            return { needsEmailConfirmation: true };
          }

          const nextProfile = await createAgencyAndProfile(data.user, agencyName, fullName || agencyName, phone);

          setSession(data.session);
          setUser(data.user);
          setProfile(nextProfile);
          setProfileLoadError(null);
          return {};
        } finally {
          setLoading(false);
        }
      },
      createAgencyProfile: async (agencyName, fullName, phone) => {
        if (!user) throw new Error('You must be signed in before creating an agency.');
        setLoading(true);
        try {
          const nextProfile = await createAgencyAndProfile(user, agencyName, fullName, phone);
          setProfile(nextProfile);
          setProfileLoadError(null);
          return nextProfile;
        } finally {
          setLoading(false);
        }
      },
      refreshProfile: async () => {
        if (isDemoSession) return demoProfile;
        if (!supabase) return null;
        const activeUser = user ?? (await supabase.auth.getUser()).data.user;
        if (!activeUser) return null;
        const deleted = await isDeletedByEmail(activeUser.email);
        if (deleted) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsInitialized(true);
          throw new Error('Ce compte a été supprimé. Contactez MekLoc pour réactivation.');
        }
        try {
          const nextProfile = await fetchProfile(activeUser.id, activeUser.email);
          setProfile(nextProfile);
          setProfileLoadError(null);
          return nextProfile;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Chargement du profil impossible.';
          setProfileLoadError(message);
          throw error;
        }
      },
      signOut: async () => {
        if (isDemoSession) {
          localStorage.removeItem(demoAuthKey);
          setIsDemoSession(false);
          setSession(null);
          setUser(null);
          setProfile(null);
          setProfileLoadError(null);
          setIsInitialized(true);
          localStorage.removeItem(sessionStartedAtKey);
          return;
        }
        if (!supabase) return;
        localStorage.removeItem(sessionStorageKey);
        localStorage.removeItem(sessionStartedAtKey);
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileLoadError(null);
        setIsInitialized(true);
      },
      requestPasswordReset: async (email: string) => {
        if (!supabase) throw new Error('Supabase non configuré.');
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/set-password`,
        });
        if (error) throw error;
      },
      deleteAccountWithPassword: async (password: string) => {
        if (!supabase || !user) throw new Error('Session utilisateur introuvable.');
        const email = user.email || '';
        if (!email) throw new Error('Email utilisateur introuvable.');
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw new Error('Mot de passe incorrect.');
        const now = new Date();
        const scheduledAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const { error: profileUpdateError } = await supabase
          .from('users_profiles')
          .update({
            account_status: 'pending_deletion',
            deletion_requested_at: now.toISOString(),
            deletion_scheduled_at: scheduledAt.toISOString(),
            force_logout_at: now.toISOString(),
          })
          .eq('id', user.id);
        if (profileUpdateError) throw profileUpdateError;
        await supabase.auth.signOut();
        localStorage.removeItem(sessionStorageKey);
        localStorage.removeItem(sessionStartedAtKey);
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileLoadError(null);
      },
      recoverActivationSession: async () => {
        if (!supabase) return false;
        const recoveredSession = await waitForRecoveredSession();
        if (!recoveredSession) return false;
        setSession(recoveredSession);
        setUser(recoveredSession.user);
        setProfileLoadError(null);
        return true;
      },
      updatePassword: async (password: string) => {
        if (!supabase) throw new Error('Supabase non configuré.');
        const recoveredSession = await waitForRecoveredSession();
        if (!recoveredSession) {
          throw new Error("Session d’activation introuvable. Ouvrez le lien le plus récent ou demandez un nouveau lien d’activation.");
        }
        setSession(recoveredSession);
        setUser(recoveredSession.user);
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          throw new Error("Session d’activation introuvable. Ouvrez le lien le plus récent ou demandez un nouveau lien d’activation.");
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          if (/auth session missing|session.*missing/i.test(error.message)) {
            throw new Error("Session d’activation introuvable. Ouvrez le lien le plus récent ou demandez un nouveau lien d’activation.");
          }
          throw error;
        }
      },
      getAccessRequestStatusByEmail: async (email: string) => {
        if (!supabase || !email) return null;
        const normalized = normalizeEmail(email);
        const { data: rpcRowRaw, error: rpcError } = await supabase
          .rpc('get_access_request_status', { target_email: normalized })
          .maybeSingle();
        const rpcRow = rpcRowRaw as
          | { status?: string; agency_name?: string; selected_plan?: string; created_at?: string }
          | null;
        if (!rpcError && rpcRow) {
          if (import.meta.env.DEV) console.log('Access request found (rpc):', rpcRow);
          return {
            status: rpcRow.status,
            agencyName: rpcRow.agency_name,
            plan: rpcRow.selected_plan,
            createdAt: rpcRow.created_at,
          };
        }

        // Fallback for environments where RPC is not yet applied.
        const { data: row, error } = await supabase
          .from('access_requests')
          .select('status, agency_name, selected_plan, created_at, email')
          .eq('email', normalized)
          .in('status', ['pending', 'pending_verification', 'contacted', 'payment_pending', 'verified', 'rejected', 'approved'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (import.meta.env.DEV) console.log('Access request found (table):', row);
        if (error || !row) return null;
        return { status: row.status, agencyName: row.agency_name, plan: row.selected_plan, createdAt: row.created_at };
      },
    }),
    [isDemoSession, isInitialized, loading, profile, profileLoadError, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
