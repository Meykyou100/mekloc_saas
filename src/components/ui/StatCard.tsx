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
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-carbon-300 light:text-carbon-600 sm:text-sm">{label}</p>
            <p className="mt-2 text-xl font-bold text-white light:text-carbon-950 sm:mt-3 sm:text-2xl">{value}</p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-2.5 text-gold-200 light:text-gold-700 sm:rounded-2xl sm:p-3">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
        <p className="mt-3 text-[11px] font-medium text-mint-400 sm:mt-4 sm:text-xs">{trend}</p>
      </Card>
    </motion.div>
  );
}
