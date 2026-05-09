import { ArrowLeft, Car, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import { formatMAD, vehicles } from '../data/mockData';

export default function PublicBookingPreviewPage() {
  const availableCars = vehicles.filter((vehicle) => vehicle.status === 'Available');

  return (
    <div className="min-h-screen bg-carbon-950 px-4 py-6 text-white light:bg-carbon-50 light:text-carbon-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-carbon-300 hover:text-gold-200">
          <ArrowLeft className="h-4 w-4" />
          Back to MekLoc
        </Link>

        <section className="grid gap-8 py-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-gold-200">Public booking preview</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white light:text-carbon-950 sm:text-6xl">
              Atlas Rent Marrakech
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-carbon-300 light:text-carbon-600">
              A clean customer-facing page where visitors can view available cars, request a booking, or contact the agency on WhatsApp.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#cars" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-gold-400 px-5 py-3 text-sm font-bold text-carbon-950 hover:bg-gold-300">
                View available cars
              </a>
              <button className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15">
                <MessageCircle className="h-4 w-4" />
                WhatsApp agency
              </button>
            </div>
          </div>
          <Card className="p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Available cars', String(availableCars.length)],
                ['Starting from', formatMAD(Math.min(...availableCars.map((car) => car.dailyPrice)))],
                ['Response time', '< 10 min'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-sm text-carbon-400">{label}</p>
                  <p className="mt-2 text-2xl font-black text-white light:text-carbon-950">{value}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section id="cars" className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {availableCars.map((vehicle) => (
            <Card key={vehicle.id} className="overflow-hidden">
              <div className="grid h-44 place-items-center bg-[radial-gradient(circle_at_70%_20%,rgba(247,189,19,.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.02))]">
                <Car className="h-20 w-20 text-white/75" strokeWidth={1.3} />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-white light:text-carbon-950">{vehicle.brand} {vehicle.model}</h2>
                    <p className="mt-1 text-sm text-carbon-400">{vehicle.city} · {vehicle.transmission}</p>
                  </div>
                  <Badge>{vehicle.status}</Badge>
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <p className="text-2xl font-black text-white light:text-carbon-950">{formatMAD(vehicle.dailyPrice)}</p>
                  <button className="focus-ring rounded-xl bg-gold-400 px-4 py-2 text-sm font-bold text-carbon-950 hover:bg-gold-300">
                    Request booking
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
