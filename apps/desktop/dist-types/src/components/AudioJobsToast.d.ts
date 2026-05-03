import type { FC } from "react";
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
export declare const AudioJobsToast: FC;
//# sourceMappingURL=AudioJobsToast.d.ts.map