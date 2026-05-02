import { env } from "../lib/env";
import { supabase } from "../lib/supabase";

export type UploadTarget = "hazard" | "board";

function bucketFor(target: UploadTarget): string {
  return target === "hazard" ? env.SUPABASE_HAZARD_BUCKET : env.SUPABASE_BOARD_BUCKET;
}

/**
 * Create a short-lived signed URL that mobile clients can PUT a JPEG/PNG to.
 */
export async function createSignedUpload(
  target: UploadTarget,
  deviceId: string,
): Promise<{ uploadUrl: string; path: string; token: string; publicReadUrl: string }> {
  const bucket = bucketFor(target);
  const fileName = `${deviceId}/${Date.now()}-${crypto.randomUUID()}.jpg`;

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(fileName);
  if (error || !data) throw error ?? new Error("Failed to create signed upload URL");

  const { data: publicData } = await supabase.storage.from(bucket).getPublicUrl(fileName);

  return {
    uploadUrl: data.signedUrl,
    token: data.token,
    path: fileName,
    publicReadUrl: publicData.publicUrl,
  };
}

export async function createSignedReadUrl(
  target: UploadTarget,
  path: string,
  seconds = 60 * 60,
): Promise<string> {
  const bucket = bucketFor(target);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (error || !data) throw error ?? new Error("Failed to create signed URL");
  return data.signedUrl;
}
