import React from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { useFocusTrap } from "./useFocusTrap";

export default function Dialog({ open, title, subtitle, onClose, children, className = "" }) {
  const ref = useFocusTrap(open, onClose);
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dialog ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="dialog__head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton icon={X} label="關閉" onClick={onClose} />
        </header>
        <div className="dialog__body">{children}</div>
      </div>
    </div>
  );
}
