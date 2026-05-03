import type { FC, ReactNode } from "react";
import { useEffect } from "react";

interface Props {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, the confirm button uses the destructive (red) style. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation prompt. Reuses the existing `.modal-backdrop` /
 * `.modal-card` shell so it inherits theme-aware backdrop blur + card
 * styling. Closes on Esc and backdrop click. Use for destructive
 * actions like deleting a note.
 */
export const ConfirmDialog: FC<Props> = ({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="modal-card confirm-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">{title}</span>
        </div>
        {body && <div className="confirm-body">{body}</div>}
        <div className="confirm-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
