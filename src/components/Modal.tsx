"use client";

import { useEffect, useRef } from "react";

export function Modal({ title, icon, onClose, footer, className, children }: { title: string; icon?: React.ReactNode; onClose: () => void; footer: React.ReactNode; className?: string; children: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-wrap" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={panel} tabIndex={-1} className={`modal ${className ?? ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          {icon}
          <h2>{title}</h2>
        </header>
        <div className="modal-body">{children}</div>
        <footer className="modal-foot">{footer}</footer>
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button type="button" className={checked ? "switch is-on" : "switch"} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
      <i />
    </button>
  );
}
