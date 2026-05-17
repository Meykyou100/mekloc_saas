export type AgencyRole = 'owner' | 'manager' | 'agent' | 'accountant';

export type AppPermission =
  | 'dashboard'
  | 'vehicles'
  | 'clients'
  | 'reservations'
  | 'contracts'
  | 'payments'
  | 'maintenance'
  | 'reports'
  | 'settings';

const PERMISSIONS: Record<AgencyRole, AppPermission[]> = {
  owner: [
    'dashboard',
    'vehicles',
    'clients',
    'reservations',
    'contracts',
    'payments',
    'maintenance',
    'reports',
    'settings',
  ],
  manager: ['dashboard', 'vehicles', 'clients', 'reservations', 'payments'],
  agent: ['dashboard', 'clients', 'reservations'],
  accountant: ['dashboard', 'payments', 'reports'],
};

export function normalizeAgencyRole(role: string | null | undefined): AgencyRole {
  const normalized = String(role || '')
    .trim()
    .toLowerCase();

  if (normalized === 'owner' || normalized === 'admin') return 'owner';
  if (normalized === 'manager') return 'manager';
  if (normalized === 'accountant') return 'accountant';
  return 'agent';
}

export function canAccess(role: string | null | undefined, permission: AppPermission): boolean {
  const mappedRole = normalizeAgencyRole(role);
  return PERMISSIONS[mappedRole].includes(permission);
}

export function canAccessAny(
  role: string | null | undefined,
  permissions: AppPermission[],
): boolean {
  return permissions.some((permission) => canAccess(role, permission));
}

export function getRoleLabel(role: string | null | undefined): AgencyRole {
  const mappedRole = normalizeAgencyRole(role);
  if (mappedRole === 'owner') return 'owner';
  if (mappedRole === 'manager') return 'manager';
  if (mappedRole === 'accountant') return 'accountant';
  return 'agent';
}
