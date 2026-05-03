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

const TARGET_SAMPLE_RATE = 16_000;
/** Match the sidecar's MAX_CHUNK_SECONDS_TARGET. */
export const CHUNK_SECONDS = 30;

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
 * Decode an audio blob/File into a 16 kHz mono Float32Array.
 *
 * Uses an `OfflineAudioContext` for the resample step so we don't tie
 * up the hardware audio device — the recorder may still be running
 * in the background when this is called from the upload code path.
 */
async function decodeToMono16k(blob: Blob): Promise<Float32Array> {
  const arrayBuf = await blob.arrayBuffer();

  // A throwaway "live" AudioContext is the only way to get a working
  // `decodeAudioData` for arbitrary formats. We close it immediately
  // after decoding so the autoplay-policy doesn't spam a warning.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor: typeof AudioContext = (window as any).AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) {
    throw new Error("AudioContext not available in this runtime.");
  }
  const decodeCtx = new Ctor();
  let decoded: AudioBuffer;
  try {
    // Some browsers require the older callback signature. Use a small
    // adapter so both work.
    decoded = await new Promise<AudioBuffer>((resolve, reject) => {
      const maybePromise = decodeCtx.decodeAudioData(
        arrayBuf.slice(0),
        (b) => resolve(b),
        (e) => reject(e ?? new Error("decode failed")),
      );
      if (maybePromise && typeof (maybePromise as Promise<AudioBuffer>).then === "function") {
        (maybePromise as Promise<AudioBuffer>).then(resolve, reject);
      }
    });
  } finally {
    void decodeCtx.close().catch(() => {});
  }

  // Render through an OfflineAudioContext at 16 kHz mono. This handles
  // both the resample and the down-mix; the browser's resampler is
  // higher-quality than anything we'd hand-write in TS.
  const targetLength = Math.max(
    1,
    Math.round(decoded.duration * TARGET_SAMPLE_RATE),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const OfflineCtor: typeof OfflineAudioContext = (window as any).OfflineAudioContext ?? (window as any).webkitOfflineAudioContext;
  const offline = new OfflineCtor(1, targetLength, TARGET_SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

/**
 * Encode a Float32Array of mono 16 kHz audio into a 16-bit PCM WAV blob.
 *
 * The format string ("audio/wav") is what the multipart upload reports
 * as the file MIME — the sidecar checks the WAV header itself with
 * Python's `wave` module, so we don't need to worry about MIME sniffing.
 */
function floatToWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  let offset = 0;
  const writeString = (s: string): void => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset++, s.charCodeAt(i));
  };
  const writeUint32 = (n: number): void => {
    view.setUint32(offset, n, true);
    offset += 4;
  };
  const writeUint16 = (n: number): void => {
    view.setUint16(offset, n, true);
    offset += 2;
  };

  // RIFF header
  writeString("RIFF");
  writeUint32(36 + dataSize);
  writeString("WAVE");

  // fmt chunk
  writeString("fmt ");
  writeUint32(16); // PCM fmt chunk size
  writeUint16(1); // PCM format
  writeUint16(numChannels);
  writeUint32(sampleRate);
  writeUint32(byteRate);
  writeUint16(blockAlign);
  writeUint16(bitsPerSample);

  // data chunk
  writeString("data");
  writeUint32(dataSize);

  // Float [-1, 1] → int16. Anything outside that range gets clipped
  // (audible recordings are normalised by the recorder so this is
  // virtually never reached).
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Slice + WAV-encode a recording for the chunked upload pipeline.
 *
 * Caller passes either the live `MediaRecorder` blob or a `File` from
 * the `<input type="file">` upload. Both are handled the same way.
 */
export async function chunkAudioFor30s(blob: Blob): Promise<ChunkingResult> {
  const samples = await decodeToMono16k(blob);
  const totalSeconds = samples.length / TARGET_SAMPLE_RATE;
  if (samples.length === 0) {
    return { chunks: [], totalSeconds: 0 };
  }
  const samplesPerChunk = TARGET_SAMPLE_RATE * CHUNK_SECONDS;
  const totalChunks = Math.max(1, Math.ceil(samples.length / samplesPerChunk));

  const chunks: AudioChunk[] = [];
  for (let i = 0; i < totalChunks; i += 1) {
    const start = i * samplesPerChunk;
    const end = Math.min(samples.length, start + samplesPerChunk);
    const slice = samples.subarray(start, end);
    const wav = floatToWav(slice, TARGET_SAMPLE_RATE);
    chunks.push({
      index: i,
      total: totalChunks,
      wav,
      seconds: slice.length / TARGET_SAMPLE_RATE,
    });
  }
  return { chunks, totalSeconds };
}
