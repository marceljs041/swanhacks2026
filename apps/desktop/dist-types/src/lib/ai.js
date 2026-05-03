import { LOCAL_AI_BASE_URL, } from "@studynest/shared";
let _localBase = null;
async function localBase() {
    if (_localBase)
        return _localBase;
    if (typeof window !== "undefined" && window.studynest?.sidecarBaseUrl) {
        _localBase = await window.studynest.sidecarBaseUrl();
        return _localBase;
    }
    _localBase = LOCAL_AI_BASE_URL;
    return _localBase;
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
};
//# sourceMappingURL=ai.js.map