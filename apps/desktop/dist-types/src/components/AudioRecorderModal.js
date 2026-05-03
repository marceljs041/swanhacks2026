import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { MicIcon } from "./icons.js";
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
export const AudioRecorderModal = ({ onClose, onSave }) => {
    const [state, setState] = useState("idle");
    const [error, setError] = useState(null);
    const [seconds, setSeconds] = useState(0);
    const [blob, setBlob] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const streamRef = useRef(null);
    const tickRef = useRef(null);
    useEffect(() => {
        return () => {
            tickRef.current && clearInterval(tickRef.current);
            streamRef.current?.getTracks().forEach((t) => t.stop());
            previewUrl && URL.revokeObjectURL(previewUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    async function start() {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const rec = new MediaRecorder(stream);
            chunksRef.current = [];
            rec.ondataavailable = (e) => {
                if (e.data.size > 0)
                    chunksRef.current.push(e.data);
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
        }
        catch (e) {
            setError(e.message || "Microphone permission denied.");
            setState("error");
        }
    }
    function stop() {
        recorderRef.current?.state === "recording" && recorderRef.current.stop();
        tickRef.current && clearInterval(tickRef.current);
        tickRef.current = null;
    }
    function discard() {
        setBlob(null);
        if (previewUrl)
            URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setSeconds(0);
        setState("idle");
    }
    return (_jsx("div", { className: "modal-backdrop", role: "dialog", "aria-modal": "true", onClick: onClose, children: _jsxs("div", { className: "modal-card", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "modal-head", children: [_jsx("span", { className: "modal-title", children: "Record audio" }), _jsx("button", { className: "btn-ghost", onClick: onClose, children: "Close" })] }), _jsxs("div", { className: "recorder", children: [_jsx("div", { className: `recorder-orb ${state}`, "aria-hidden": true, children: _jsx(MicIcon, { size: 28 }) }), _jsx("div", { className: "recorder-time", children: fmtTime(seconds) }), _jsxs("div", { className: "recorder-hint", children: [state === "idle" && "Click record to start. We'll save it as a new note.", state === "recording" && "Recording… click stop when you're done.", state === "ready" && "Preview your clip, then save or discard.", state === "error" && (error ?? "Something went wrong.")] }), previewUrl && state === "ready" && (_jsx("audio", { controls: true, src: previewUrl, style: { width: "100%", marginTop: 8 } })), _jsxs("div", { className: "recorder-actions", children: [state === "idle" || state === "error" ? (_jsxs("button", { className: "btn-primary", onClick: () => void start(), children: [_jsx(MicIcon, { size: 14 }), " Record"] })) : null, state === "recording" && (_jsx("button", { className: "btn-danger", onClick: stop, children: "Stop" })), state === "ready" && (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn-secondary", onClick: discard, children: "Re-record" }), _jsx("button", { className: "btn-primary", disabled: !blob, onClick: () => blob && void onSave(blob), children: "Save as note" })] }))] })] })] }) }));
};
function fmtTime(s) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}
//# sourceMappingURL=AudioRecorderModal.js.map