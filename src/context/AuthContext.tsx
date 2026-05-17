import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type UserProfile = {
  id: string;
  agencyId: string | null;
  fullName: string;
  email: string;
  phone: string;
  role: 'Admin' | 'Manager' | 'Staff';
  accountStatus: AccountStatus;
  isSuperAdmin: boolean;
  agency: AgencySubscription | null;
};

export type AccountStatus = 'pending' | 'active' | 'rejected' | 'suspended';
export type AgencyPlan = 'starter' | 'pro' | 'business';
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
  monthlyPrice: number;
  paymentMethod: PaymentMethod;
  paymentNotes: string;
  createdAt: string;
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
};

type AuthContextValue = {
  isSupabaseEnabled: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  agencyId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signInWithGoogle: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<AuthActionResult>;
  createAgencyProfile: (agencyName: string, fullName?: string, phone?: string) => Promise<UserProfile>;
  refreshProfile: () => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  deleteAccountWithPassword: (password: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  getAccessRequestStatusByEmail: (email: string) => Promise<{ status: string; agencyName: string; plan: string; createdAt: string } | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const demoAuthKey = 'mekloc-demo-auth';
const sessionStorageKey = 'mekloc_session_id';
const sessionStartedAtKey = 'mekloc_session_started_at';
const demoEmail = 'demo@mekloc.ma';
const demoPassword = 'demo123456';
const allowDemoMode = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';

type ProfileRow = {
  id: string;
  agency_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: 'Admin' | 'Manager' | 'Staff';
  account_status: AccountStatus;
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
  monthly_price: number | null;
  payment_method: PaymentMethod | null;
  payment_notes: string | null;
  created_at: string;
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
  role: 'Admin',
  accountStatus: 'active',
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
    monthlyPrice: Number(agency.monthly_price ?? 0),
    paymentMethod: agency.payment_method || 'other',
    paymentNotes: agency.payment_notes || '',
    createdAt: agency.created_at,
  };
}

function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    agencyId: row.agency_id,
    fullName: row.full_name || 'MekLoc User',
    email: row.email || '',
    phone: row.phone || '',
    role: row.role,
    accountStatus: row.account_status || 'pending',
    isSuperAdmin: Boolean(row.is_super_admin),
    agency: mapAgency(row.agencies),
  };
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('users_profiles')
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
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as ProfileRow;
  const agency = Array.isArray(row.agencies) ? row.agencies[0] : row.agencies;
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

async function isDeletedByEmail(email: string | null | undefined): Promise<boolean> {
  if (!supabase || !email) return false;
  const { data, error } = await supabase.rpc('is_deleted_account', { target_email: email });
  if (error) return false;
  return Boolean(data);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getOrCreateSessionKey() {
  const existing = localStorage.getItem(sessionStorageKey);
  if (existing) return existing;
  const next = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(sessionStorageKey, next);
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

  const deviceName = /iphone/i.test(ua)
    ? `iPhone • ${browser}`
    : /ipad/i.test(ua)
      ? `iPad • ${browser}`
      : /android/i.test(ua)
        ? `Android • ${browser}`
        : /macintosh|mac os x/i.test(ua)
          ? `MacBook • ${browser}`
          : /windows/i.test(ua)
            ? `PC Windows • ${browser}`
            : `${os} • ${browser}`;

  return { browser, os, deviceName };
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
      role: 'Admin',
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
  const [isDemoSession, setIsDemoSession] = useState(() => allowDemoMode && localStorage.getItem(demoAuthKey) === 'true');
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const lastSeenUpdateRef = useRef<number>(0);
  const lastRevocationCheckRef = useRef<number>(0);

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
      const { browser, os, deviceName } = parseDevice(ua);
      const sessionKey = getOrCreateSessionKey();
      const upsertPayload = {
        user_id: currentUser.id,
        agency_id: currentProfile.agencyId,
        session_key: sessionKey,
        device_name: deviceName,
        browser,
        os,
        user_agent: ua,
        last_seen_at: nowIso,
      };

      const { data: existing, error: existingError } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('session_key', sessionKey)
        .maybeSingle();

      if (!existingError && existing?.id) {
        await supabase.from('user_sessions').update(upsertPayload).eq('id', existing.id);
      } else {
        await supabase.from('user_sessions').insert({
          ...upsertPayload,
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
      setLoading(false);
      return undefined;
    }

    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    async function loadInitialSession() {
      const { data, error } = await supabase!.auth.getSession();
      if (!mounted) return;
      if (error) {
        setLoading(false);
        return;
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        try {
          const nextProfile = await fetchProfile(data.session.user.id);
          setProfile(nextProfile);
          if (nextProfile) {
            await syncSessionActivity(data.session.user, nextProfile);
            await checkRevokedSession(data.session.user);
          }
        } catch {
          setProfile(null);
        } finally {
          setLoading(false);
        }
      } else {
        setProfile(null);
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
        setLoading(true);
        fetchProfile(nextSession.user.id)
          .then((nextProfile) => {
            if (mounted) {
              setProfile(nextProfile);
              syncSessionActivity(nextSession.user, nextProfile, { isLogin: event === 'SIGNED_IN' }).catch(() => undefined);
            }
          })
          .catch(() => {
            if (mounted) setProfile(null);
          })
          .finally(() => {
            if (mounted) setLoading(false);
          });
      } else {
        setProfile(null);
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
  }, [session?.user, profile?.agencyId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isSupabaseEnabled: isSupabaseConfigured && !isDemoSession,
      session,
      user,
      profile,
      agencyId: profile?.agencyId ?? null,
      loading,
      signIn: async (email, password) => {
        if (allowDemoMode && email.trim().toLowerCase() === demoEmail && password === demoPassword) {
          localStorage.setItem(demoAuthKey, 'true');
          setIsDemoSession(true);
          setSession(demoSession);
          setUser(demoUser);
          setProfile(demoProfile);
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
          localStorage.setItem(sessionStartedAtKey, new Date().toISOString());
          const deleted = await isDeletedByEmail(data.user?.email);
          if (deleted) {
            await supabase.auth.signOut();
            throw new Error('Ce compte a été supprimé. Contactez MekLoc pour réactivation.');
          }
          let nextProfile = data.user ? await fetchProfile(data.user.id) : null;

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
              nextProfile = await fetchProfile(data.user.id);
            }
          }

          setProfile(nextProfile);
          if (data.user && nextProfile) {
            await syncSessionActivity(data.user, nextProfile, { isLogin: true });
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
            return { needsEmailConfirmation: true };
          }

          const nextProfile = await createAgencyAndProfile(data.user, agencyName, fullName || agencyName, phone);

          setSession(data.session);
          setUser(data.user);
          setProfile(nextProfile);
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
          throw new Error('Ce compte a été supprimé. Contactez MekLoc pour réactivation.');
        }
        const nextProfile = await fetchProfile(activeUser.id);
        setProfile(nextProfile);
        return nextProfile;
      },
      signOut: async () => {
        if (isDemoSession) {
          localStorage.removeItem(demoAuthKey);
          setIsDemoSession(false);
          setSession(null);
          setUser(null);
          setProfile(null);
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
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw new Error('Mot de passe incorrect.');
        const { error: profileDeleteError } = await supabase.from('users_profiles').delete().eq('id', user.id);
        if (profileDeleteError) throw profileDeleteError;
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
      },
      updatePassword: async (password: string) => {
        if (!supabase) throw new Error('Supabase non configuré.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
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
    [isDemoSession, loading, profile, session, user],
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
