import { useEffect, useRef, useState } from "preact/hooks";
import "./dialog.css";

const transitionDuration = 180;

export default function Dialog({
  open,
  onClose,
  children,
  className = "",
  ...props
}) {
  const dialogRef = useRef(null);
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open) {
      setMounted(true);
      setClosing(false);
      if (dialog && !dialog.open) dialog.showModal();
      return undefined;
    }
    if (!mounted) return undefined;

    setClosing(true);
    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const timer = window.setTimeout(() => {
      if (dialog?.open) dialog.close();
      setMounted(false);
      setClosing(false);
    }, reducedMotion ? 0 : transitionDuration);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  if (!open && !mounted) return null;

  return (
    <dialog
      {...props}
      data-app-dialog=""
      className={className + (closing ? " is-closing" : "")}
      ref={dialogRef}
      onClick={(event) => {
        if (event.target === event.currentTarget)
          onClose?.(event, "backdropClick");
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose?.(event, "escapeKeyDown");
      }}
    >
      {children}
    </dialog>
  );
}
