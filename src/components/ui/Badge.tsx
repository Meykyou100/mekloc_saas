import type { ReactNode } from 'react';

const badgeStyles: Record<string, string> = {
  Available: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/30 light:text-emerald-700',
  Rented: 'bg-white/[0.035] text-gold-200 border-white/10 light:text-gold-800',
  Maintenance: 'bg-sky-400/15 text-sky-200 border-sky-300/30 light:text-sky-700',
  Unavailable: 'bg-rose-400/15 text-rose-200 border-rose-300/30 light:text-rose-700',
  Confirmed: 'bg-sky-400/15 text-sky-200 border-sky-300/30 light:text-sky-700',
  Active: 'bg-white/[0.035] text-gold-200 border-white/10 light:text-gold-800',
  Completed: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/30 light:text-emerald-700',
  Cancelled: 'bg-rose-400/15 text-rose-200 border-rose-300/30 light:text-rose-700',
  Paid: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/30 light:text-emerald-700',
  Partial: 'bg-white/[0.035] text-gold-200 border-white/10 light:text-gold-800',
  Pending: 'bg-slate-400/15 text-slate-200 border-slate-300/30 light:text-slate-700',
  Late: 'bg-rose-400/15 text-rose-200 border-rose-300/30 light:text-rose-700',
  VIP: 'bg-white/[0.035] text-gold-200 border-white/10 light:text-gold-800',
  Regular: 'bg-sky-400/15 text-sky-200 border-sky-300/30 light:text-sky-700',
  New: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/30 light:text-emerald-700',
  High: 'bg-rose-400/15 text-rose-200 border-rose-300/30 light:text-rose-700',
  Medium: 'bg-white/[0.035] text-gold-200 border-white/10 light:text-gold-800',
  Low: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/30 light:text-emerald-700',
};

export default function Badge({ children }: { children: ReactNode }) {
  const key = String(children);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeStyles[key] || 'border-white/10 bg-white/10 text-carbon-100 light:text-carbon-700'}`}
    >
      {children}
    </span>
  );
}
