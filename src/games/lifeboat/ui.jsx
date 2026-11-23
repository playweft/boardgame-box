import { h } from "preact";
import { X } from "lucide";
import Dialog from "../../shared/dialog.jsx";
import LucideIcon from "../../shared/lucide-icon.jsx";
import Icon from "./icon.jsx";
import { t } from "./i18n.js";

export function Raised({ secondary, href, icon, children, className = "", ...props }) {
  const classes = `${secondary ? "secondary" : "primary"}-button raised ${className}`;
  const content = <>{children}{icon && <span className="raised-icon"><Icon name={icon} /></span>}</>;
  return href
    ? <a className={classes} href={href} {...props}>{content}</a>
    : <button type="button" className={classes} {...props}>{content}</button>;
}

export function GameDialog({ title, open, onClose, children, footer, className = "", closeLabel, bodyRef }) {
  return <Dialog className={`sea-dialog ${className}`} open={open} onClose={onClose} aria-label={title}>
    <div className="dialog-inner">
      <header>
        <h2>{title}</h2>
        {onClose && <button type="button" className={closeLabel ? "dialog-back-button" : "dialog-close-button"}
          aria-label={closeLabel ? undefined : t("common.close", { title: title })} onClick={onClose}>
          {closeLabel || <LucideIcon icon={X} />}
        </button>}
      </header>
      <div className="dialog-body" ref={bodyRef}>{children}</div>
      {footer && <footer>{footer}</footer>}
    </div>
  </Dialog>;
}
