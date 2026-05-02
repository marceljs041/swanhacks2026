import type { CreateHazardInput, Hazard, HazardVote } from "@cyaccess/shared";
import { supabase } from "../lib/supabase";
import { hazardFromRow, type HazardRow } from "../lib/row-mappers";

export type HazardQuery = {
  buildingId?: string;
  floorId?: string;
  includeResolved?: boolean;
  limit?: number;
};

export async function listHazards(query: HazardQuery = {}): Promise<Hazard[]> {
  let q = supabase.from("hazards").select("*").order("created_at", { ascending: false });
  if (!query.includeResolved) {
    q = q.in("status", ["active", "pending_resolved"]);
  }
  if (query.buildingId) q = q.eq("building_id", query.buildingId);
  if (query.floorId) q = q.eq("floor_id", query.floorId);
  q = q.limit(query.limit ?? 200);

  const { data, error } = await q;
  if (error) throw error;
  return (data as HazardRow[]).map(hazardFromRow);
}

export async function getHazard(id: string): Promise<Hazard | null> {
  const { data, error } = await supabase.from("hazards").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? hazardFromRow(data as HazardRow) : null;
}

export async function createHazard(
  deviceId: string,
  input: CreateHazardInput,
): Promise<Hazard> {
  const { data, error } = await supabase
    .from("hazards")
    .insert({
      building_id: input.buildingId ?? null,
      floor_id: input.floorId ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      indoor_x: input.indoorX ?? null,
      indoor_y: input.indoorY ?? null,
      type: input.type,
      severity: input.severity,
      description: input.description ?? null,
      image_url: input.imageUrl ?? null,
      ai_confidence: input.aiConfidence ?? null,
      status: "active",
      created_by_device_id: deviceId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return hazardFromRow(data as HazardRow);
}

export async function resolveHazard(id: string): Promise<Hazard> {
  const { data, error } = await supabase
    .from("hazards")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return hazardFromRow(data as HazardRow);
}

/**
 * Record a vote and apply status transitions.
 *
 *   1 resolved vote  -> pending_resolved
 *   2 resolved votes -> resolved
 *   2 still_there votes on a pending hazard -> active again
 */
export async function voteHazard(
  hazardId: string,
  deviceId: string,
  vote: HazardVote,
): Promise<Hazard> {
  const { error: voteErr } = await supabase
    .from("hazard_votes")
    .upsert(
      { hazard_id: hazardId, device_id: deviceId, vote },
      { onConflict: "hazard_id,device_id" },
    );
  if (voteErr) throw voteErr;

  const { data: votes, error: countErr } = await supabase
    .from("hazard_votes")
    .select("vote")
    .eq("hazard_id", hazardId);
  if (countErr) throw countErr;

  const resolvedCount = (votes ?? []).filter((v) => v.vote === "resolved").length;
  const stillThereCount = (votes ?? []).filter((v) => v.vote === "still_there").length;

  let nextStatus: "active" | "pending_resolved" | "resolved" = "active";
  if (resolvedCount >= 2) nextStatus = "resolved";
  else if (resolvedCount === 1 && stillThereCount === 0) nextStatus = "pending_resolved";
  else if (stillThereCount >= 2) nextStatus = "active";

  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "resolved") patch.resolved_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("hazards")
    .update(patch)
    .eq("id", hazardId)
    .select("*")
    .single();
  if (error) throw error;
  return hazardFromRow(data as HazardRow);
}
