import { ArrowLeft, CalendarCheck, Car, FileText, Gauge, ShieldCheck, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { formatMAD } from '../data/mockData';
import { useData } from '../context/DataContext';

export default function VehicleDetailsPage() {
  const { id } = useParams();
  const { vehicles, reservations, maintenance: maintenanceItems } = useData();
  const vehicle = vehicles.find((item) => item.id === id) || vehicles[0];
  if (!vehicle) {
    return (
      <div>
        <Link to="/vehicles" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200 light:text-carbon-700">
          <ArrowLeft className="h-4 w-4" />
          Back to vehicles
        </Link>
        <Card className="p-6 text-carbon-300 light:text-carbon-700">No vehicle found.</Card>
      </div>
    );
  }
  const relatedReservations = reservations.filter((reservation) => reservation.vehicleId === vehicle.id);
  const vehicleStats: { label: string; value: string; icon: LucideIcon }[] = [
    { label: 'Mileage', value: `${vehicle.mileage.toLocaleString()} km`, icon: Gauge },
    { label: 'Fuel', value: vehicle.fuel, icon: Car },
    { label: 'Insurance', value: vehicle.insuranceExpiry, icon: ShieldCheck },
    { label: 'Inspection', value: vehicle.inspectionDate, icon: CalendarCheck },
  ];

  return (
    <div>
      <Link to="/vehicles" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200 light:text-carbon-700">
        <ArrowLeft className="h-4 w-4" />
        Back to vehicles
      </Link>
      <PageHeader
        eyebrow="Vehicle profile"
        title={`${vehicle.brand} ${vehicle.model}`}
        description={`${vehicle.plate} · ${vehicle.city} · ${vehicle.year}`}
        action={<Button variant="secondary" icon={<FileText className="h-4 w-4" />}>Open contract history</Button>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="overflow-hidden">
          <div className="h-72 bg-gold-sheen p-8">
            <div className="flex h-full flex-col justify-between">
              <div className="flex items-center justify-between">
                <Badge>{vehicle.status}</Badge>
                <span className="rounded-full bg-carbon-950/70 px-4 py-2 text-sm font-bold text-gold-200">{formatMAD(vehicle.dailyPrice)} / day</span>
              </div>
              <Car className="ml-auto h-36 w-36 text-white/80" strokeWidth={1.1} />
            </div>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {vehicleStats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <Icon className="mb-3 h-5 w-5 text-gold-300" />
                <p className="text-xs uppercase tracking-wide text-carbon-500">{label}</p>
                <p className="mt-1 font-bold text-white light:text-carbon-950">{value}</p>
              </div>
            ))}
          </div>
        </Card>
        <div className="grid gap-6">
          <Card className="p-5">
            <h2 className="font-semibold text-white light:text-carbon-950">Rental history</h2>
            <div className="mt-4 grid gap-3">
              {relatedReservations.length ? relatedReservations.map((reservation) => (
                <div key={reservation.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-white light:text-carbon-950">{reservation.client}</p>
                    <Badge>{reservation.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-carbon-400">{reservation.pickupDate} → {reservation.returnDate}</p>
                </div>
              )) : <p className="text-sm text-carbon-400">No reservations for this vehicle yet.</p>}
            </div>
          </Card>
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-gold-300" />
              <h2 className="font-semibold text-white light:text-carbon-950">Service history</h2>
            </div>
            <div className="grid gap-3">
              {maintenanceItems.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div>
                    <p className="font-bold text-white light:text-carbon-950">{item.type}</p>
                    <p className="text-sm text-carbon-400">{item.date}</p>
                  </div>
                  <p className="font-bold text-gold-200">{formatMAD(item.cost)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
