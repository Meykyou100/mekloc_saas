import type { UserProfile } from '../context/AuthContext';
import { isSubscriptionAllowed } from './subscription';

export function getPostLoginRedirect(profile: UserProfile | null, isSupabaseEnabled: boolean) {
  if (!isSupabaseEnabled) return '/dashboard';
  if (!profile) return '/demande-acces?from=login';
  if (profile.isSuperAdmin) return '/super-admin';
  if (!profile.agencyId) return `/demande-acces?from=login${profile.email ? `&email=${encodeURIComponent(profile.email)}` : ''}`;
  if (profile.accountStatus !== 'active') return '/account-status';
  if (!isSubscriptionAllowed(profile.agency)) return '/payment-required';
  return '/dashboard';
}
