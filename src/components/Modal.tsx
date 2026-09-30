import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

export function Modal({ title, children, onClose, busy = false, wide = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} aria-labelledby="dialog-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (event.target === ref.current && !busy) onClose(); }}>
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="modal-inner">
      <div className="modal-heading"><span className="eyebrow">YOUR SPACE. YOUR RULES.</span><button className="icon-button" aria-label="Close dialog" onClick={onClose} disabled={busy}><X size={20}/></button></div>
      <h2 id="dialog-title">{title}</h2>{children}
    </motion.div>
  </dialog>;
}
