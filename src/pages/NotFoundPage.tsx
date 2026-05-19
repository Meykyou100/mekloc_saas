import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-carbon-950 px-4 text-center text-white light:bg-carbon-50 light:text-carbon-950">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-gold-300">404</p>
        <h1 className="mt-4 text-5xl font-black">Page not found</h1>
        <p className="mt-4 text-carbon-300 light:text-carbon-600">This MekLoc route is not available.</p>
        <Link to="/dashboard" className="mt-8 inline-block">
          <Button icon={<ArrowLeft className="h-4 w-4" />}>Go to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
