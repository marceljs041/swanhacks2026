import type { FC, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [placement, setPlacement] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    function update(): void {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setPlacement({
        top: r.bottom + 4,
        right: Math.max(8, window.innerWidth - r.right),
      });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    /** Capture phase so we beat other handlers and close reliably (e.g. note editor layout). */
    function onOutside(e: PointerEvent): void {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      className="more-menu"
      ref={wrapRef}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        ref={btnRef}
        type="button"
        className="more-menu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreIcon size={18} />
      </button>
      {open && placement && (
        <div
          className="more-menu-list"
          role="menu"
          style={{
            position: "fixed",
            top: placement.top,
            right: placement.right,
            zIndex: 450,
          }}
        >
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
