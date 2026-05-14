import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  clients as mockClients,
  contracts as mockContracts,
  maintenanceItems as mockMaintenance,
  payments as mockPayments,
  reservations as mockReservations,
  vehicles as mockVehicles,
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
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { isSubscriptionAllowed } from '../lib/subscription';

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
};

type ReservationRow = {
  id: string;
  reservation_number: string | null;
  client_id: string;
  vehicle_id: string;
  pickup_date: string;
  return_date: string;
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
  };
}

function toVehicleRow(vehicle: Vehicle, agencyId: string, withImage = true) {
  const base = {
    agency_id: agencyId,
    brand: vehicle.brand,
    model: vehicle.model,
    plate_number: vehicle.plate,
    year: vehicle.year,
    mileage: vehicle.mileage,
    fuel_type: vehicle.fuel,
    transmission: vehicle.transmission,
    daily_price: vehicle.dailyPrice,
    status: vehicle.status,
    insurance_expiry: vehicle.insuranceExpiry,
    technical_inspection_date: vehicle.inspectionDate,
    city: vehicle.city,
    revenue: vehicle.revenue,
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
  };
}

function toClientRow(client: Client, agencyId: string) {
  return {
    agency_id: agencyId,
    full_name: client.fullName,
    phone: client.phone,
    email: client.email,
    cin_passport: client.cin,
    driving_license_number: client.license,
    address: client.address,
    total_rentals: client.totalRentals,
    total_spent: client.totalSpent,
    status: client.status,
  };
}

function mapReservation(row: ReservationRow, client?: Client, vehicle?: Vehicle): Reservation {
  return {
    id: row.reservation_number || row.id,
    client: client?.fullName || 'Unknown client',
    clientId: row.client_id,
    vehicle: vehicleName(vehicle),
    vehicleId: row.vehicle_id,
    pickupDate: row.pickup_date,
    returnDate: row.return_date,
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
  return {
    agency_id: agencyId,
    reservation_number: reservation.id,
    client_id: reservation.clientId,
    vehicle_id: reservation.vehicleId,
    pickup_date: reservation.pickupDate,
    return_date: reservation.returnDate,
    daily_price: reservation.dailyPrice,
    deposit: reservation.deposit,
    total_amount: reservation.totalAmount ?? reservation.dailyPrice,
    pickup_location: reservation.pickupLocation || null,
    return_location: reservation.returnLocation || null,
    mileage_out: reservation.mileageOut ?? null,
    fuel_level_out: reservation.fuelLevelOut || null,
    status: reservation.status,
    notes: reservation.notes,
    city: reservation.city,
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
  return {
    agency_id: agencyId,
    contract_number: contract.contractNumber,
    client_id: contract.clientId,
    vehicle_id: contract.vehicleId,
    template: contract.template,
    pickup_date: contract.pickupDate,
    return_date: contract.returnDate,
    total_amount: contract.totalAmount,
    terms: contract.terms,
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
    amount: row.amount,
    method: row.method,
    status: row.status,
    dueDate: row.due_date,
  };
}

function toPaymentRow(payment: Payment, agencyId: string) {
  return {
    agency_id: agencyId,
    invoice: payment.invoice,
    client_id: payment.clientId,
    reservation_id: payment.reservationId || null,
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    due_date: payment.dueDate,
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
    provider_name: item.providerName,
    status: item.status,
    notes: item.notes,
    invoice_url: item.invoiceUrl || null,
  };
}

function byId<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { agencyId, isSupabaseEnabled, loading: authLoading, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles);
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [reservations, setReservations] = useState<Reservation[]>(mockReservations);
  const [contracts, setContracts] = useState<Contract[]>(mockContracts);
  const [payments, setPayments] = useState<Payment[]>(mockPayments);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>(mockMaintenance);

  const refreshData = useCallback(async () => {
    if (!isSupabaseEnabled || !supabase || !isSupabaseConfigured || !agencyId) {
      setVehicles(mockVehicles);
      setClients(mockClients);
      setReservations(mockReservations);
      setContracts(mockContracts);
      setPayments(mockPayments);
      setMaintenance(mockMaintenance);
      return;
    }

    setLoading(true);
    try {
      const [
        vehiclesResult,
        clientsResult,
        reservationsResult,
        contractsResult,
        paymentsResult,
        maintenanceResult,
      ] = await Promise.all([
        supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('reservations').select('*').order('created_at', { ascending: false }),
        supabase.from('contracts').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('created_at', { ascending: false }),
        supabase.from('maintenance').select('*').order('service_date', { ascending: true }),
      ]);

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
  }, [agencyId, isSupabaseEnabled]);

  useEffect(() => {
    if (authLoading) return;
    if (isSupabaseEnabled && !agencyId) {
      setVehicles([]);
      setClients([]);
      setReservations([]);
      setContracts([]);
      setPayments([]);
      setMaintenance([]);
      return;
    }
    if (
      isSupabaseEnabled &&
      !profile?.isSuperAdmin &&
      (profile?.accountStatus !== 'active' || !isSubscriptionAllowed(profile?.agency))
    ) {
      setVehicles([]);
      setClients([]);
      setReservations([]);
      setContracts([]);
      setPayments([]);
      setMaintenance([]);
      return;
    }
    refreshData().catch(() => {
      setVehicles(mockVehicles);
      setClients(mockClients);
      setReservations(mockReservations);
      setContracts(mockContracts);
      setPayments(mockPayments);
      setMaintenance(mockMaintenance);
    });
  }, [agencyId, authLoading, isSupabaseEnabled, profile, refreshData]);

  const value = useMemo<DataContextValue>(() => {
    const hasBackend = Boolean(isSupabaseEnabled && supabase && agencyId);

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
        if (hasBackend) {
          const { error } = await supabase!.from('vehicles').delete().eq('id', id);
          if (error) throw error;
        }
        setVehicles((current) => current.filter((item) => item.id !== id));
      },
      createClient: async (client) => {
        if (!hasBackend) {
          setClients((current) => [client, ...current]);
          return client;
        }
        const { data, error } = await supabase!
          .from('clients')
          .insert(toClientRow(client, agencyId!))
          .select('*')
          .single();
        if (error) throw error;
        const nextClient = mapClient(data as ClientRow);
        setClients((current) => [nextClient, ...current]);
        return nextClient;
      },
      updateClient: async (client) => {
        if (!hasBackend) {
          setClients((current) => current.map((item) => (item.id === client.id ? client : item)));
          return client;
        }
        const { data, error } = await supabase!
          .from('clients')
          .update(toClientRow(client, agencyId!))
          .eq('id', client.id)
          .select('*')
          .single();
        if (error) throw error;
        const nextClient = mapClient(data as ClientRow);
        setClients((current) => current.map((item) => (item.id === client.id ? nextClient : item)));
        return nextClient;
      },
      deleteClient: async (id) => {
        if (hasBackend) {
          const { error } = await supabase!.from('clients').delete().eq('id', id);
          if (error) throw error;
        }
        setClients((current) => current.filter((item) => item.id !== id));
      },
      createReservation: async (reservation) => {
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
        if (hasBackend) {
          const { error } = await supabase!.from('reservations').delete().eq('reservation_number', id);
          if (error) throw error;
        }
        setReservations((current) => current.filter((item) => item.id !== id));
      },
      createContract: async (contract) => {
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
        if (hasBackend) {
          const { error } = await supabase!.from('contracts').delete().eq('id', id);
          if (error) throw error;
        }
        setContracts((current) => current.filter((item) => item.id !== id));
      },
      createPayment: async (payment) => {
        if (!hasBackend) {
          setPayments((current) => [payment, ...current]);
          return payment;
        }
        const { data, error } = await supabase!
          .from('payments')
          .insert(toPaymentRow(payment, agencyId!))
          .select('*')
          .single();
        if (error) throw error;
        const nextPayment = mapPayment(data as PaymentRow, clients.find((item) => item.id === payment.clientId));
        setPayments((current) => [nextPayment, ...current]);
        return nextPayment;
      },
      updatePayment: async (payment) => {
        if (!hasBackend) {
          setPayments((current) => current.map((item) => (item.id === payment.id ? payment : item)));
          return payment;
        }
        const { data, error } = await supabase!
          .from('payments')
          .update(toPaymentRow(payment, agencyId!))
          .eq('id', payment.id)
          .select('*')
          .single();
        if (error) throw error;
        const nextPayment = mapPayment(data as PaymentRow, clients.find((item) => item.id === payment.clientId));
        setPayments((current) => current.map((item) => (item.id === payment.id ? nextPayment : item)));
        return nextPayment;
      },
      updatePaymentStatus: async (id, status) => {
        const payment = payments.find((item) => item.id === id);
        if (!payment) throw new Error('Payment not found');
        const nextPaymentInput = { ...payment, status };
        if (!hasBackend) {
          setPayments((current) => current.map((item) => (item.id === id ? nextPaymentInput : item)));
          return nextPaymentInput;
        }
        const { data, error } = await supabase!
          .from('payments')
          .update(toPaymentRow(nextPaymentInput, agencyId!))
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw error;
        const nextPayment = mapPayment(data as PaymentRow, clients.find((item) => item.id === payment.clientId));
        setPayments((current) => current.map((item) => (item.id === id ? nextPayment : item)));
        return nextPayment;
      },
      deletePayment: async (id) => {
        if (hasBackend) {
          const { error } = await supabase!.from('payments').delete().eq('id', id);
          if (error) throw error;
        }
        setPayments((current) => current.filter((item) => item.id !== id));
      },
      createMaintenance: async (item) => {
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
