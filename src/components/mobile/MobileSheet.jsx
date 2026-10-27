import React, { useRef, useState } from "react";
import { X } from "lucide-react";
import { IconButton } from "../ui/IconButton";
import { useFocusTrap } from "../ui/useFocusTrap";

const CLOSE_DRAG_DISTANCE = 90;

// Bottom sheet for every mobile panel. Drag the header down or tap outside to close.
export default function MobileSheet({ open, title, onClose, peek = false, children }) {
  const ref = useFocusTrap(open, onClose);
  const dragStartRef = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);

  const onTouchStart = (e) => {
    dragStartRef.current = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (dragStartRef.current === null) return;
    setDragOffset(Math.max(0, e.touches[0].clientY - dragStartRef.current));
  };
  const onTouchEnd = () => {
    if (dragOffset > CLOSE_DRAG_DISTANCE) onClose();
    dragStartRef.current = null;
    setDragOffset(0);
  };

  return (
    <>
      <div className={`sheet-backdrop ${open ? "is-open" : ""} ${peek ? "sheet-backdrop--clear" : ""}`} onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        className={`sheet ${open ? "is-open" : ""} ${peek ? "sheet--peek" : ""}`}
        style={dragOffset ? { transform: `translateY(${dragOffset}px)`, transition: "none" } : undefined}
        role="dialog"
        aria-modal={open ? "true" : undefined}
        aria-hidden={!open}
        inert={open ? undefined : ""}
        aria-label={title}
      >
        <header className="sheet__head" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <span className="sheet__handle" aria-hidden="true" />
          <h2>{title}</h2>
          <IconButton icon={X} label="關閉" onClick={onClose} />
        </header>
        <div className="sheet__body">{open ? children : null}</div>
      </div>
    </>
  );
}
