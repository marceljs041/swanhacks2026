import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import { MicIcon } from "./icons.js";

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
export const AudioRecorderModal: FC<RecorderProps> = ({ onClose, onSave }) => {
  const [state, setState] = useState<"idle" | "recording" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      tickRef.current && clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      previewUrl && URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start(): Promise<void> {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        setState("ready");
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      rec.start();
      recorderRef.current = rec;
      setSeconds(0);
      setState("recording");
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      setError((e as Error).message || "Microphone permission denied.");
      setState("error");
    }
  }

  function stop(): void {
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
    tickRef.current && clearInterval(tickRef.current);
    tickRef.current = null;
  }

  function discard(): void {
    setBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSeconds(0);
    setState("idle");
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Record audio</span>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="recorder">
          <div className={`recorder-orb ${state}`} aria-hidden>
            <MicIcon size={28} />
          </div>
          <div className="recorder-time">{fmtTime(seconds)}</div>
          <div className="recorder-hint">
            {state === "idle" && "Click record to start. We'll save it as a new note."}
            {state === "recording" && "Recording… click stop when you're done."}
            {state === "ready" && "Preview your clip, then save or discard."}
            {state === "error" && (error ?? "Something went wrong.")}
          </div>
          {previewUrl && state === "ready" && (
            <audio controls src={previewUrl} style={{ width: "100%", marginTop: 8 }} />
          )}
          <div className="recorder-actions">
            {state === "idle" || state === "error" ? (
              <button className="btn-primary" onClick={() => void start()}>
                <MicIcon size={14} /> Record
              </button>
            ) : null}
            {state === "recording" && (
              <button className="btn-danger" onClick={stop}>Stop</button>
            )}
            {state === "ready" && (
              <>
                <button className="btn-secondary" onClick={discard}>Re-record</button>
                <button
                  className="btn-primary"
                  disabled={!blob}
                  onClick={() => blob && void onSave(blob)}
                >
                  Save as note
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}
