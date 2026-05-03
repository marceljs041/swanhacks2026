import type { FC } from "react";
interface RecorderProps {
    onClose: () => void;
    onSave: (blob: Blob) => void | Promise<void>;
}
/**
 * Modal microphone recorder. Lives in its own file so both the Home
 * dashboard and the Notes screen can launch it from their "Record
 * Audio" quick action without duplicating the MediaRecorder lifecycle.
 *
 * Cleanup notes:
 *   - The MediaStream tracks are stopped both on stop() and on
 *     unmount, so dismissing the modal mid-recording releases the mic.
 *   - The preview ObjectURL is revoked on discard and unmount.
 */
export declare const AudioRecorderModal: FC<RecorderProps>;
export {};
//# sourceMappingURL=AudioRecorderModal.d.ts.map