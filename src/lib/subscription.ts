import type { AgencySubscription, SubscriptionStatus } from '../context/AuthContext';

export const TRIAL_GRACE_HOURS = 24;

function dateTimestamp(dateValue: string | null | undefined) {
  if (!dateValue) return null;
  const timestamp = new Date(dateValue).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function daysUntil(dateValue: string | null | undefined) {
  if (!dateValue) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateValue);
  targetDate.setHours(0, 0, 0, 0);
  return Math.ceil((targetDate.getTime() - today.getTime()) / 86_400_000);
}

export function isSubscriptionAllowed(agency: AgencySubscription | null | undefined) {
  if (!agency) return false;
  const status = getEffectiveSubscriptionStatus(agency);
  return status === 'trial_active' || status === 'active_paid' || isTrialInGracePeriod(agency);
}

export function getEffectiveSubscriptionStatus(agency: AgencySubscription | null | undefined): SubscriptionStatus {
  if (!agency) return 'payment_pending';
  if (agency.subscriptionStatus === 'suspended') return 'suspended';
  if (agency.subscriptionStatus === 'trial_expired' && isTrialInGracePeriod(agency)) return 'trial_active';
  if (agency.subscriptionStatus === 'trial_active') {
    const end = dateTimestamp(agency.trialEndsAt);
    return end !== null && end < Date.now() && !isTrialInGracePeriod(agency) ? 'trial_expired' : 'trial_active';
  }
  if (agency.subscriptionStatus === 'active_paid') {
    const end = agency.paidUntil ? new Date(agency.paidUntil).getTime() : null;
    return end !== null && Number.isFinite(end) && end < Date.now() ? 'payment_pending' : 'active_paid';
  }
  return agency.subscriptionStatus;
}

export function isTrialInGracePeriod(agency: AgencySubscription | null | undefined) {
  if (!agency || !['trial_active', 'trial_expired'].includes(agency.subscriptionStatus)) return false;
  const end = dateTimestamp(agency.trialEndsAt);
  if (end === null) return false;
  const now = Date.now();
  return now > end && now <= end + TRIAL_GRACE_HOURS * 3_600_000;
}

export function trialGraceHoursRemaining(agency: AgencySubscription | null | undefined) {
  if (!isTrialInGracePeriod(agency)) return 0;
  const end = dateTimestamp(agency?.trialEndsAt);
  if (end === null) return 0;
  return Math.max(0, Math.ceil((end + TRIAL_GRACE_HOURS * 3_600_000 - Date.now()) / 3_600_000));
}

export function trialCountdown(agency: AgencySubscription | null | undefined) {
  if (!agency?.trialEndsAt) return null;
  const milliseconds = new Date(agency.trialEndsAt).getTime() - Date.now();
  if (!Number.isFinite(milliseconds)) return null;
  return Math.max(0, Math.ceil(milliseconds / 86_400_000));
}

export function isSubscriptionExpiringSoon(agency: AgencySubscription | null | undefined) {
  const remainingDays = daysUntil(agency?.trialEndsAt || agency?.paidUntil || agency?.subscriptionEndDate);
  return remainingDays !== null && remainingDays >= 0 && remainingDays < 7;
}

export function isSubscriptionOverdue(agency: AgencySubscription | null | undefined) {
  return getEffectiveSubscriptionStatus(agency) === 'trial_expired'
    || getEffectiveSubscriptionStatus(agency) === 'payment_pending'
    || agency?.billingStatus === 'overdue';
}
