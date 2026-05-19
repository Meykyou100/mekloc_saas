import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  type Client,
  type Contract,
  type ContractStatus,
  type MaintenanceItem,
  type Payment,
  type PaymentStatus,
  type Reservation,
  type ReservationStatus,
  type Vehicle,
  type VehicleStatus,
} from '../data/mockData';
import {
  normalizeText,
  sanitizeText,
  validateDateRange,
  validateEmail,
  validatePhone,
  validatePositiveNumber,
} from '../lib/security';
import { canAccess, type AppPermission } from '../lib/permissions';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { isSubscriptionAllowed } from '../lib/subscription';
import {
  clients as mockClients,
  contracts as mockContracts,
  maintenanceItems as mockMaintenance,
  payments as mockPayments,
  reservations as mockReservations,
  vehicles as mockVehicles,
} from '../data/mockData';

type DataContextValue = {
  loading: boolean;
  vehicles: Vehicle[];
  clients: Client[];
  reservations: Reservation[];
  contracts: Contract[];
  payments: Payment[];
  maintenance: MaintenanceItem[];
  refreshData: () => Promise<void>;
  createVehicle: (vehicle: Vehicle) => Promise<Vehicle>;
  updateVehicle: (vehicle: Vehicle) => Promise<Vehicle>;
  deleteVehicle: (id: string) => Promise<void>;
  createClient: (client: Client) => Promise<Client>;
  updateClient: (client: Client) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;
  createReservation: (reservation: Reservation) => Promise<Reservation>;
  updateReservation: (reservation: Reservation) => Promise<Reservation>;
  deleteReservation: (id: string) => Promise<void>;
  createContract: (contract: Contract) => Promise<Contract>;
  updateContract: (contract: Contract) => Promise<Contract>;
  deleteContract: (id: string) => Promise<void>;
  createPayment: (payment: Payment) => Promise<Payment>;
  updatePayment: (payment: Payment) => Promise<Payment>;
  updatePaymentStatus: (id: string, status: PaymentStatus) => Promise<Payment>;
  deletePayment: (id: string) => Promise<void>;
  createMaintenance: (item: MaintenanceItem) => Promise<MaintenanceItem>;
  updateMaintenance: (item: MaintenanceItem) => Promise<MaintenanceItem>;
  deleteMaintenance: (id: string) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);
const allowMockData = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_DATA === 'true';
const dataRequestTimeoutMs = 15000;
const activeReservationStatuses: ReservationStatus[] = ['Confirmed', 'Active'];

function linkedVehicleDeleteMessage(count: number) {
  return `Ce véhicule est lié à ${count} réservation${count > 1 ? 's' : ''} active${count > 1 ? 's' : ''}. Vous pouvez le marquer indisponible ou l’archiver.`;
}

function withDataTimeout<T>(promise: Promise<T>, timeoutMs = dataRequestTimeoutMs): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Chargement des données trop long.')), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}

function setEmptyDataState(
  setters: {
    setVehicles: (value: Vehicle[]) => void;
    setClients: (value: Client[]) => void;
    setReservations: (value: Reservation[]) => void;
    setContracts: (value: Contract[]) => void;
    setPayments: (value: Payment[]) => void;
    setMaintenance: (value: MaintenanceItem[]) => void;
  },
) {
  setters.setVehicles([]);
  setters.setClients([]);
  setters.setReservations([]);
  setters.setContracts([]);
  setters.setPayments([]);
  setters.setMaintenance([]);
}

function setMockDataState(
  setters: {
    setVehicles: (value: Vehicle[]) => void;
    setClients: (value: Client[]) => void;
    setReservations: (value: Reservation[]) => void;
    setContracts: (value: Contract[]) => void;
    setPayments: (value: Payment[]) => void;
    setMaintenance: (value: MaintenanceItem[]) => void;
  },
) {
  setters.setVehicles(mockVehicles);
  setters.setClients(mockClients);
  setters.setReservations(mockReservations);
  setters.setContracts(mockContracts);
  setters.setPayments(mockPayments);
  setters.setMaintenance(mockMaintenance);
}

type VehicleRow = {
  id: string;
  brand: string;
  model: string;
  plate_number: string;
  year: number;
  mileage: number;
  fuel_type: string;
  transmission: string;
  daily_price: number;
  status: VehicleStatus;
  insurance_expiry: string;
  technical_inspection_date: string;
  city: string;
  revenue: number | null;
  image_url?: string | null;
  image_path?: string | null;
  vehicle_color?: string | null;
  accessories?: Record<string, boolean> | null;
  damage_marks?: Array<{ id: string; zone: string; type: string; x?: number; y?: number; note?: string }> | null;
};

type ClientRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  cin_passport: string;
  driving_license_number: string;
  address: string;
  total_rentals: number | null;
  total_spent: number | null;
  status: 'VIP' | 'Regular' | 'New';
  id_card_front_url?: string | null;
  id_card_back_url?: string | null;
  created_at?: string | null;
};

type ReservationRow = {
  id: string;
  reservation_number: string | null;
  client_id: string;
  vehicle_id: string;
  pickup_date: string;
  return_date: string;
  start_time?: string | null;
  end_time?: string | null;
  daily_price: number;
  deposit: number;
  total_amount?: number | null;
  pickup_location?: string | null;
  return_location?: string | null;
  mileage_out?: number | null;
  fuel_level_out?: string | null;
  status: ReservationStatus;
  notes: string | null;
  city: string | null;
};

type ContractRow = {
  id: string;
  contract_number: string;
  client_id: string;
  vehicle_id: string;
  template: string;
  pickup_date: string;
  return_date: string;
  total_amount: number;
  terms: string;
  status: ContractStatus;
  pdf_path: string | null;
};

type PaymentRow = {
  id: string;
  invoice: string;
  client_id: string;
  reservation_id: string | null;
  vehicle_id?: string | null;
  amount: number;
  method: 'Cash' | 'Card' | 'Bank transfer';
  status: PaymentStatus;
  due_date: string;
};

type MaintenanceRow = {
  id: string;
  vehicle_id: string;
  service_type?: MaintenanceItem['serviceType'] | null;
  type?: string | null;
  last_service_date?: string | null;
  next_service_date?: string | null;
  service_date?: string | null;
  current_mileage?: number | null;
  mileage_at_service?: number | null;
  next_service_mileage?: number | null;
  cost: number;
  provider_name?: string | null;
  status: MaintenanceItem['status'] | string;
  notes?: string | null;
  invoice_url?: string | null;
};

function vehicleName(vehicle?: Vehicle) {
  return vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Unknown vehicle';
}

function mapVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    plate: row.plate_number,
    year: row.year,
    mileage: row.mileage,
    fuel: row.fuel_type,
    transmission: row.transmission,
    dailyPrice: row.daily_price,
    status: row.status,
    insuranceExpiry: row.insurance_expiry,
    inspectionDate: row.technical_inspection_date,
    city: row.city,
    revenue: row.revenue ?? 0,
    imageUrl: row.image_url || undefined,
    imagePath: row.image_path || undefined,
    vehicleColor: row.vehicle_color || undefined,
    accessories: row.accessories || undefined,
    damageMarks: row.damage_marks as Vehicle['damageMarks'],
  };
}

function toVehicleRow(vehicle: Vehicle, agencyId: string, withImage = true) {
  if (!sanitizeText(vehicle.brand, 80) || !sanitizeText(vehicle.model, 80) || !sanitizeText(vehicle.plate, 24)) {
    throw new Error('Champ obligatoire');
  }
  if (!validatePositiveNumber(vehicle.dailyPrice) || !validatePositiveNumber(vehicle.mileage, true)) {
    throw new Error('Montant invalide');
  }
  const base = {
    agency_id: agencyId,
    brand: sanitizeText(vehicle.brand, 80),
    model: sanitizeText(vehicle.model, 80),
    plate_number: sanitizeText(vehicle.plate, 24).toUpperCase(),
    year: vehicle.year,
    mileage: vehicle.mileage,
    fuel_type: sanitizeText(vehicle.fuel, 40),
    transmission: sanitizeText(vehicle.transmission, 40),
    daily_price: vehicle.dailyPrice,
    status: vehicle.status,
    insurance_expiry: vehicle.insuranceExpiry,
    technical_inspection_date: vehicle.inspectionDate,
    city: sanitizeText(vehicle.city, 80),
    revenue: vehicle.revenue,
    vehicle_color: sanitizeText(vehicle.vehicleColor || '', 30) || null,
    accessories: vehicle.accessories || {},
    damage_marks: (vehicle.damageMarks || []).map((mark) => ({
      ...mark,
      note: sanitizeText(mark.note || '', 200) || undefined,
    })),
  };
  if (!withImage) return base;
  return {
    ...base,
    image_url: vehicle.imageUrl || null,
    image_path: vehicle.imagePath || null,
  };
}

function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    cin: row.cin_passport,
    license: row.driving_license_number,
    address: row.address,
    totalRentals: row.total_rentals ?? 0,
    totalSpent: row.total_spent ?? 0,
    status: row.status,
    idCardFrontUrl: row.id_card_front_url || undefined,
    idCardBackUrl: row.id_card_back_url || undefined,
    createdAt: row.created_at || undefined,
  };
}

function toClientRow(client: Client, agencyId: string, withIdentityImages = true) {
  const fullName = sanitizeText(client.fullName, 120);
  const phone = normalizeText(client.phone, 24);
  const email = normalizeText(client.email, 254).toLowerCase();
  if (!fullName) throw new Error('Champ obligatoire');
  if (!phone || !validatePhone(phone)) throw new Error('Numéro invalide');
  if (email && !validateEmail(email)) throw new Error('Email invalide');

  const base = {
    agency_id: agencyId,
    full_name: fullName,
    phone,
    email,
    cin_passport: sanitizeText(client.cin, 80),
    driving_license_number: sanitizeText(client.license, 80),
    address: sanitizeText(client.address, 220),
    total_rentals: client.totalRentals,
    total_spent: client.totalSpent,
    status: client.status,
  };
  if (!withIdentityImages) return base;
  return {
    ...base,
    id_card_front_url: client.idCardFrontUrl || null,
    id_card_back_url: client.idCardBackUrl || null,
  };
}

function mapReservation(row: ReservationRow, client?: Client, vehicle?: Vehicle): Reservation {
  return {
    id: row.reservation_number || row.id,
    recordId: row.id,
    client: client?.fullName || 'Unknown client',
    clientId: row.client_id,
    vehicle: vehicleName(vehicle),
    vehicleId: row.vehicle_id,
    pickupDate: row.pickup_date,
    returnDate: row.return_date,
    pickupTime: row.start_time || '',
    returnTime: row.end_time || '',
    dailyPrice: row.daily_price,
    deposit: row.deposit,
    totalAmount: row.total_amount ?? row.daily_price,
    pickupLocation: row.pickup_location || '',
    returnLocation: row.return_location || '',
    mileageOut: row.mileage_out ?? 0,
    fuelLevelOut: row.fuel_level_out || '',
    status: row.status,
    notes: row.notes || '',
    city: row.city || vehicle?.city || '',
  };
}

function toReservationRow(reservation: Reservation, agencyId: string) {
  if (!reservation.clientId || !reservation.vehicleId) throw new Error('Champ obligatoire');
  if (!validateDateRange(reservation.pickupDate, reservation.returnDate)) {
    throw new Error('Date de retour invalide');
  }
  if (!validatePositiveNumber(reservation.dailyPrice) || !validatePositiveNumber(reservation.deposit, true)) {
    throw new Error('Montant invalide');
  }

  return {
    agency_id: agencyId,
    reservation_number: sanitizeText(reservation.id, 40),
    client_id: reservation.clientId,
    vehicle_id: reservation.vehicleId,
    pickup_date: reservation.pickupDate,
    return_date: reservation.returnDate,
    start_time: sanitizeText(reservation.pickupTime || '', 10) || null,
    end_time: sanitizeText(reservation.returnTime || '', 10) || null,
    daily_price: reservation.dailyPrice,
    deposit: reservation.deposit,
    total_amount: reservation.totalAmount ?? reservation.dailyPrice,
    pickup_location: sanitizeText(reservation.pickupLocation || '', 140) || null,
    return_location: sanitizeText(reservation.returnLocation || '', 140) || null,
    mileage_out: reservation.mileageOut ?? null,
    fuel_level_out: sanitizeText(reservation.fuelLevelOut || '', 40) || null,
    status: reservation.status,
    notes: sanitizeText(reservation.notes || '', 800),
    city: sanitizeText(reservation.city || '', 80),
  };
}

async function assertNoReservationOverlap(
  reservation: Reservation,
  agencyId: string,
  currentReservationNumber?: string,
) {
  if (!supabase) return;

  const { data, error } = await supabase
    .from('reservations')
    .select('reservation_number,pickup_date,return_date')
    .eq('agency_id', agencyId)
    .eq('vehicle_id', reservation.vehicleId)
    .in('status', ['Confirmed', 'Active'])
    .lte('pickup_date', reservation.returnDate)
    .gte('return_date', reservation.pickupDate);

  if (error) throw error;

  const overlap = (data || []).find((row) => row.reservation_number !== currentReservationNumber);
  if (overlap) {
    throw new Error(
      `Ce véhicule est déjà réservé du ${overlap.pickup_date} au ${overlap.return_date}. Veuillez choisir d'autres dates.`,
    );
  }
}

function mapContract(row: ContractRow, client?: Client, vehicle?: Vehicle): Contract {
  return {
    id: row.id,
    contractNumber: row.contract_number,
    client: client?.fullName || 'Unknown client',
    clientId: row.client_id,
    vehicle: vehicleName(vehicle),
    vehicleId: row.vehicle_id,
    template: row.template,
    pickupDate: row.pickup_date,
    returnDate: row.return_date,
    totalAmount: row.total_amount,
    terms: row.terms,
    status: row.status,
    pdfPath: row.pdf_path || undefined,
  };
}

function toContractRow(contract: Contract, agencyId: string) {
  if (!contract.clientId || !contract.vehicleId) throw new Error('Champ obligatoire');
  if (!validateDateRange(contract.pickupDate, contract.returnDate)) throw new Error('Date de retour invalide');
  if (!validatePositiveNumber(contract.totalAmount)) throw new Error('Montant invalide');
  return {
    agency_id: agencyId,
    contract_number: sanitizeText(contract.contractNumber, 60),
    client_id: contract.clientId,
    vehicle_id: contract.vehicleId,
    template: sanitizeText(contract.template, 60),
    pickup_date: contract.pickupDate,
    return_date: contract.returnDate,
    total_amount: contract.totalAmount,
    terms: sanitizeText(contract.terms, 4000),
    status: contract.status,
    pdf_path: contract.pdfPath || null,
  };
}

function mapPayment(row: PaymentRow, client?: Client): Payment {
  return {
    id: row.id,
    invoice: row.invoice,
    client: client?.fullName || 'Unknown client',
    clientId: row.client_id,
    reservationId: row.reservation_id || undefined,
    vehicleId: row.vehicle_id || undefined,
    amount: row.amount,
    method: row.method,
    status: row.status,
    dueDate: row.due_date,
  };
}

function isMissingPaymentVehicleColumn(error: Error | null) {
  return /vehicle_id|schema cache/i.test(error?.message || '');
}

function toPaymentRow(payment: Payment, agencyId: string, withVehicle = true) {
  if (!payment.clientId) throw new Error('Champ obligatoire');
  if (!validatePositiveNumber(payment.amount, true)) throw new Error('Montant invalide');
  const base = {
    agency_id: agencyId,
    invoice: sanitizeText(payment.invoice, 60),
    client_id: payment.clientId,
    reservation_id: payment.reservationId || null,
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    due_date: payment.dueDate,
  };
  if (!withVehicle) return base;
  return {
    ...base,
    vehicle_id: payment.vehicleId || null,
  };
}

function mapMaintenance(row: MaintenanceRow, vehicle?: Vehicle): MaintenanceItem {
  const nextDate = row.next_service_date || row.service_date || new Date().toISOString().slice(0, 10);
  const status = (row.status as MaintenanceItem['status']) || 'Scheduled';
  return {
    id: row.id,
    vehicle: vehicleName(vehicle),
    vehicleId: row.vehicle_id,
    plate: vehicle?.plate,
    serviceType: (row.service_type || row.type || 'Autre') as MaintenanceItem['serviceType'],
    lastServiceDate: row.last_service_date || nextDate,
    nextServiceDate: nextDate,
    currentMileage: row.current_mileage ?? vehicle?.mileage ?? 0,
    mileageAtService: row.mileage_at_service ?? 0,
    nextServiceMileage: row.next_service_mileage ?? 0,
    cost: row.cost,
    providerName: row.provider_name || '',
    status,
    notes: row.notes || '',
    invoiceUrl: row.invoice_url || undefined,
    type: row.service_type || row.type || 'Autre',
    date: nextDate,
    priority: status === 'Overdue' ? 'High' : status === 'Due soon' ? 'Medium' : 'Low',
  };
}

function toMaintenanceRow(item: MaintenanceItem, agencyId: string) {
  if (!item.vehicleId) throw new Error('Champ obligatoire');
  if (!validatePositiveNumber(item.cost, true)) throw new Error('Montant invalide');
  return {
    agency_id: agencyId,
    vehicle_id: item.vehicleId,
    service_type: item.serviceType,
    type: item.serviceType,
    last_service_date: item.lastServiceDate,
    next_service_date: item.nextServiceDate,
    service_date: item.nextServiceDate,
    current_mileage: item.currentMileage,
    mileage_at_service: item.mileageAtService,
    next_service_mileage: item.nextServiceMileage,
    cost: item.cost,
    provider_name: sanitizeText(item.providerName || '', 140),
    status: item.status,
    notes: sanitizeText(item.notes || '', 800),
    invoice_url: sanitizeText(item.invoiceUrl || '', 1000) || null,
  };
}

function byId<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { agencyId, isSupabaseEnabled, loading: authLoading, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);

  const refreshData = useCallback(async () => {
    if (!isSupabaseEnabled || !supabase || !isSupabaseConfigured || !agencyId) {
      const setters = { setVehicles, setClients, setReservations, setContracts, setPayments, setMaintenance };
      if (allowMockData) {
        setMockDataState(setters);
      } else {
        setEmptyDataState(setters);
      }
      return;
    }

    setLoading(true);
    try {
      const canReadAll = Boolean(profile?.isSuperAdmin);
      const canReadVehicles = canReadAll || canAccess(profile?.role, 'vehicles');
      const canReadClients = canReadAll || canAccess(profile?.role, 'clients');
      const canReadReservations = canReadAll || canAccess(profile?.role, 'reservations');
      const canReadContracts = canReadAll || canAccess(profile?.role, 'contracts');
      const canReadPayments = canReadAll || canAccess(profile?.role, 'payments');
      const canReadMaintenance = canReadAll || canAccess(profile?.role, 'maintenance');

      const [
        vehiclesResult,
        clientsResult,
        reservationsResult,
        contractsResult,
        paymentsResult,
        maintenanceResult,
      ] = await withDataTimeout(Promise.all([
        canReadVehicles
          ? supabase.from('vehicles').select('*').order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        canReadClients
          ? supabase.from('clients').select('*').order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        canReadReservations
          ? supabase.from('reservations').select('*').order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        canReadContracts
          ? supabase.from('contracts').select('*').order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        canReadPayments
          ? supabase.from('payments').select('*').order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        canReadMaintenance
          ? supabase.from('maintenance').select('*').order('service_date', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]));

      const firstError = [
        vehiclesResult.error,
        clientsResult.error,
        reservationsResult.error,
        contractsResult.error,
        paymentsResult.error,
        maintenanceResult.error,
      ].find(Boolean);
      if (firstError) throw firstError;

      const nextVehicles = ((vehiclesResult.data || []) as VehicleRow[]).map(mapVehicle);
      const nextClients = ((clientsResult.data || []) as ClientRow[]).map(mapClient);
      const vehicleMap = byId(nextVehicles);
      const clientMap = byId(nextClients);

      setVehicles(nextVehicles);
      setClients(nextClients);
      setReservations(
        ((reservationsResult.data || []) as ReservationRow[]).map((row) =>
          mapReservation(row, clientMap.get(row.client_id), vehicleMap.get(row.vehicle_id)),
        ),
      );
      setContracts(
        ((contractsResult.data || []) as ContractRow[]).map((row) =>
          mapContract(row, clientMap.get(row.client_id), vehicleMap.get(row.vehicle_id)),
        ),
      );
      setPayments(
        ((paymentsResult.data || []) as PaymentRow[]).map((row) => mapPayment(row, clientMap.get(row.client_id))),
      );
      setMaintenance(
        ((maintenanceResult.data || []) as MaintenanceRow[]).map((row) =>
          mapMaintenance(row, vehicleMap.get(row.vehicle_id)),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [agencyId, isSupabaseEnabled, profile?.isSuperAdmin, profile?.role]);

  useEffect(() => {
    if (authLoading) return;
    const setters = { setVehicles, setClients, setReservations, setContracts, setPayments, setMaintenance };
    if (isSupabaseEnabled && !agencyId) {
      setEmptyDataState(setters);
      return;
    }
    if (
      isSupabaseEnabled &&
      !profile?.isSuperAdmin &&
      (profile?.accountStatus !== 'active' || !isSubscriptionAllowed(profile?.agency))
    ) {
      setEmptyDataState(setters);
      return;
    }
    refreshData().catch(() => {
      if (allowMockData) {
        setMockDataState(setters);
      }
    });
  }, [agencyId, authLoading, isSupabaseEnabled, profile, refreshData]);

  useEffect(() => {
    if (!isSupabaseEnabled) return;
    const staleKeys = [
      'vehicles',
      'clients',
      'reservations',
      'payments',
      'contracts',
      'maintenance',
      'agency',
      'reports',
      'mekloc-mock-data',
      'mekloc-demo-data',
      'mekloc-demo-auth',
    ];
    staleKeys.forEach((key) => localStorage.removeItem(key));
  }, [isSupabaseEnabled]);

  const value = useMemo<DataContextValue>(() => {
    const hasBackend = Boolean(isSupabaseEnabled && supabase && agencyId);
    const assertPermission = (permission: AppPermission) => {
      if (profile?.isSuperAdmin) return;
      if (!canAccess(profile?.role, permission)) {
        throw new Error('Accès non autorisé');
      }
    };

    return {
      loading,
      vehicles,
      clients,
      reservations,
      contracts,
      payments,
      maintenance,
      refreshData,
      createVehicle: async (vehicle) => {
        assertPermission('vehicles');
        if (!hasBackend) {
          setVehicles((current) => [vehicle, ...current]);
          return vehicle;
        }
        let data: unknown = null;
        let error: Error | null = null;
        {
          const result = await supabase!
            .from('vehicles')
            .insert(toVehicleRow(vehicle, agencyId!, true))
            .select('*')
            .single();
          data = result.data;
          error = result.error as Error | null;
        }
        if (error && /image_(url|path)/i.test(error.message || '')) {
          const fallback = await supabase!
            .from('vehicles')
            .insert(toVehicleRow(vehicle, agencyId!, false))
            .select('*')
            .single();
          data = fallback.data;
          error = fallback.error as Error | null;
        }
        if (error) throw error;
        const nextVehicle = mapVehicle(data as VehicleRow);
        setVehicles((current) => [nextVehicle, ...current]);
        return nextVehicle;
      },
      updateVehicle: async (vehicle) => {
        assertPermission('vehicles');
        if (!hasBackend) {
          setVehicles((current) => current.map((item) => (item.id === vehicle.id ? vehicle : item)));
          return vehicle;
        }
        let data: unknown = null;
        let error: Error | null = null;
        {
          const result = await supabase!
            .from('vehicles')
            .update(toVehicleRow(vehicle, agencyId!, true))
            .eq('id', vehicle.id)
            .select('*')
            .single();
          data = result.data;
          error = result.error as Error | null;
        }
        if (error && /image_(url|path)/i.test(error.message || '')) {
          const fallback = await supabase!
            .from('vehicles')
            .update(toVehicleRow(vehicle, agencyId!, false))
            .eq('id', vehicle.id)
            .select('*')
            .single();
          data = fallback.data;
          error = fallback.error as Error | null;
        }
        if (error) throw error;
        const nextVehicle = mapVehicle(data as VehicleRow);
        setVehicles((current) => current.map((item) => (item.id === vehicle.id ? nextVehicle : item)));
        return nextVehicle;
      },
      deleteVehicle: async (id) => {
        assertPermission('vehicles');
        const existingVehicle = vehicles.find((item) => item.id === id);
        if (hasBackend) {
          const { data: linkedReservations, error: reservationError } = await supabase!
            .from('reservations')
            .select('id, status')
            .eq('vehicle_id', id)
            .in('status', activeReservationStatuses);
          if (reservationError) throw reservationError;

          const blockingReservationIds = (linkedReservations || []).map((reservation) => reservation.id);
          if (blockingReservationIds.length > 0) {
            if (import.meta.env.DEV) {
              console.info('Vehicle delete blocked by active reservation ids', blockingReservationIds);
            }
            const { data, error } = await supabase!
              .from('vehicles')
              .update({ status: 'Unavailable' })
              .eq('id', id)
              .select('*')
              .single();
            if (error) throw error;
            const archivedVehicle = mapVehicle(data as VehicleRow);
            setVehicles((current) => current.map((item) => (item.id === id ? archivedVehicle : item)));
            throw new Error(linkedVehicleDeleteMessage(blockingReservationIds.length));
          }

          const { error } = await supabase!.from('vehicles').delete().eq('id', id);
          if (error) throw error;
        } else if (existingVehicle) {
          const blockingReservationIds = reservations
            .filter((reservation) => reservation.vehicleId === id && activeReservationStatuses.includes(reservation.status))
            .map((reservation) => reservation.id);
          if (blockingReservationIds.length > 0) {
            if (import.meta.env.DEV) {
              console.info('Vehicle delete blocked by active reservation ids', blockingReservationIds);
            }
            setVehicles((current) => current.map((item) => (item.id === id ? { ...item, status: 'Unavailable' } : item)));
            throw new Error(linkedVehicleDeleteMessage(blockingReservationIds.length));
          }
        }
        if (!hasBackend && !existingVehicle) return;
        setVehicles((current) => current.filter((item) => item.id !== id));
      },
      createClient: async (client) => {
        assertPermission('clients');
        if (!hasBackend) {
          setClients((current) => [client, ...current]);
          return client;
        }
        let data: unknown = null;
        let error: Error | null = null;
        {
          const result = await supabase!
            .from('clients')
            .insert(toClientRow(client, agencyId!, true))
            .select('*')
            .single();
          data = result.data;
          error = result.error as Error | null;
        }
        if (error && /id_card_(front|back)_url/i.test(error.message || '')) {
          const fallback = await supabase!
            .from('clients')
            .insert(toClientRow(client, agencyId!, false))
            .select('*')
            .single();
          data = fallback.data;
          error = fallback.error as Error | null;
        }
        if (error) throw error;
        const nextClient = mapClient(data as ClientRow);
        setClients((current) => [nextClient, ...current]);
        return nextClient;
      },
      updateClient: async (client) => {
        assertPermission('clients');
        if (!hasBackend) {
          setClients((current) => current.map((item) => (item.id === client.id ? client : item)));
          return client;
        }
        let data: unknown = null;
        let error: Error | null = null;
        {
          const result = await supabase!
            .from('clients')
            .update(toClientRow(client, agencyId!, true))
            .eq('id', client.id)
            .select('*')
            .single();
          data = result.data;
          error = result.error as Error | null;
        }
        if (error && /id_card_(front|back)_url/i.test(error.message || '')) {
          const fallback = await supabase!
            .from('clients')
            .update(toClientRow(client, agencyId!, false))
            .eq('id', client.id)
            .select('*')
            .single();
          data = fallback.data;
          error = fallback.error as Error | null;
        }
        if (error) throw error;
        const nextClient = mapClient(data as ClientRow);
        setClients((current) => current.map((item) => (item.id === client.id ? nextClient : item)));
        return nextClient;
      },
      deleteClient: async (id) => {
        assertPermission('clients');
        if (hasBackend) {
          const { error } = await supabase!.from('clients').delete().eq('id', id);
          if (error) throw error;
        }
        setClients((current) => current.filter((item) => item.id !== id));
      },
      createReservation: async (reservation) => {
        assertPermission('reservations');
        if (!hasBackend) {
          setReservations((current) => [reservation, ...current]);
          return reservation;
        }
        await assertNoReservationOverlap(reservation, agencyId!);
        const { data, error } = await supabase!
          .from('reservations')
          .insert(toReservationRow(reservation, agencyId!))
          .select('*')
          .single();
        if (error) {
          if (error.message?.includes('overlap_reservation') || error.message?.includes('chevauche')) {
            throw new Error("Ce véhicule est déjà réservé sur cette période.");
          }
          throw error;
        }
        const nextReservation = mapReservation(
          data as ReservationRow,
          clients.find((item) => item.id === reservation.clientId),
          vehicles.find((item) => item.id === reservation.vehicleId),
        );
        setReservations((current) => [nextReservation, ...current]);
        return nextReservation;
      },
      updateReservation: async (reservation) => {
        assertPermission('reservations');
        if (!hasBackend) {
          setReservations((current) => current.map((item) => (item.id === reservation.id ? reservation : item)));
          return reservation;
        }
        await assertNoReservationOverlap(reservation, agencyId!, reservation.id);
        const { data, error } = await supabase!
          .from('reservations')
          .update(toReservationRow(reservation, agencyId!))
          .eq('reservation_number', reservation.id)
          .select('*')
          .single();
        if (error) {
          if (error.message?.includes('overlap_reservation') || error.message?.includes('chevauche')) {
            throw new Error("Ce véhicule est déjà réservé sur cette période.");
          }
          throw error;
        }
        const nextReservation = mapReservation(
          data as ReservationRow,
          clients.find((item) => item.id === reservation.clientId),
          vehicles.find((item) => item.id === reservation.vehicleId),
        );
        setReservations((current) => current.map((item) => (item.id === reservation.id ? nextReservation : item)));
        return nextReservation;
      },
      deleteReservation: async (id) => {
        assertPermission('reservations');
        if (hasBackend) {
          const { error } = await supabase!.from('reservations').delete().eq('reservation_number', id);
          if (error) throw error;
        }
        setReservations((current) => current.filter((item) => item.id !== id));
      },
      createContract: async (contract) => {
        assertPermission('contracts');
        if (!hasBackend) {
          setContracts((current) => [contract, ...current]);
          return contract;
        }
        const { data, error } = await supabase!
          .from('contracts')
          .insert(toContractRow(contract, agencyId!))
          .select('*')
          .single();
        if (error) throw error;
        const nextContract = mapContract(
          data as ContractRow,
          clients.find((item) => item.id === contract.clientId),
          vehicles.find((item) => item.id === contract.vehicleId),
        );
        setContracts((current) => [nextContract, ...current]);
        return nextContract;
      },
      updateContract: async (contract) => {
        assertPermission('contracts');
        if (!hasBackend) {
          setContracts((current) => current.map((item) => (item.id === contract.id ? contract : item)));
          return contract;
        }
        const { data, error } = await supabase!
          .from('contracts')
          .update(toContractRow(contract, agencyId!))
          .eq('id', contract.id)
          .select('*')
          .single();
        if (error) throw error;
        const nextContract = mapContract(
          data as ContractRow,
          clients.find((item) => item.id === contract.clientId),
          vehicles.find((item) => item.id === contract.vehicleId),
        );
        setContracts((current) => current.map((item) => (item.id === contract.id ? nextContract : item)));
        return nextContract;
      },
      deleteContract: async (id) => {
        assertPermission('contracts');
        if (hasBackend) {
          const { error } = await supabase!.from('contracts').delete().eq('id', id);
          if (error) throw error;
        }
        setContracts((current) => current.filter((item) => item.id !== id));
      },
      createPayment: async (payment) => {
        assertPermission('payments');
        if (!hasBackend) {
          setPayments((current) => [payment, ...current]);
          return payment;
        }
        let data: unknown = null;
        let error: Error | null = null;
        {
          const result = await supabase!
            .from('payments')
            .insert(toPaymentRow(payment, agencyId!, true))
            .select('*')
            .single();
          data = result.data;
          error = result.error as Error | null;
        }
        if (isMissingPaymentVehicleColumn(error)) {
          const fallback = await supabase!
            .from('payments')
            .insert(toPaymentRow(payment, agencyId!, false))
            .select('*')
            .single();
          data = fallback.data;
          error = fallback.error as Error | null;
        }
        if (error) throw error;
        const nextPayment = mapPayment(data as PaymentRow, clients.find((item) => item.id === payment.clientId));
        setPayments((current) => [nextPayment, ...current]);
        return nextPayment;
      },
      updatePayment: async (payment) => {
        assertPermission('payments');
        if (!hasBackend) {
          setPayments((current) => current.map((item) => (item.id === payment.id ? payment : item)));
          return payment;
        }
        let data: unknown = null;
        let error: Error | null = null;
        {
          const result = await supabase!
            .from('payments')
            .update(toPaymentRow(payment, agencyId!, true))
            .eq('id', payment.id)
            .select('*')
            .single();
          data = result.data;
          error = result.error as Error | null;
        }
        if (isMissingPaymentVehicleColumn(error)) {
          const fallback = await supabase!
            .from('payments')
            .update(toPaymentRow(payment, agencyId!, false))
            .eq('id', payment.id)
            .select('*')
            .single();
          data = fallback.data;
          error = fallback.error as Error | null;
        }
        if (error) throw error;
        const nextPayment = mapPayment(data as PaymentRow, clients.find((item) => item.id === payment.clientId));
        setPayments((current) => current.map((item) => (item.id === payment.id ? nextPayment : item)));
        return nextPayment;
      },
      updatePaymentStatus: async (id, status) => {
        assertPermission('payments');
        const payment = payments.find((item) => item.id === id);
        if (!payment) throw new Error('Payment not found');
        const nextPaymentInput = { ...payment, status };
        if (!hasBackend) {
          setPayments((current) => current.map((item) => (item.id === id ? nextPaymentInput : item)));
          return nextPaymentInput;
        }
        let data: unknown = null;
        let error: Error | null = null;
        {
          const result = await supabase!
            .from('payments')
            .update(toPaymentRow(nextPaymentInput, agencyId!, true))
            .eq('id', id)
            .select('*')
            .single();
          data = result.data;
          error = result.error as Error | null;
        }
        if (isMissingPaymentVehicleColumn(error)) {
          const fallback = await supabase!
            .from('payments')
            .update(toPaymentRow(nextPaymentInput, agencyId!, false))
            .eq('id', id)
            .select('*')
            .single();
          data = fallback.data;
          error = fallback.error as Error | null;
        }
        if (error) throw error;
        const nextPayment = mapPayment(data as PaymentRow, clients.find((item) => item.id === payment.clientId));
        setPayments((current) => current.map((item) => (item.id === id ? nextPayment : item)));
        return nextPayment;
      },
      deletePayment: async (id) => {
        assertPermission('payments');
        if (hasBackend) {
          const { error } = await supabase!.from('payments').delete().eq('id', id);
          if (error) throw error;
        }
        setPayments((current) => current.filter((item) => item.id !== id));
      },
      createMaintenance: async (item) => {
        assertPermission('maintenance');
        if (!hasBackend) {
          setMaintenance((current) => [item, ...current]);
          return item;
        }
        const { data, error } = await supabase!
          .from('maintenance')
          .insert(toMaintenanceRow(item, agencyId!))
          .select('*')
          .single();
        if (error) throw error;
        const nextItem = mapMaintenance(data as MaintenanceRow, vehicles.find((vehicle) => vehicle.id === item.vehicleId));
        setMaintenance((current) => [nextItem, ...current]);
        return nextItem;
      },
      updateMaintenance: async (item) => {
        assertPermission('maintenance');
        if (!hasBackend) {
          setMaintenance((current) => current.map((existing) => (existing.id === item.id ? item : existing)));
          return item;
        }
        const { data, error } = await supabase!
          .from('maintenance')
          .update(toMaintenanceRow(item, agencyId!))
          .eq('id', item.id)
          .select('*')
          .single();
        if (error) throw error;
        const nextItem = mapMaintenance(data as MaintenanceRow, vehicles.find((vehicle) => vehicle.id === item.vehicleId));
        setMaintenance((current) => current.map((existing) => (existing.id === item.id ? nextItem : existing)));
        return nextItem;
      },
      deleteMaintenance: async (id) => {
        assertPermission('maintenance');
        if (hasBackend) {
          const { error } = await supabase!.from('maintenance').delete().eq('id', id);
          if (error) throw error;
        }
        setMaintenance((current) => current.filter((item) => item.id !== id));
      },
    };
  }, [
    agencyId,
    clients,
    contracts,
    isSupabaseEnabled,
    loading,
    maintenance,
    payments,
    profile?.isSuperAdmin,
    profile?.role,
    refreshData,
    reservations,
    vehicles,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used inside DataProvider');
  }
  return context;
}
