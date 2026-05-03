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

import {
  recordXp,
  upsertAttachment,
  upsertNote,
} from "../db/repositories.js";
import { XP_RULES, type NoteRow } from "@studynest/shared";
import { startAudioJob } from "./audioJobs.js";

export interface CaptureAudioOptions {
  blob: Blob;
  /** Original filename when the user uploaded a file. Falls back to
   * the standard "Voice note" timestamped title for live recordings. */
  fileName?: string | null;
  /** Optional class assignment for the resulting note. */
  classId?: string | null;
}

const TRANSCRIBING_PLACEHOLDER =
  "_Transcribing recording with Gemma 4 — this note will fill in " +
  "automatically when the model finishes._";

export async function captureAudioToNote(
  opts: CaptureAudioOptions,
): Promise<NoteRow> {
  const dataUri = await blobToDataUri(opts.blob);
  const friendlyFileName = sanitizeFileName(opts.fileName) ?? "recording.webm";
  const title = deriveInitialTitle(opts.fileName);

  const note = await upsertNote({
    title,
    class_id: opts.classId ?? null,
    content_markdown: TRANSCRIBING_PLACEHOLDER,
  });
  await upsertAttachment({
    note_id: note.id,
    type: "audio",
    local_uri: dataUri,
    file_name: friendlyFileName,
    mime_type: opts.blob.type || "audio/webm",
    size_bytes: opts.blob.size,
  });
  // Award XP at creation time (mirrors pre-pipeline behaviour). The
  // background job intentionally does NOT award additional XP when it
  // patches the note — that would feel like double-counting.
  await recordXp("createNote", XP_RULES.createNote).catch(() => {});

  startAudioJob({
    noteId: note.id,
    initialTitle: title,
    source: opts.blob,
  });

  return note;
}

function deriveInitialTitle(fileName: string | null | undefined): string {
  if (fileName && fileName.trim()) {
    const base = stripExtension(fileName.trim());
    if (base) return base.slice(0, 80);
  }
  const stamp = new Date().toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `Voice note · ${stamp}`;
}

function stripExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function sanitizeFileName(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  return trimmed.replace(/[\u0000-\u001f]/g, "").slice(0, 200);
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}
