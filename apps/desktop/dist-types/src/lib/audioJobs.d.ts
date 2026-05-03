/**
 * Global jobs registry for the chunked-audio → notes pipeline.
 *
 * The recorder modal closes as soon as the user clicks "Save", so the
 * actual chunking + upload + Gemma call has to run somewhere outside
 * the modal's lifecycle. We park each in-flight recording in this
 * Zustand store so:
 *
 *   - the {@link AudioJobsToast} can render live progress in the corner
 *     of every screen (the user can navigate freely while it runs);
 *   - the placeholder note we create on save can be patched once the
 *     model finishes (without the modal needing to be open);
 *   - cancellation is centralised — clicking "Cancel" on the toast
 *     aborts the in-flight fetch and tears the job down.
 *
 * Jobs are intentionally NOT persisted across app restarts — if the
 * window is closed mid-upload the audio session times out server-side
 * and the placeholder note is left in place for the user to delete or
 * retry. This matches the user-requested "background_toast" UX.
 */
export type AudioJobPhase = "preparing" | "uploading" | "generating" | "done" | "error" | "cancelled";
export interface AudioJob {
    id: string;
    noteId: string;
    /** Friendly title we put on the placeholder note before the model
     * picks a better one. */
    initialTitle: string;
    phase: AudioJobPhase;
    /** Total chunks (set after preparing finishes; -1 while preparing). */
    totalChunks: number;
    /** How many chunks have been accepted by the sidecar so far. */
    uploadedChunks: number;
    /** Total recording length in seconds (after preparing). */
    totalSeconds: number;
    /** Set after the createSession call succeeds. Used by error labels. */
    backend: "gemma4" | "stub" | null;
    /** Server-issued session id. Used for the final upload step. */
    sessionId: string | null;
    /** Last error message — only present when phase === "error". */
    errorMessage: string | null;
    /** ms epoch when the job moved to a terminal phase. The toast uses
     * this to auto-dismiss completed/cancelled jobs after a few seconds. */
    finishedAt: number | null;
    /** Internal: AbortController so the toast can cancel mid-flight. */
    controller: AbortController;
}
interface JobsState {
    jobs: Record<string, AudioJob>;
    order: string[];
    upsert: (id: string, patch: Partial<AudioJob>) => void;
    remove: (id: string) => void;
}
export declare const useAudioJobs: import("zustand").UseBoundStore<import("zustand").StoreApi<JobsState>>;
/** Produced for hooks (`useAudioJob(noteId)`) so individual screens can
 * react when "their" recording finishes — e.g. the NoteEditor can
 * refresh its content from disk without polling. */
export declare function selectActiveJobForNote(noteId: string): AudioJob | null;
export interface StartJobInput {
    /** Pre-created note row id; the pipeline will rewrite its content
     * once Gemma finishes. */
    noteId: string;
    /** Title shown in the toast and on the note while we wait. */
    initialTitle: string;
    /** Audio blob from the recorder OR a `File` from the upload input. */
    source: Blob;
}
/**
 * Kick off a chunked-audio job. Returns the job id immediately; the
 * actual work runs in the background and updates the store as it
 * progresses. Safe to fire and forget.
 */
export declare function startAudioJob(input: StartJobInput): string;
/** User-initiated cancel from the toast. Aborts the current fetch and
 * marks the job cancelled; the placeholder note is left in place so
 * the user can write into it manually if they want. */
export declare function cancelAudioJob(id: string): void;
export declare function isTerminal(phase: AudioJobPhase): boolean;
export {};
//# sourceMappingURL=audioJobs.d.ts.map