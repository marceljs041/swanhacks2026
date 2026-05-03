import { type SyncDb, buildOutboxRow } from "@studynest/sync";
import {
  CLOUD_API_BASE_URL,
  type SyncEnvelope,
  type SyncPullRequest,
  type SyncPullResponse,
  type SyncPushRequest,
  type SyncPushResponse,
  nowIso,
} from "@studynest/shared";
import { getDb, getDeviceId, getUserId } from "../db/client.js";
import {
  listOutbox,
  markOutboxSynced,
  recordOutboxFailure,
  upsertClass,
  upsertFlashcard,
  upsertFlashcardSet,
  upsertNote,
  upsertQuiz,
  upsertQuizQuestion,
  upsertStudyPlan,
  upsertStudyTask,
  saveQuizSession,
  upsertRewardPointsEvent,
} from "../db/repositories.js";
import {
  upsertEvent as upsertCalendarEvent,
  upsertChecklistItem,
} from "../db/calendar.js";

export const desktopSyncDb: SyncDb = {
  async getDeviceId() {
    return getDeviceId();
  },
  async getUserId() {
    return getUserId();
  },
  async getLastPulledAt() {
    const db = await getDb();
    const row = db.prepare("select last_pulled_at from sync_state where id = 1").get() as
      | { last_pulled_at: string | null }
      | undefined;
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
  async applyRemote(env): Promise<"applied" | "conflict" | "skipped"> {
    const skipOutbox = { skipOutbox: true } as const;
    const p = env.payload as Record<string, any>;

    if (env.operation === "delete") {
      const db = await getDb();
      const ts = nowIso();
      if (env.entity_type === "quiz_sessions") {
        db.prepare("delete from quiz_sessions where quiz_id = ?").run(env.entity_id);
        return "applied";
      }
      db.prepare(
        `update ${env.entity_type} set deleted_at = ?, updated_at = ? where id = ?`,
      ).run(ts, ts, env.entity_id);
      return "applied";
    }

    switch (env.entity_type) {
      case "classes":
        await upsertClass(p as any, skipOutbox);
        return "applied";
      case "notes":
        await upsertNote(p as any, skipOutbox);
        return "applied";
      case "flashcard_sets":
        await upsertFlashcardSet(p as any, skipOutbox);
        return "applied";
      case "flashcards":
        await upsertFlashcard(p as any, skipOutbox);
        return "applied";
      case "quizzes":
        await upsertQuiz(p as any, skipOutbox);
        return "applied";
      case "quiz_questions":
        await upsertQuizQuestion(p as any, skipOutbox);
        return "applied";
      case "quiz_sessions": {
        const raw = p.answers_json;
        const answers =
          typeof raw === "string"
            ? (JSON.parse(raw || "{}") as Record<string, string>)
            : ((raw as Record<string, string>) ?? {});
        await saveQuizSession(
          {
            quiz_id: (p.quiz_id as string) ?? env.entity_id,
            current_index: Number(p.current_index ?? 0),
            answers,
            started_at: p.started_at as string | undefined,
          },
          skipOutbox,
        );
        return "applied";
      }
      case "study_plans":
        await upsertStudyPlan(p as any, skipOutbox);
        return "applied";
      case "study_tasks":
        await upsertStudyTask(p as any, skipOutbox);
        return "applied";
      case "calendar_events":
        await upsertCalendarEvent(p as any, skipOutbox);
        return "applied";
      case "checklist_items":
        await upsertChecklistItem(p as any, skipOutbox);
        return "applied";
      case "reward_points_events":
        await upsertRewardPointsEvent(
          {
            id: String(p.id),
            action: String(p.action ?? "unknown"),
            points: Number(p.points ?? 0),
            created_at: String(p.created_at ?? nowIso()),
          },
          skipOutbox,
        );
        return "applied";
      default:
        return "skipped";
    }
  },
};

export const desktopTransport = {
  async ping() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(`${CLOUD_API_BASE_URL}/health`, {
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  },
  async push(req: SyncPushRequest): Promise<SyncPushResponse> {
    const res = await fetch(`${CLOUD_API_BASE_URL}/sync/push`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`push failed ${res.status}`);
    return (await res.json()) as SyncPushResponse;
  },
  async pull(req: SyncPullRequest): Promise<SyncPullResponse> {
    const res = await fetch(`${CLOUD_API_BASE_URL}/sync/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`pull failed ${res.status}`);
    return (await res.json()) as SyncPullResponse;
  },
};

void buildOutboxRow;
