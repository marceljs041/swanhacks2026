/**
 * Common "user just finished a recording / picked an audio file" plumbing.
 *
 * Both the Home dashboard, the Notes list, the All-notes screen, and
 * (eventually) the class-ask screen funnel through this so the UX stays
 * consistent: one note row, one audio attachment, one background job
 * that rewrites the note's body once Gemma 4 finishes the transcript.
 *
 * The helper:
 *   1. Saves the source blob as a data-URI attachment so the user can
 *      replay the original audio inside the note even before the model
 *      finishes (and the note still has audio if the model fails).
 *   2. Creates the note row with a "Transcribing…" placeholder body so
 *      jumping to the editor immediately feels alive.
 *   3. Awards the standard "createNote" XP up front (matches the old
 *      pre-pipeline behaviour — the user still made a note).
 *   4. Kicks off the chunked-audio → Gemma pipeline. The toast handles
 *      progress + the body is rewritten when finalize succeeds.
 *
 * Returns the freshly-created note row so the caller can navigate to
 * it. The pipeline runs in the background and updates the same row.
 */
import { type NoteRow } from "@studynest/shared";
export interface CaptureAudioOptions {
    blob: Blob;
    /** Original filename when the user uploaded a file. Falls back to
     * the standard "Voice note" timestamped title for live recordings. */
    fileName?: string | null;
    /** Optional class assignment for the resulting note. */
    classId?: string | null;
}
export declare function captureAudioToNote(opts: CaptureAudioOptions): Promise<NoteRow>;
//# sourceMappingURL=audioCapture.d.ts.map