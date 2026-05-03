import type { FC } from "react";
interface RecorderProps {
    onClose: () => void;
    /**
     * Called once the user confirms a recording or upload. Receives the
     * source audio blob (recorded `audio/webm` or an uploaded file in any
     * format the platform can decode) plus the original filename if the
     * user picked a file from disk. The host is expected to dismiss the
     * modal and kick off the chunked-upload pipeline in the background
     * (see {@link startAudioJob}).
     */
    onSave: (source: Blob, fileName?: string | null) => void | Promise<void>;
}
/**
 * Modal microphone recorder. Lives in its own file so both the Home
 * dashboard and the Notes screen can launch it from their "Record
 * Audio" quick action without duplicating the MediaRecorder lifecycle.
 *
 * The modal also exposes an "or upload an audio file" affordance so
 * users with existing recordings can drop them into the same chunked-
 * audio → Gemma 4 → notes pipeline. Both code paths emit the same
 * `Blob` to `onSave`.
 *
 * Cleanup notes:
 *   - The MediaStream tracks are stopped both on stop() and on
 *     unmount, so dismissing the modal mid-recording releases the mic.
 *   - The preview ObjectURL is revoked on discard and unmount.
 */
export declare const AudioRecorderModal: FC<RecorderProps>;
export {};
//# sourceMappingURL=AudioRecorderModal.d.ts.map