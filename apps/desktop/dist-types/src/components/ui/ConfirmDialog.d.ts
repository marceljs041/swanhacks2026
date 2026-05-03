import type { FC, ReactNode } from "react";
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
export declare const ConfirmDialog: FC<Props>;
export {};
//# sourceMappingURL=ConfirmDialog.d.ts.map