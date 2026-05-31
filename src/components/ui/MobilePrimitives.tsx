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
          <h2 className="text-lg font-black text-[var(--app-text)]">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">{description}</p> : null}
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
    <div className="min-w-[132px] rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-3 shadow-[var(--app-shadow)]">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl border border-yellow-500/20 bg-yellow-500/10 text-[var(--app-gold-text)]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xl font-black text-[var(--app-text)]">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-text-soft)]">{label}</p>
      {note ? <p className="mt-1 text-xs text-[var(--app-text-muted)]">{note}</p> : null}
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
    <div className="rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-soft)] p-5 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-yellow-500/20 bg-yellow-500/10 text-[var(--app-gold-text)]">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-3 font-semibold text-[var(--app-text)]">{title}</p>
      <p className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">{message}</p>
    </div>
  );
}
