import { type SyncDb } from "@studynest/sync";
import {
  CLOUD_API_BASE_URL,
  type SyncPullResponse,
  type SyncPushRequest,
  type SyncPushResponse,
  nowIso,
} from "@studynest/shared";
import { getDb, getDeviceId, getUserId } from "../db/client";
import {
  listOutbox,
  markOutboxSynced,
  recordOutboxFailure,
  upsertAttachment,
  upsertClass,
  upsertNote,
} from "../db/repositories";

export const mobileSyncDb: SyncDb = {
  async getDeviceId() {
    return getDeviceId();
  },
  async getUserId() {
    return getUserId();
  },
  async getLastPulledAt() {
    const db = await getDb();
    const row = (await db.getFirstAsync(
      "select last_pulled_at from sync_state where id = 1",
    )) as { last_pulled_at: string | null } | null;
    return row?.last_pulled_at ?? null;
  },
  async setLastPulledAt(iso) {
    const db = await getDb();
    await db.runAsync("update sync_state set last_pulled_at = ? where id = 1", [iso]);
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
      await db.runAsync(
        `update ${env.entity_type} set deleted_at = ?, updated_at = ? where id = ?`,
        [ts, ts, env.entity_id],
      );
      return "applied";
    }
    switch (env.entity_type) {
      case "classes":
        await upsertClass(p as any, skipOutbox);
        return "applied";
      case "notes":
        await upsertNote(p as any, skipOutbox);
        return "applied";
      case "attachments":
        await upsertAttachment(p as any, skipOutbox);
        return "applied";
      default:
        // Mobile MVP doesn't store quizzes/flashcards locally — those views
        // are desktop-first. Sync still lands them server-side via desktop.
        return "skipped";
    }
  },
};

export const mobileTransport = {
  async ping() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(`${CLOUD_API_BASE_URL}/health`, { signal: ctrl.signal });
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
    if (!res.ok) throw new Error(`push ${res.status}`);
    return (await res.json()) as SyncPushResponse;
  },
  async pull(req): Promise<SyncPullResponse> {
    const res = await fetch(`${CLOUD_API_BASE_URL}/sync/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`pull ${res.status}`);
    return (await res.json()) as SyncPullResponse;
  },
};
