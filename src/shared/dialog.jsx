import { useLayoutEffect, useRef, useState } from "preact/hooks";
import "./dialog.css";

export default function Dialog({
  open,
  onClose,
  children,
  className = "",
  ...props
}) {
  const dialogRef = useRef(null);
  const contentRef = useRef(null);
  const [mounted, setMounted] = useState(open);

  if (open) contentRef.current = children;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (open) {
      setMounted(true);
      if (dialog && !dialog.open) dialog.showModal();
      return undefined;
    }
    if (!mounted) return undefined;

    let cancelled = false;
    const finish = () => {
      if (cancelled) return;
      if (dialog?.open) dialog.close();
      contentRef.current = null;
      setMounted(false);
    };
    const animations = dialog
      .getAnimations()
      .filter((animation) => animation.animationName === "app-dialog-exit");
    Promise.all(animations.map((animation) => animation.finished)).then(
      finish,
      finish,
    );
    return () => {
      cancelled = true;
    };
  }, [open, mounted]);

  if (!open && !mounted) return null;

  return (
    <dialog
      {...props}
      data-app-dialog=""
      className={className + (!open ? " is-closing" : "")}
      ref={dialogRef}
      onClick={(event) => {
        if (open && event.target === event.currentTarget)
          onClose?.(event, "backdropClick");
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (open) onClose?.(event, "escapeKeyDown");
      }}
    >
      {contentRef.current}
    </dialog>
  );
}
