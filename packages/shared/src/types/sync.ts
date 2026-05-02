import type { Iso8601 } from "./entities.js";

export type SyncOperation = "upsert" | "delete";

export type SyncStatus =
  | "offline"
  | "saving"
  | "synced"
  | "syncing"
  | "conflict"
  | "error";

export interface SyncEnvelope {
  entity_type: string;
  entity_id: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  client_updated_at: Iso8601;
  device_id: string;
}

export interface SyncOutboxRow {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: SyncOperation;
  payload_json: string;
  client_updated_at: Iso8601;
  created_at: Iso8601;
  synced_at: Iso8601 | null;
  retry_count: number;
  last_error: string | null;
}

export interface SyncPushRequest {
  device_id: string;
  user_id: string | null;
  envelopes: SyncEnvelope[];
}

export interface SyncPushResponse {
  /** Server-side `server_updated_at` per envelope for client reconciliation */
  applied: Array<{
    entity_type: string;
    entity_id: string;
    server_updated_at: Iso8601;
  }>;
  conflicts: Array<{
    entity_type: string;
    entity_id: string;
    reason: string;
    server_payload: Record<string, unknown>;
  }>;
}

export interface SyncPullRequest {
  device_id: string;
  user_id: string | null;
  /** ISO timestamp; null = full pull */
  since: Iso8601 | null;
  entity_types?: string[];
}

export interface SyncPullResponse {
  envelopes: SyncEnvelope[];
  /** Echo back; client persists as `last_pulled_at` */
  server_now: Iso8601;
}
