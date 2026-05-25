import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function MobileSection({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`md:rounded-2xl ${className}`}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-5 text-carbon-400">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MobileMetricCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="min-w-[132px] rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-950/95 to-black/70 p-3 shadow-[0_14px_38px_rgba(0,0,0,0.22)]">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl border border-yellow-500/20 bg-yellow-500/10 text-gold-200">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-carbon-300">{label}</p>
      {note ? <p className="mt-1 text-xs text-carbon-500">{note}</p> : null}
    </div>
  );
}

export function MobileEmptyBlock({
  icon: Icon,
  title,
  message,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-yellow-500/20 bg-yellow-500/10 text-gold-200">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-3 font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm leading-5 text-carbon-400">{message}</p>
    </div>
  );
}

