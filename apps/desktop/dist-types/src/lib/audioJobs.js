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
import { create } from "zustand";
import { ai } from "./ai.js";
import { chunkAudioFor30s } from "./audioChunks.js";
import { getNote, upsertNote } from "../db/repositories.js";
export const useAudioJobs = create((set) => ({
    jobs: {},
    order: [],
    upsert: (id, patch) => set((state) => {
        const prev = state.jobs[id];
        if (!prev && !patch)
            return state;
        const next = {
            id,
            noteId: patch?.noteId ?? prev?.noteId ?? "",
            initialTitle: patch?.initialTitle ?? prev?.initialTitle ?? "Voice note",
            phase: patch?.phase ?? prev?.phase ?? "preparing",
            totalChunks: patch?.totalChunks ?? prev?.totalChunks ?? -1,
            uploadedChunks: patch?.uploadedChunks ?? prev?.uploadedChunks ?? 0,
            totalSeconds: patch?.totalSeconds ?? prev?.totalSeconds ?? 0,
            backend: patch?.backend ?? prev?.backend ?? null,
            sessionId: patch?.sessionId ?? prev?.sessionId ?? null,
            errorMessage: patch?.errorMessage ?? prev?.errorMessage ?? null,
            finishedAt: patch?.finishedAt ?? prev?.finishedAt ?? null,
            controller: prev?.controller ?? patch?.controller ?? new AbortController(),
        };
        return {
            jobs: { ...state.jobs, [id]: next },
            order: prev ? state.order : [id, ...state.order],
        };
    }),
    remove: (id) => set((state) => {
        if (!state.jobs[id])
            return state;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [id]: _drop, ...rest } = state.jobs;
        return { jobs: rest, order: state.order.filter((x) => x !== id) };
    }),
}));
/** Produced for hooks (`useAudioJob(noteId)`) so individual screens can
 * react when "their" recording finishes — e.g. the NoteEditor can
 * refresh its content from disk without polling. */
export function selectActiveJobForNote(noteId) {
    const all = useAudioJobs.getState().jobs;
    for (const id of Object.keys(all)) {
        const j = all[id];
        if (j && j.noteId === noteId)
            return j;
    }
    return null;
}
/**
 * Kick off a chunked-audio job. Returns the job id immediately; the
 * actual work runs in the background and updates the store as it
 * progresses. Safe to fire and forget.
 */
export function startAudioJob(input) {
    const id = `aj_${Math.random().toString(36).slice(2, 10)}`;
    const controller = new AbortController();
    useAudioJobs.getState().upsert(id, {
        noteId: input.noteId,
        initialTitle: input.initialTitle,
        phase: "preparing",
        totalChunks: -1,
        uploadedChunks: 0,
        totalSeconds: 0,
        controller,
    });
    void runJob(id, input, controller).catch((err) => {
        console.error("[audio-job] crashed", err);
        useAudioJobs.getState().upsert(id, {
            phase: "error",
            errorMessage: err?.message ?? "Unknown error",
            finishedAt: Date.now(),
        });
    });
    return id;
}
/** User-initiated cancel from the toast. Aborts the current fetch and
 * marks the job cancelled; the placeholder note is left in place so
 * the user can write into it manually if they want. */
export function cancelAudioJob(id) {
    const job = useAudioJobs.getState().jobs[id];
    if (!job || isTerminal(job.phase))
        return;
    job.controller.abort();
    useAudioJobs.getState().upsert(id, {
        phase: "cancelled",
        finishedAt: Date.now(),
    });
}
export function isTerminal(phase) {
    return phase === "done" || phase === "error" || phase === "cancelled";
}
async function runJob(id, input, controller) {
    const update = (patch) => {
        useAudioJobs.getState().upsert(id, patch);
    };
    // 1. Decode + slice locally.
    const { chunks, totalSeconds } = await chunkAudioFor30s(input.source);
    if (controller.signal.aborted)
        return;
    if (chunks.length === 0) {
        throw new Error("Recording was empty after decoding.");
    }
    update({
        phase: "uploading",
        totalChunks: chunks.length,
        totalSeconds,
    });
    // 2. Open a sidecar session so we know which backend will run.
    let session;
    try {
        session = await ai.createAudioSession();
    }
    catch (e) {
        throw new Error("Couldn't reach the local AI sidecar. Is it running? " +
            (e.message ?? ""));
    }
    if (controller.signal.aborted)
        return;
    update({ sessionId: session.session_id, backend: session.backend });
    // 3. Stream chunks IN ORDER so the server's per-session list matches
    //    the recording. We deliberately do NOT parallelise the uploads —
    //    the sidecar serialises them anyway and out-of-order arrival
    //    would corrupt the audio.
    for (const chunk of chunks) {
        if (controller.signal.aborted)
            return;
        await uploadChunk(session.session_id, chunk, controller.signal);
        update({ uploadedChunks: chunk.index + 1 });
    }
    // 4. Tell the sidecar we're done; this is the "now make the notes"
    //    turn the user described. Long-running on CPU; we already set
    //    a 5-minute timeout in `ai.finalizeAudioSession`.
    update({ phase: "generating" });
    let result;
    try {
        result = await ai.finalizeAudioSession(session.session_id, {
            title_hint: input.initialTitle,
        });
    }
    catch (e) {
        throw new Error("Local model failed while generating notes: " + (e.message ?? ""));
    }
    if (controller.signal.aborted)
        return;
    // 5. Patch the placeholder note with the model's output. We
    //    re-fetch the row first so we preserve any class assignment,
    //    icon, or other fields the host set on creation — the upsert
    //    helper otherwise wipes anything we don't pass.
    const existing = await getNote(input.noteId);
    await upsertNote({
        ...(existing ?? {}),
        id: input.noteId,
        title: result.title || existing?.title || input.initialTitle,
        summary: result.summary || existing?.summary || null,
        content_markdown: composeNoteBody(result),
    });
    update({
        phase: "done",
        backend: result.backend,
        finishedAt: Date.now(),
    });
}
async function uploadChunk(sessionId, chunk, signal) {
    await ai.appendAudioChunk({
        sessionId,
        chunk: chunk.wav,
        index: chunk.index,
        total: chunk.total,
        signal,
    });
}
/** Glue Gemma's structured output into the markdown body the desktop
 * note editor expects. Keep it minimal — most of the model's output
 * already IS markdown. */
function composeNoteBody(r) {
    const parts = [];
    if (r.summary?.trim()) {
        parts.push(`> ${r.summary.trim()}`);
    }
    if (r.content_markdown?.trim()) {
        parts.push(r.content_markdown.trim());
    }
    if (r.key_terms?.length) {
        parts.push("### Key terms");
        for (const kt of r.key_terms) {
            const term = (kt.term || "").trim();
            const def = (kt.definition || "").trim();
            if (term)
                parts.push(`- **${term}** — ${def}`);
        }
    }
    if (r.backend === "stub" && parts.length === 0) {
        parts.push("_Audio captured but the local Gemma 4 audio backend wasn't " +
            "available. Open Settings → AI to install the audio extras._");
    }
    return parts.join("\n\n") + "\n";
}
//# sourceMappingURL=audioJobs.js.map