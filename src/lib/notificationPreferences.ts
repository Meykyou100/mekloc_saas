export type NotificationPreferenceKey = 'reservationConfirmation' | 'paymentReminder' | 'returnReminder' | 'contractSending';
export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export const defaultNotificationPreferences: NotificationPreferences = {
  reservationConfirmation: true,
  paymentReminder: true,
  returnReminder: true,
  contractSending: true,
};

export function getNotificationPreferences(settings: Record<string, unknown> | undefined): NotificationPreferences {
  const raw = settings?.notifications;
  const notifications = raw && typeof raw === 'object' ? raw as Partial<NotificationPreferences> : {};
  return {
    reservationConfirmation: notifications.reservationConfirmation ?? defaultNotificationPreferences.reservationConfirmation,
    paymentReminder: notifications.paymentReminder ?? defaultNotificationPreferences.paymentReminder,
    returnReminder: notifications.returnReminder ?? defaultNotificationPreferences.returnReminder,
    contractSending: notifications.contractSending ?? defaultNotificationPreferences.contractSending,
  };
}
