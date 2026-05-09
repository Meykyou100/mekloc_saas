import type { AgencySubscription } from '../context/AuthContext';

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
  return agency.billingStatus === 'paid' || agency.billingStatus === 'trial';
}

export function isSubscriptionExpiringSoon(agency: AgencySubscription | null | undefined) {
  const remainingDays = daysUntil(agency?.subscriptionEndDate);
  return remainingDays !== null && remainingDays >= 0 && remainingDays < 7;
}

export function isSubscriptionOverdue(agency: AgencySubscription | null | undefined) {
  return agency?.billingStatus === 'overdue' || daysUntil(agency?.subscriptionEndDate) !== null && daysUntil(agency?.subscriptionEndDate)! < 0;
}
