import {
  AlertTriangle,
  Banknote,
  BarChart3,
  BellRing,
  CalendarCheck,
  Car,
  CreditCard,
  FileSignature,
  Gauge,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';

export type VehicleStatus = 'Available' | 'Rented' | 'Maintenance' | 'Unavailable';
export type ReservationStatus = 'Confirmed' | 'Active' | 'Completed' | 'Cancelled';
export type PaymentStatus = 'Paid' | 'Partial' | 'Pending' | 'Late';

export type Vehicle = {
  id: string;
  brand: string;
  model: string;
  plate: string;
  year: number;
  mileage: number;
  fuel: string;
  transmission: string;
  dailyPrice: number;
  status: VehicleStatus;
  insuranceExpiry: string;
  inspectionDate: string;
  city: string;
  revenue: number;
  imageUrl?: string;
  imagePath?: string;
};

export type Client = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  cin: string;
  license: string;
  address: string;
  totalRentals: number;
  totalSpent: number;
  status: 'VIP' | 'Regular' | 'New';
};

export type Reservation = {
  id: string;
  client: string;
  clientId: string;
  vehicle: string;
  vehicleId: string;
  pickupDate: string;
  returnDate: string;
  dailyPrice: number;
  deposit: number;
  totalAmount?: number;
  pickupLocation?: string;
  returnLocation?: string;
  mileageOut?: number;
  fuelLevelOut?: string;
  status: ReservationStatus;
  notes: string;
  city: string;
};

export type Payment = {
  id: string;
  invoice: string;
  client: string;
  clientId?: string;
  reservationId?: string;
  amount: number;
  method: 'Cash' | 'Card' | 'Bank transfer';
  status: PaymentStatus;
  dueDate: string;
};

export type ContractStatus = 'Draft' | 'Signed' | 'Downloaded';

export type Contract = {
  id: string;
  contractNumber: string;
  client: string;
  clientId: string;
  vehicle: string;
  vehicleId: string;
  template: string;
  pickupDate: string;
  returnDate: string;
  totalAmount: number;
  terms: string;
  status: ContractStatus;
  pdfPath?: string;
};

export type MaintenanceItem = {
  id: string;
  vehicle: string;
  vehicleId: string;
  plate?: string;
  serviceType: 'Vidange' | 'Assurance' | 'Visite technique' | 'Pneus' | 'Freins' | 'Réparation' | 'Autre';
  lastServiceDate: string;
  nextServiceDate: string;
  currentMileage: number;
  mileageAtService: number;
  nextServiceMileage: number;
  cost: number;
  providerName: string;
  status: 'Scheduled' | 'Done' | 'Due soon' | 'Overdue';
  notes: string;
  invoiceUrl?: string;
  type?: string;
  date?: string;
  priority?: 'High' | 'Medium' | 'Low';
};

export const vehicles: Vehicle[] = [
  {
    id: 'veh-1',
    brand: 'Range Rover',
    model: 'Velar R-Dynamic',
    plate: '4938-A-6',
    year: 2024,
    mileage: 18600,
    fuel: 'Diesel',
    transmission: 'Automatic',
    dailyPrice: 1800,
    status: 'Rented',
    insuranceExpiry: '2026-09-12',
    inspectionDate: '2026-07-18',
    city: 'Marrakech',
    revenue: 162400,
  },
  {
    id: 'veh-2',
    brand: 'Mercedes-Benz',
    model: 'C-Class AMG Line',
    plate: '7751-B-6',
    year: 2023,
    mileage: 24900,
    fuel: 'Hybrid',
    transmission: 'Automatic',
    dailyPrice: 1350,
    status: 'Available',
    insuranceExpiry: '2026-11-02',
    inspectionDate: '2026-05-30',
    city: 'Casablanca',
    revenue: 118500,
  },
  {
    id: 'veh-3',
    brand: 'Dacia',
    model: 'Duster Prestige',
    plate: '6421-D-6',
    year: 2022,
    mileage: 50400,
    fuel: 'Diesel',
    transmission: 'Manual',
    dailyPrice: 450,
    status: 'Maintenance',
    insuranceExpiry: '2026-06-01',
    inspectionDate: '2026-05-16',
    city: 'Agadir',
    revenue: 74600,
  },
  {
    id: 'veh-4',
    brand: 'Hyundai',
    model: 'Tucson Executive',
    plate: '2119-H-6',
    year: 2024,
    mileage: 9800,
    fuel: 'Petrol',
    transmission: 'Automatic',
    dailyPrice: 820,
    status: 'Available',
    insuranceExpiry: '2027-01-20',
    inspectionDate: '2026-12-22',
    city: 'Tangier',
    revenue: 83950,
  },
  {
    id: 'veh-5',
    brand: 'Renault',
    model: 'Clio Intens',
    plate: '9032-C-6',
    year: 2021,
    mileage: 67400,
    fuel: 'Petrol',
    transmission: 'Manual',
    dailyPrice: 320,
    status: 'Unavailable',
    insuranceExpiry: '2026-05-22',
    inspectionDate: '2026-05-19',
    city: 'Rabat',
    revenue: 42100,
  },
  {
    id: 'veh-6',
    brand: 'BMW',
    model: 'X5 M Sport',
    plate: '3380-E-6',
    year: 2024,
    mileage: 14200,
    fuel: 'Diesel',
    transmission: 'Automatic',
    dailyPrice: 2100,
    status: 'Rented',
    insuranceExpiry: '2026-10-08',
    inspectionDate: '2026-08-14',
    city: 'Marrakech',
    revenue: 193200,
  },
];

export const clients: Client[] = [
  {
    id: 'cli-1',
    fullName: 'Amina El Fassi',
    phone: '+212 6 11 45 80 21',
    email: 'amina.elfassi@example.com',
    cin: 'BK481220',
    license: 'MA-238-9981',
    address: 'Gueliz, Marrakech',
    totalRentals: 14,
    totalSpent: 48200,
    status: 'VIP',
  },
  {
    id: 'cli-2',
    fullName: 'Yassine Benjelloun',
    phone: '+212 6 62 91 43 08',
    email: 'yassine.b@example.com',
    cin: 'JT908311',
    license: 'MA-771-4512',
    address: 'Maarif, Casablanca',
    totalRentals: 7,
    totalSpent: 23100,
    status: 'Regular',
  },
  {
    id: 'cli-3',
    fullName: 'Sofia Amrani',
    phone: '+212 6 70 14 59 65',
    email: 'sofia.amrani@example.com',
    cin: 'AE190442',
    license: 'MA-109-7364',
    address: 'Hay Riad, Rabat',
    totalRentals: 3,
    totalSpent: 8700,
    status: 'Regular',
  },
  {
    id: 'cli-4',
    fullName: 'Omar Tazi',
    phone: '+212 6 88 21 55 94',
    email: 'omar.tazi@example.com',
    cin: 'WA311874',
    license: 'MA-441-3209',
    address: 'Malabata, Tangier',
    totalRentals: 1,
    totalSpent: 4200,
    status: 'New',
  },
  {
    id: 'cli-5',
    fullName: 'Mehdi Alaoui',
    phone: '+212 6 45 77 12 33',
    email: 'mehdi.alaoui@example.com',
    cin: 'CB772019',
    license: 'MA-883-1204',
    address: 'Hivernage, Marrakech',
    totalRentals: 10,
    totalSpent: 36600,
    status: 'VIP',
  },
  {
    id: 'cli-6',
    fullName: 'Nora Berrada',
    phone: '+212 6 32 18 44 90',
    email: 'nora.berrada@example.com',
    cin: 'EE409182',
    license: 'MA-220-6871',
    address: 'Anfa, Casablanca',
    totalRentals: 5,
    totalSpent: 17450,
    status: 'Regular',
  },
  {
    id: 'cli-7',
    fullName: 'Hicham Idrissi',
    phone: '+212 6 99 04 72 18',
    email: 'hicham.idrissi@example.com',
    cin: 'LA776240',
    license: 'MA-554-9022',
    address: 'Centre Ville, Fes',
    totalRentals: 2,
    totalSpent: 5800,
    status: 'New',
  },
  {
    id: 'cli-8',
    fullName: 'Salma El Mansouri',
    phone: '+212 6 27 69 10 52',
    email: 'salma.mansouri@example.com',
    cin: 'QB301884',
    license: 'MA-117-6420',
    address: 'Souissi, Rabat',
    totalRentals: 8,
    totalSpent: 29800,
    status: 'Regular',
  },
];

export const reservations: Reservation[] = [
  {
    id: 'RS-1024',
    client: 'Amina El Fassi',
    clientId: 'cli-1',
    vehicle: 'Range Rover Velar',
    vehicleId: 'veh-1',
    pickupDate: '2026-05-08',
    returnDate: '2026-05-13',
    dailyPrice: 1800,
    deposit: 8000,
    status: 'Active',
    notes: 'Airport pickup. VIP handoff with child seat.',
    city: 'Marrakech',
  },
  {
    id: 'RS-1025',
    client: 'Yassine Benjelloun',
    clientId: 'cli-2',
    vehicle: 'BMW X5',
    vehicleId: 'veh-6',
    pickupDate: '2026-05-09',
    returnDate: '2026-05-12',
    dailyPrice: 2100,
    deposit: 10000,
    status: 'Confirmed',
    notes: 'Corporate account, card pre-authorized.',
    city: 'Casablanca',
  },
  {
    id: 'RS-1026',
    client: 'Sofia Amrani',
    clientId: 'cli-3',
    vehicle: 'Mercedes C-Class',
    vehicleId: 'veh-2',
    pickupDate: '2026-05-01',
    returnDate: '2026-05-05',
    dailyPrice: 1350,
    deposit: 6500,
    status: 'Completed',
    notes: 'Returned clean, no incidents.',
    city: 'Rabat',
  },
  {
    id: 'RS-1027',
    client: 'Omar Tazi',
    clientId: 'cli-4',
    vehicle: 'Hyundai Tucson',
    vehicleId: 'veh-4',
    pickupDate: '2026-05-14',
    returnDate: '2026-05-19',
    dailyPrice: 820,
    deposit: 4200,
    status: 'Confirmed',
    notes: 'Delivery requested to Tangier station.',
    city: 'Tangier',
  },
  {
    id: 'RS-1028',
    client: 'Mehdi Alaoui',
    clientId: 'cli-5',
    vehicle: 'Mercedes C-Class',
    vehicleId: 'veh-2',
    pickupDate: '2026-05-09',
    returnDate: '2026-05-11',
    dailyPrice: 1350,
    deposit: 6000,
    status: 'Active',
    notes: 'Weekend rental, hotel pickup at 10:00.',
    city: 'Marrakech',
  },
];

export const payments: Payment[] = [
  {
    id: 'pay-1',
    invoice: 'INV-2026-081',
    client: 'Amina El Fassi',
    clientId: 'cli-1',
    reservationId: 'RS-1024',
    amount: 9000,
    method: 'Card',
    status: 'Paid',
    dueDate: '2026-05-08',
  },
  {
    id: 'pay-2',
    invoice: 'INV-2026-082',
    client: 'Yassine Benjelloun',
    clientId: 'cli-2',
    reservationId: 'RS-1025',
    amount: 6300,
    method: 'Bank transfer',
    status: 'Partial',
    dueDate: '2026-05-10',
  },
  {
    id: 'pay-3',
    invoice: 'INV-2026-083',
    client: 'Omar Tazi',
    clientId: 'cli-4',
    reservationId: 'RS-1027',
    amount: 4100,
    method: 'Cash',
    status: 'Pending',
    dueDate: '2026-05-14',
  },
  {
    id: 'pay-4',
    invoice: 'INV-2026-076',
    client: 'Sofia Amrani',
    clientId: 'cli-3',
    reservationId: 'RS-1026',
    amount: 1200,
    method: 'Cash',
    status: 'Late',
    dueDate: '2026-05-02',
  },
];

export const contracts: Contract[] = [
  {
    id: 'ctr-1',
    contractNumber: 'CTR-2026-024',
    client: 'Amina El Fassi',
    clientId: 'cli-1',
    vehicle: 'Range Rover Velar',
    vehicleId: 'veh-1',
    template: 'Luxury vehicle',
    pickupDate: '2026-05-08',
    returnDate: '2026-05-13',
    totalAmount: 9000,
    terms:
      'The renter accepts responsibility for fines, fuel level, insurance excess, late returns, and vehicle condition at handoff.',
    status: 'Draft',
  },
  {
    id: 'ctr-2',
    contractNumber: 'CTR-2026-025',
    client: 'Yassine Benjelloun',
    clientId: 'cli-2',
    vehicle: 'BMW X5',
    vehicleId: 'veh-6',
    template: 'Corporate account',
    pickupDate: '2026-05-09',
    returnDate: '2026-05-12',
    totalAmount: 6300,
    terms:
      'Corporate renter accepts insurance excess, late return fees, tolls, fines, and vehicle condition validation at return.',
    status: 'Signed',
  },
];

export const maintenanceItems: MaintenanceItem[] = [
  {
    id: 'mnt-1',
    vehicle: 'Dacia Duster Prestige',
    vehicleId: 'veh-3',
    plate: '6421-D-6',
    serviceType: 'Visite technique',
    lastServiceDate: '2025-05-16',
    nextServiceDate: '2026-05-16',
    currentMileage: 50400,
    mileageAtService: 43100,
    nextServiceMileage: 52000,
    cost: 850,
    providerName: 'Auto Bilan Agadir',
    status: 'Scheduled',
    notes: 'Prepare papers before inspection day.',
  },
  {
    id: 'mnt-2',
    vehicle: 'Renault Clio Intens',
    vehicleId: 'veh-5',
    plate: '9032-C-6',
    serviceType: 'Assurance',
    lastServiceDate: '2025-05-22',
    nextServiceDate: '2026-05-22',
    currentMileage: 67400,
    mileageAtService: 60000,
    nextServiceMileage: 75000,
    cost: 4200,
    providerName: 'Wafa Assurance',
    status: 'Due soon',
    notes: 'Annual full coverage renewal.',
  },
  {
    id: 'mnt-3',
    vehicle: 'BMW X5 M Sport',
    vehicleId: 'veh-6',
    plate: '1174-M-6',
    serviceType: 'Vidange',
    lastServiceDate: '2026-02-12',
    nextServiceDate: '2026-05-27',
    currentMileage: 32800,
    mileageAtService: 28000,
    nextServiceMileage: 35000,
    cost: 950,
    providerName: 'BMW Service Casablanca',
    status: 'Scheduled',
    notes: 'Use original BMW oil filter.',
  },
];

export const revenueByMonth = [
  { label: 'Jan', value: 98000 },
  { label: 'Feb', value: 112000 },
  { label: 'Mar', value: 128500 },
  { label: 'Apr', value: 149300 },
  { label: 'May', value: 184250 },
  { label: 'Jun', value: 171000 },
  { label: 'Jul', value: 206600 },
  { label: 'Aug', value: 225900 },
];

export const bookingAnalytics = [
  { label: 'Direct', value: 38 },
  { label: 'WhatsApp', value: 31 },
  { label: 'Website', value: 22 },
  { label: 'Partner', value: 9 },
];

export const features = [
  { title: 'Centralized Reservations', icon: CalendarCheck },
  { title: 'Automatic Contracts', icon: FileSignature },
  { title: 'Real-Time Fleet Tracking', icon: Gauge },
  { title: 'Payment Management', icon: CreditCard },
  { title: 'Client Database', icon: Users },
  { title: 'Maintenance Alerts', icon: BellRing },
  { title: 'Revenue Analytics', icon: BarChart3 },
  { title: 'Multi-user Access', icon: ShieldCheck },
  { title: 'WhatsApp Notifications', icon: MessageCircle },
  { title: 'Smart Reports', icon: Sparkles },
];

export const plans = [
  {
    name: 'Starter',
    price: '99 MAD',
    cadence: '/mois',
    note: 'Pour les petites agences',
    features: ['Jusqu’à 5 véhicules', 'Réservations limitées', 'Gestion clients', 'Gestion véhicules', 'Tableau de bord simple', 'Support standard'],
  },
  {
    name: 'Pro',
    price: '250 MAD',
    cadence: '/mois',
    note: 'Pour les agences actives',
    featured: true,
    badge: 'Le plus populaire',
    annualPrice: '2500 MAD/an',
    features: ['Véhicules illimités', 'Réservations illimitées', 'Contrats PDF', 'Paiements & factures', 'Gestion entretien véhicules', 'Alertes WhatsApp', 'Rapports avancés', '3 utilisateurs', 'Sauvegarde cloud'],
  },
  {
    name: 'Business',
    price: '499 MAD',
    cadence: '/mois',
    note: 'Pour les agences avancées',
    annualPrice: '4990 MAD/an',
    features: ['Tout le plan Pro', 'Multi-agences / multi-branches', 'Gestion employés', 'Analytics avancés', 'Templates contrats personnalisés', 'Support prioritaire', 'Automatisation WhatsApp avancée', 'Jusqu’à 10 utilisateurs'],
  },
];

export const activityFeed = [
  { icon: Car, text: 'BMW X5 checked out from Marrakech branch', time: '2 min ago' },
  { icon: Banknote, text: 'Card payment captured for INV-2026-081', time: '14 min ago' },
  { icon: Wrench, text: 'Dacia Duster inspection alert escalated', time: '28 min ago' },
  { icon: AlertTriangle, text: 'Renault Clio unavailable pending renewal', time: '1 hr ago' },
];

export const formatMAD = (value: number) =>
  new Intl.NumberFormat('en-MA', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 0,
  }).format(value);
