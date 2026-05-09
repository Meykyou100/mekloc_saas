import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type ModalProps = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
};

export default function Modal({ open, title, children, onClose }: ModalProps) {
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
            className="glass-card h-[94vh] w-full max-w-2xl overflow-hidden rounded-t-3xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl"
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            transition={{ duration: 0.22 }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white light:text-carbon-950">{title}</h2>
              <button
                aria-label="Close modal"
                className="focus-ring rounded-xl p-2 text-carbon-200 transition hover:bg-white/10 light:text-carbon-700"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[82vh] overflow-y-auto p-4 sm:max-h-[76vh] sm:p-5">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
