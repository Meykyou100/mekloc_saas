import type { UserProfile } from '../context/AuthContext';
import { isSubscriptionAllowed } from './subscription';

export function getPostLoginRedirect(profile: UserProfile | null, isSupabaseEnabled: boolean) {
  if (!isSupabaseEnabled) return '/dashboard';
  if (!profile) return '/onboarding';
  if (profile.isSuperAdmin) return '/super-admin';
  if (!profile.agencyId) return '/onboarding';
  if (profile.accountStatus !== 'active') return '/account-status';
  if (!isSubscriptionAllowed(profile.agency)) return '/payment-required';
  return '/dashboard';
}
