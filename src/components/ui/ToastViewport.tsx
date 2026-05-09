import { CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';

const icons = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
};

export default function ToastViewport() {
  const { toasts, dismissToast } = useApp();

  return (
    <div className="fixed right-4 top-4 z-[60] grid w-[calc(100%-2rem)] max-w-sm gap-3">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type || 'info'];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              className="glass-card flex items-start gap-3 rounded-2xl p-4"
            >
              <div className="rounded-xl bg-gold-400/15 p-2 text-gold-200">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white light:text-carbon-950">{toast.title}</p>
                {toast.message ? (
                  <p className="mt-1 text-sm text-carbon-300 light:text-carbon-600">{toast.message}</p>
                ) : null}
              </div>
              <button
                aria-label="Dismiss notification"
                className="rounded-lg p-1 text-carbon-400 hover:bg-white/10 hover:text-white"
                onClick={() => dismissToast(toast.id)}
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
