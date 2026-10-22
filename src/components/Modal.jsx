import { useEffect, useRef } from "react";

// Ventana modal con <dialog> nativo: foco atrapado, Esc para cerrar y fondo inerte.
export default function Modal({ open, onClose, label, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-label={label} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && <div className="modal-body">{children}</div>}
    </dialog>
  );
}
