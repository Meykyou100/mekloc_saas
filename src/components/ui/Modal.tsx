import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type ModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  panelClassName?: string;
  bodyClassName?: string;
};

export default function Modal({ open, title, subtitle, children, onClose, panelClassName = '', bodyClassName = '' }: ModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-carbon-950/75 px-0 py-0 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={`glass-card flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-none sm:h-auto sm:max-h-[92vh] sm:rounded-3xl ${panelClassName}`}
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            transition={{ duration: 0.22 }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#090B0F]/95 px-4 py-3 backdrop-blur sm:px-6">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black tracking-tight text-white light:text-carbon-950">{title}</h2>
                {subtitle ? <p className="mt-0.5 truncate text-xs font-medium text-carbon-500 sm:text-sm">{subtitle}</p> : null}
              </div>
              <button
                aria-label="Close modal"
                className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-carbon-200 transition hover:bg-white/10 light:text-carbon-700"
                onClick={onClose}
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>
            <div className={`min-h-0 flex-1 overflow-y-auto bg-[#090B0F] p-4 sm:p-5 ${bodyClassName}`}>{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
