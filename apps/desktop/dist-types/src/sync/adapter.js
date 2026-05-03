import { buildOutboxRow } from "@studynest/sync";
import { CLOUD_API_BASE_URL, nowIso, } from "@studynest/shared";
import { getDb, getDeviceId, getUserId } from "../db/client.js";
import { listOutbox, markOutboxSynced, recordOutboxFailure, upsertClass, upsertFlashcard, upsertFlashcardSet, upsertNote, upsertQuiz, upsertQuizQuestion, upsertStudyPlan, upsertStudyTask, } from "../db/repositories.js";
export const desktopSyncDb = {
    async getDeviceId() {
        return getDeviceId();
    },
    async getUserId() {
        return getUserId();
    },
    async getLastPulledAt() {
        const db = await getDb();
        const row = db.prepare("select last_pulled_at from sync_state where id = 1").get();
        return row?.last_pulled_at ?? null;
    },
    async setLastPulledAt(iso) {
        const db = await getDb();
        db.prepare("update sync_state set last_pulled_at = ? where id = 1").run(iso);
    },
    async listOutbox(limit) {
        return listOutbox(limit);
    },
    async markSynced(ids) {
        await markOutboxSynced(ids);
    },
    async recordOutboxFailure(id, error) {
        await recordOutboxFailure(id, error);
    },
    async applyRemote(env) {
        const skipOutbox = { skipOutbox: true };
        const p = env.payload;
        if (env.operation === "delete") {
            const db = await getDb();
            const ts = nowIso();
            db.prepare(`update ${env.entity_type} set deleted_at = ?, updated_at = ? where id = ?`).run(ts, ts, env.entity_id);
            return "applied";
        }
        switch (env.entity_type) {
            case "classes":
                await upsertClass(p, skipOutbox);
                return "applied";
            case "notes":
                await upsertNote(p, skipOutbox);
                return "applied";
            case "flashcard_sets":
                await upsertFlashcardSet(p, skipOutbox);
                return "applied";
            case "flashcards":
                await upsertFlashcard(p, skipOutbox);
                return "applied";
            case "quizzes":
                await upsertQuiz(p, skipOutbox);
                return "applied";
            case "quiz_questions":
                await upsertQuizQuestion(p, skipOutbox);
                return "applied";
            case "study_plans":
                await upsertStudyPlan(p, skipOutbox);
                return "applied";
            case "study_tasks":
                await upsertStudyTask(p, skipOutbox);
                return "applied";
            default:
                return "skipped";
        }
    },
};
export const desktopTransport = {
    async ping() {
        try {
            const res = await fetch(`${CLOUD_API_BASE_URL}/health`, {
                signal: AbortSignal.timeout(2000),
            });
            return res.ok;
        }
        catch {
            return false;
        }
    },
    async push(req) {
        const res = await fetch(`${CLOUD_API_BASE_URL}/sync/push`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(req),
        });
        if (!res.ok)
            throw new Error(`push failed ${res.status}`);
        return (await res.json());
    },
    async pull(req) {
        const res = await fetch(`${CLOUD_API_BASE_URL}/sync/pull`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(req),
        });
        if (!res.ok)
            throw new Error(`pull failed ${res.status}`);
        return (await res.json());
    },
};
void buildOutboxRow;
//# sourceMappingURL=adapter.js.map