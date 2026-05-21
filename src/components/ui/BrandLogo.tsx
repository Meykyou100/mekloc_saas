import { Car } from 'lucide-react';

type BrandLogoProps = {
  logoUrl?: string | null;
  broken?: boolean;
  onError?: () => void;
  size?: 'sm' | 'md';
};

export default function BrandLogo({ logoUrl, broken = false, onError, size = 'md' }: BrandLogoProps) {
  const dimensions = size === 'sm' ? 'h-9 w-9 rounded-xl' : 'h-12 w-12 rounded-2xl';
  const monogramSize = size === 'sm' ? 'text-lg' : 'text-2xl';
  const carSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <span
      className={`relative grid ${dimensions} shrink-0 place-items-center overflow-hidden border border-gold-200/20 bg-[linear-gradient(145deg,#15181d_0%,#090b0d_58%,#2b210c_100%)] p-2 shadow-[0_10px_24px_rgba(0,0,0,.24)] ring-1 ring-white/[0.04] light:border-gold-500/25 light:bg-[linear-gradient(145deg,#ffffff_0%,#f8f0dc_100%)]`}
    >
      <span className="pointer-events-none absolute inset-x-2 top-1 h-px bg-gradient-to-r from-transparent via-gold-200/55 to-transparent" />
      {logoUrl && !broken ? (
        <img src={logoUrl} alt="Logo agence" className="h-full w-full object-contain" onError={onError} />
      ) : (
        <span className="relative grid h-full w-full place-items-center">
          <span className={`${monogramSize} font-black leading-none text-gold-100 light:text-carbon-950`}>M</span>
          <span className="absolute bottom-0.5 right-0.5 grid h-4 w-4 place-items-center rounded-full border border-gold-200/20 bg-carbon-950/85 text-gold-200 light:bg-white/85">
            <Car className={carSize} strokeWidth={2.2} />
          </span>
        </span>
      )}
    </span>
  );
}
