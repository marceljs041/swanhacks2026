import { APPLY_ORDER, type SyncableEntity } from "@studynest/db-schema";
import {
  nowIso,
  type SyncEnvelope,
  type SyncOutboxRow,
  type SyncPullResponse,
  type SyncPushRequest,
  type SyncPushResponse,
  type SyncStatus,
} from "@studynest/shared";

/**
 * Adapter contract implemented by mobile (expo-sqlite) and desktop
 * (better-sqlite3). All methods return promises so the same worker code
 * runs on both runtimes.
 */
export interface SyncDb {
  getDeviceId(): Promise<string>;
  getUserId(): Promise<string | null>;
  getLastPulledAt(): Promise<string | null>;
  setLastPulledAt(iso: string): Promise<void>;

  /** Returns oldest unsynced rows up to `limit`. */
  listOutbox(limit: number): Promise<SyncOutboxRow[]>;
  markSynced(ids: string[]): Promise<void>;
  recordOutboxFailure(id: string, error: string): Promise<void>;

  /**
   * Apply a remote envelope to the local DB. Implementations should:
   *  - perform a soft-delete when operation === "delete"
   *  - upsert the row otherwise
   *  - return "applied" | "conflict" | "skipped"
   *  - on conflict, the implementation is responsible for writing a
   *    "conflict copy" if appropriate (see notes repository).
   *
   * IMPORTANT: rows applied by sync MUST NOT be re-enqueued into the
   * outbox. Implementations should call their repository write with a
   * `{ skipOutbox: true }` flag.
   */
  applyRemote(envelope: SyncEnvelope): Promise<"applied" | "conflict" | "skipped">;
}

export interface SyncTransport {
  push(req: SyncPushRequest): Promise<SyncPushResponse>;
  pull(req: {
    device_id: string;
    user_id: string | null;
    since: string | null;
  }): Promise<SyncPullResponse>;
  /** Returns true if the cloud API is reachable. */
  ping(): Promise<boolean>;
}

export interface SyncWorkerOptions {
  db: SyncDb;
  transport: SyncTransport;
  batchSize?: number;
  intervalMs?: number;
  onStatusChange?: (status: SyncStatus) => void;
  onLog?: (msg: string, meta?: unknown) => void;
}

export class SyncWorker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private status: SyncStatus = "offline";

  constructor(private readonly opts: SyncWorkerOptions) {}

  start(): void {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.opts.intervalMs ?? 8000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  /** Force a single sync pass. Safe to call from a UI button. */
  async syncNow(): Promise<void> {
    await this.tick(true);
  }

  private setStatus(next: SyncStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.opts.onStatusChange?.(next);
  }

  private log(msg: string, meta?: unknown): void {
    this.opts.onLog?.(msg, meta);
  }

  private async tick(force = false): Promise<void> {
    if (this.running && !force) return;
    this.running = true;
    try {
      const reachable = await this.opts.transport.ping().catch(() => false);
      if (!reachable) {
        this.setStatus("offline");
        return;
      }
      this.setStatus("syncing");
      await this.pushOnce();
      await this.pullOnce();
      this.setStatus("synced");
    } catch (err) {
      this.log("sync error", err);
      this.setStatus("error");
    } finally {
      this.running = false;
    }
  }

  private async pushOnce(): Promise<void> {
    const batch = await this.opts.db.listOutbox(this.opts.batchSize ?? 100);
    if (batch.length === 0) return;
    const device_id = await this.opts.db.getDeviceId();
    const user_id = await this.opts.db.getUserId();
    const envelopes: SyncEnvelope[] = batch.map((row) => ({
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      operation: row.operation,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      client_updated_at: row.client_updated_at,
      device_id,
    }));
    const res = await this.opts.transport.push({ device_id, user_id, envelopes });
    const appliedKeys = new Set(
      res.applied.map((a) => `${a.entity_type}:${a.entity_id}`),
    );
    const okIds = batch
      .filter((r) => appliedKeys.has(`${r.entity_type}:${r.entity_id}`))
      .map((r) => r.id);
    if (okIds.length) await this.opts.db.markSynced(okIds);
    for (const c of res.conflicts) {
      const failed = batch.find(
        (r) => r.entity_type === c.entity_type && r.entity_id === c.entity_id,
      );
      if (failed) await this.opts.db.recordOutboxFailure(failed.id, c.reason);
    }
    this.log(`pushed ${okIds.length}/${batch.length}`);
  }

  private async pullOnce(): Promise<void> {
    const device_id = await this.opts.db.getDeviceId();
    const user_id = await this.opts.db.getUserId();
    const since = await this.opts.db.getLastPulledAt();
    const res = await this.opts.transport.pull({ device_id, user_id, since });
    if (res.envelopes.length === 0) {
      await this.opts.db.setLastPulledAt(res.server_now);
      return;
    }
    // Apply parents before children to satisfy FK constraints.
    const sorted = [...res.envelopes].sort(
      (a, b) =>
        APPLY_ORDER.indexOf(a.entity_type as SyncableEntity) -
        APPLY_ORDER.indexOf(b.entity_type as SyncableEntity),
    );
    let conflicts = 0;
    for (const env of sorted) {
      const result = await this.opts.db.applyRemote(env).catch((err) => {
        this.log("apply failed", { env, err });
        return "skipped" as const;
      });
      if (result === "conflict") conflicts += 1;
    }
    await this.opts.db.setLastPulledAt(res.server_now);
    this.log(`pulled ${sorted.length} (conflicts ${conflicts})`);
    if (conflicts > 0) this.setStatus("conflict");
  }
}

/**
 * Helper used by repositories to enqueue a write into the outbox. Must be
 * called inside the same transaction as the row mutation.
 */
export function buildOutboxRow(args: {
  entity_type: string;
  entity_id: string;
  operation: "upsert" | "delete";
  payload: Record<string, unknown>;
}): Omit<SyncOutboxRow, "synced_at" | "retry_count" | "last_error"> & {
  retry_count: 0;
} {
  const ts = nowIso();
  return {
    id: `obx_${args.entity_type}_${args.entity_id}_${ts}`,
    entity_type: args.entity_type,
    entity_id: args.entity_id,
    operation: args.operation,
    payload_json: JSON.stringify(args.payload),
    client_updated_at: ts,
    created_at: ts,
    retry_count: 0,
  };
}
