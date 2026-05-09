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
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-carbon-300 light:text-carbon-600">{label}</p>
            <p className="mt-3 text-2xl font-bold text-white light:text-carbon-950">{value}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3 text-gold-200 light:text-gold-700">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-4 text-xs font-medium text-mint-400">{trend}</p>
      </Card>
    </motion.div>
  );
}
