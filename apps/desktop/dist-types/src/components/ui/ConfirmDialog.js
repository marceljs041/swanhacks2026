import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
/**
 * Modal confirmation prompt. Reuses the existing `.modal-backdrop` /
 * `.modal-card` shell so it inherits theme-aware backdrop blur + card
 * styling. Closes on Esc and backdrop click. Use for destructive
 * actions like deleting a note.
 */
export const ConfirmDialog = ({ title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, onConfirm, onCancel, }) => {
    useEffect(() => {
        function onKey(e) {
            if (e.key === "Escape")
                onCancel();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onCancel]);
    return (_jsx("div", { className: "modal-backdrop", role: "dialog", "aria-modal": "true", onClick: onCancel, children: _jsxs("div", { className: "modal-card confirm-dialog", onClick: (e) => e.stopPropagation(), children: [_jsx("div", { className: "modal-head", children: _jsx("span", { className: "modal-title", children: title }) }), body && _jsx("div", { className: "confirm-body", children: body }), _jsxs("div", { className: "confirm-actions", children: [_jsx("button", { type: "button", className: "btn-secondary", onClick: onCancel, children: cancelLabel }), _jsx("button", { type: "button", className: danger ? "btn-danger" : "btn-primary", onClick: onConfirm, autoFocus: true, children: confirmLabel })] })] }) }));
};
//# sourceMappingURL=ConfirmDialog.js.map