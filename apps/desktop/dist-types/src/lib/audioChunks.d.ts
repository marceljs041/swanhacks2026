/**
 * Audio chunking pipeline for the Gemma 4 E4B 30-second audio limit.
 *
 * Gemma 4's audio encoder accepts at most 30 s of mono 16 kHz float
 * audio per audio block. Recordings (or uploaded files) routinely
 * exceed that, so before they reach the sidecar we:
 *
 *   1. Decode whatever the renderer produced (`audio/webm`, `audio/mp4`,
 *      `audio/wav`, `audio/mpeg` …) via the platform's `AudioContext`.
 *   2. Down-mix to mono and resample to 16 kHz with an `OfflineAudioContext`.
 *   3. Slice the resulting Float32Array into ≤ {@link CHUNK_SECONDS}-second
 *      windows. The last slice can be shorter; we intentionally don't
 *      pad it with silence — Gemma is fine with short final chunks.
 *   4. Encode each slice as a 16-bit PCM WAV (the sidecar's `wave`
 *      module reads it directly to compute duration; the model uses
 *      the float32 conversion done server-side via librosa/soundfile).
 *
 * No third-party dependency (e.g. ffmpeg.wasm) is required — the Web
 * Audio API can decode every format Chromium / Electron support out
 * of the box, which covers all formats our recorder produces and the
 * common upload formats students use.
 */
/** Match the sidecar's MAX_CHUNK_SECONDS_TARGET. */
export declare const CHUNK_SECONDS = 30;
export interface AudioChunk {
    /** 0-based index in the chunk sequence. */
    index: number;
    /** Total number of chunks in this recording. */
    total: number;
    /** 16-bit PCM WAV blob ready to POST as multipart. */
    wav: Blob;
    /** Length of THIS chunk in seconds (≤ {@link CHUNK_SECONDS}). */
    seconds: number;
}
export interface ChunkingResult {
    chunks: AudioChunk[];
    /** Total seconds of audio captured (sum across chunks). */
    totalSeconds: number;
}
/**
 * Slice + WAV-encode a recording for the chunked upload pipeline.
 *
 * Caller passes either the live `MediaRecorder` blob or a `File` from
 * the `<input type="file">` upload. Both are handled the same way.
 */
export declare function chunkAudioFor30s(blob: Blob): Promise<ChunkingResult>;
//# sourceMappingURL=audioChunks.d.ts.map