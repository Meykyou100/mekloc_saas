import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import Card from './Card';

export default function StatCard({
  label,
  value,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
}) {
  return (
    <motion.div className="h-full" whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Card className="flex h-full min-h-[104px] flex-col justify-between border-[var(--app-border)] bg-[var(--app-card)] p-3.5 shadow-[0_14px_34px_rgba(16,24,32,.10)] sm:min-h-[116px] sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="min-w-0">
            <p className="line-clamp-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)] sm:text-sm sm:normal-case sm:tracking-normal">{label}</p>
            <p className="mt-2 truncate text-xl font-black text-[var(--app-text)] sm:mt-3 sm:text-2xl">{value}</p>
          </div>
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-2 text-[var(--app-gold-text)] shadow-[0_0_24px_rgba(227,177,23,0.08)] sm:rounded-2xl sm:p-3">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
        <p className="mt-3 line-clamp-1 text-[11px] font-medium text-mint-400 sm:mt-4 sm:text-xs">{trend}</p>
      </Card>
    </motion.div>
  );
}
