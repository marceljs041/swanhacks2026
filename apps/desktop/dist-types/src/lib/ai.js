import { LOCAL_AI_BASE_URL, } from "@studynest/shared";
async function localBase() {
    try {
        if (typeof window !== "undefined" && window.studynest?.sidecarBaseUrl) {
            const url = await window.studynest.sidecarBaseUrl();
            if (url?.trim())
                return url.trim();
        }
    }
    catch {
        /* preload not ready yet */
    }
    return LOCAL_AI_BASE_URL;
}
/** Desktop uses only the bundled local assistant — no remote AI fallback. */
async function localOnly(path, body) {
    const base = await localBase();
    const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok)
        throw new Error(`local ${path} ${res.status}`);
    return (await res.json());
}
export const ai = {
    async summarize(args) {
        return localOnly("/local-ai/summarize", args);
    },
    async flashcards(args) {
        return localOnly("/local-ai/flashcards", {
            count: 8,
            ...args,
        });
    },
    async quiz(args) {
        return localOnly("/local-ai/quiz", { count: 5, ...args });
    },
    async studyPlan(args) {
        return localOnly("/local-ai/study-plan", args);
    },
    async simpleExplain(args) {
        return localOnly("/local-ai/simple-explain", args);
    },
    async ask(args) {
        return localOnly("/local-ai/ask", args);
    },
    async classOverview(args) {
        return localOnly("/local-ai/class-overview", args);
    },
    /* ----- Chunked audio → notes (Gemma 4 E4B) ----- */
    /** Open a new audio session. The response tells us whether the
     * sidecar will use the real Gemma 4 backend or its placeholder stub
     * — surfaced in the toast so the user isn't lied to. */
    async createAudioSession() {
        const base = await localBase();
        const res = await fetch(`${base}/local-ai/audio-session`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
        });
        if (!res.ok)
            throw new Error(`createAudioSession ${res.status}`);
        return (await res.json());
    },
    /** Append one ≤30s WAV chunk in order. Caller MUST await each
     * promise before sending the next chunk so the server's per-session
     * state stays in arrival order. */
    async appendAudioChunk(args) {
        const base = await localBase();
        const form = new FormData();
        form.append("chunk", args.chunk, `chunk-${args.index}.wav`);
        form.append("index", String(args.index));
        form.append("total", String(args.total));
        const res = await fetch(`${base}/local-ai/audio-session/${encodeURIComponent(args.sessionId)}/chunk`, { method: "POST", body: form, signal: args.signal });
        if (!res.ok) {
            const detail = await res.text().catch(() => "");
            throw new Error(`appendAudioChunk ${res.status} ${detail}`);
        }
        return (await res.json());
    },
    /** Send the "now make the notes" turn. Returns the structured note
     * the renderer drops into `content_markdown`. The session is freed
     * server-side regardless of success / failure. */
    async finalizeAudioSession(sessionId, args = {}) {
        const base = await localBase();
        const res = await fetch(`${base}/local-ai/audio-session/${encodeURIComponent(sessionId)}/finalize`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(args),
            // Real model inference can take a while on CPU — give it the
            // same 5-minute ceiling the cloud /ai routes use.
            signal: AbortSignal.timeout(5 * 60_000),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => "");
            throw new Error(`finalizeAudioSession ${res.status} ${detail}`);
        }
        return (await res.json());
    },
};
//# sourceMappingURL=ai.js.map