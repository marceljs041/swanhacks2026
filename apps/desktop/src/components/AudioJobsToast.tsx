import type { FC } from "react";
import { useEffect } from "react";
import {
  cancelAudioJob,
  isTerminal,
  useAudioJobs,
  type AudioJob,
} from "../lib/audioJobs.js";
import { useApp } from "../store.js";
import { MicIcon } from "./icons.js";

/**
 * Floating bottom-right toast stack for in-flight audio→notes jobs.
 *
 * Mounted once at the App root so the user can navigate freely while
 * the sidecar is busy. Shows per-job progress (preparing → uploading
 * X/N → generating notes → done) and auto-dismisses terminal jobs
 * after 4 s. Clicking the toast jumps to the placeholder note so the
 * user can watch its body get rewritten when finalize completes.
 *
 * The progress wording mirrors what the user described: chunk-by-
 * chunk status until the final "make the notes" step kicks in.
 */
export const AudioJobsToast: FC = () => {
  const order = useAudioJobs((s) => s.order);
  const jobs = useAudioJobs((s) => s.jobs);
  const remove = useAudioJobs((s) => s.remove);

  // Auto-dismiss completed / errored / cancelled jobs after 4 s so the
  // toast stack doesn't grow without bound across a long session.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const id of order) {
      const j = jobs[id];
      if (!j || !j.finishedAt) continue;
      const elapsed = Date.now() - j.finishedAt;
      const remaining = Math.max(500, 4000 - elapsed);
      timers.push(setTimeout(() => remove(id), remaining));
    }
    return () => timers.forEach(clearTimeout);
  }, [order, jobs, remove]);

  if (order.length === 0) return null;

  return (
    <div className="audio-toast-stack" role="status" aria-live="polite">
      {order.map((id) => {
        const job = jobs[id];
        if (!job) return null;
        return <ToastCard key={id} job={job} />;
      })}
    </div>
  );
};

const ToastCard: FC<{ job: AudioJob }> = ({ job }) => {
  const setView = useApp((s) => s.setView);
  const phaseLabel = describePhase(job);
  const tone = toneFor(job.phase);
  const showProgress =
    job.phase === "uploading" && job.totalChunks > 0;
  const pct =
    showProgress && job.totalChunks > 0
      ? Math.min(100, Math.round((job.uploadedChunks / job.totalChunks) * 100))
      : null;
  const canCancel = !isTerminal(job.phase);

  return (
    <button
      type="button"
      className={`audio-toast tone-${tone}`}
      onClick={() => {
        if (job.noteId) setView({ kind: "note", noteId: job.noteId });
      }}
    >
      <span className="audio-toast-icon" aria-hidden>
        <MicIcon size={16} />
      </span>
      <span className="audio-toast-body">
        <span className="audio-toast-title">
          {job.initialTitle || "Voice note"}
        </span>
        <span className="audio-toast-sub">{phaseLabel}</span>
        {pct !== null && (
          <span className="audio-toast-bar" aria-hidden>
            <span className="audio-toast-bar-fill" style={{ width: `${pct}%` }} />
          </span>
        )}
      </span>
      {canCancel && (
        <span
          role="button"
          tabIndex={0}
          className="audio-toast-cancel"
          onClick={(e) => {
            e.stopPropagation();
            cancelAudioJob(job.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              cancelAudioJob(job.id);
            }
          }}
        >
          Cancel
        </span>
      )}
    </button>
  );
};

function describePhase(job: AudioJob): string {
  switch (job.phase) {
    case "preparing":
      return "Splitting recording into 30-second chunks…";
    case "uploading": {
      const n = Math.max(0, job.totalChunks);
      const done = Math.min(job.uploadedChunks, n);
      const backendNote =
        job.backend === "stub"
          ? " (Gemma 4 audio backend not loaded — saving as placeholder)"
          : "";
      return `Sending chunk ${done}/${n} to Gemma${backendNote}`;
    }
    case "generating":
      return "Gemma is writing your notes…";
    case "done":
      return job.backend === "stub"
        ? "Saved (placeholder — install audio extras for transcription)"
        : "Notes ready · tap to open";
    case "error":
      return job.errorMessage ?? "Something went wrong.";
    case "cancelled":
      return "Cancelled.";
  }
}

function toneFor(phase: AudioJob["phase"]): string {
  switch (phase) {
    case "done":
      return "success";
    case "error":
      return "danger";
    case "cancelled":
      return "muted";
    default:
      return "info";
  }
}
