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
      <Card className="flex h-full min-h-[86px] flex-col justify-between p-3 sm:min-h-[116px] sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="min-w-0">
            <p className="truncate text-[11px] text-carbon-300 light:text-carbon-600 sm:text-sm">{label}</p>
            <p className="mt-1 truncate text-lg font-bold text-white light:text-carbon-950 sm:mt-3 sm:text-2xl">{value}</p>
          </div>
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.035] p-2 text-gold-200 light:text-gold-700 sm:rounded-2xl sm:p-3">
            <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
          </div>
        </div>
        <p className="mt-2 truncate text-[10px] font-medium text-mint-400 sm:mt-4 sm:text-xs">{trend}</p>
      </Card>
    </motion.div>
  );
}
