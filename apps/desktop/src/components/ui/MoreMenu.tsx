import type { FC, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { MoreIcon } from "../icons.js";

export interface MoreMenuItem {
  label: string;
  onClick: () => void;
  /** Optional leading icon. Inherits text colour. */
  icon?: ReactNode;
  /** When true, renders in the danger style and a divider above. */
  danger?: boolean;
}

interface Props {
  items: MoreMenuItem[];
  /** Accessible label for the trigger button. Defaults to "More actions". */
  label?: string;
}

/**
 * A small dropdown menu hung off the standard `…` (more) button used in
 * card headers. Closes on outside click and Esc, and traps focus only
 * loosely — the list is short enough that arrow-key navigation isn't
 * worth the complexity here.
 */
export const MoreMenu: FC<Props> = ({ items, label = "More actions" }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent): void {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="more-menu" ref={wrapRef}>
      <button
        type="button"
        className="header-action"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreIcon size={16} />
      </button>
      {open && (
        <div className="more-menu-list" role="menu">
          {items.map((it, i) => (
            <button
              key={`${i}-${it.label}`}
              type="button"
              role="menuitem"
              className={`more-menu-item${it.danger ? " danger" : ""}`}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.icon && <span className="more-menu-icon">{it.icon}</span>}
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
