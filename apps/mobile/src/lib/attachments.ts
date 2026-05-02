/**
 * Save a media file from a system-managed cache URI to our app document
 * directory, then create the corresponding attachments row. Optionally
 * uploads to the cloud — for the demo, this is fire-and-forget.
 */
import * as FileSystem from "expo-file-system";
import { CLOUD_API_BASE_URL } from "@studynest/shared";
import { upsertAttachment } from "../db/repositories";
import type { AttachmentType } from "@studynest/shared";

const ATTACHMENT_DIR = `${FileSystem.documentDirectory ?? ""}attachments/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(ATTACHMENT_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(ATTACHMENT_DIR, { intermediates: true });
}

export async function saveAttachment(args: {
  noteId: string;
  type: AttachmentType;
  sourceUri: string;
  mimeType?: string | null;
  fileName?: string | null;
}): Promise<string> {
  await ensureDir();
  const ext =
    args.fileName?.split(".").pop() ??
    (args.mimeType?.split("/")[1] ?? (args.type === "image" ? "jpg" : "m4a"));
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const dest = `${ATTACHMENT_DIR}${filename}`;
  await FileSystem.copyAsync({ from: args.sourceUri, to: dest });

  const info = await FileSystem.getInfoAsync(dest);
  const row = await upsertAttachment({
    note_id: args.noteId,
    type: args.type,
    local_uri: dest,
    file_name: args.fileName ?? filename,
    mime_type: args.mimeType ?? null,
    size_bytes: (info as any).size ?? null,
  });
  // Background upload — non-blocking. If it fails, sync will retry the
  // metadata; the binary will be re-uploaded on the next attempt.
  void uploadInBackground(row.id, dest, args).catch(() => {});
  return row.id;
}

async function uploadInBackground(
  attachmentId: string,
  localUri: string,
  args: { noteId: string; mimeType?: string | null; fileName?: string | null },
): Promise<void> {
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists) return;
  const sizeBytes = (info as any).size ?? 0;

  const signRes = await fetch(`${CLOUD_API_BASE_URL}/attachments/upload-url`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      attachment_id: attachmentId,
      note_id: args.noteId,
      file_name: args.fileName ?? "file",
      mime_type: args.mimeType ?? "application/octet-stream",
      size_bytes: sizeBytes,
    }),
  });
  if (!signRes.ok) return;
  const { upload_url, public_url } = (await signRes.json()) as {
    upload_url: string;
    public_url: string | null;
  };
  if (!upload_url || upload_url.startsWith("memory://")) return;

  await FileSystem.uploadAsync(upload_url, localUri, {
    httpMethod: "PUT",
    headers: { "content-type": args.mimeType ?? "application/octet-stream" },
  });

  await upsertAttachment({
    id: attachmentId,
    note_id: args.noteId,
    type: "file" as AttachmentType,
    local_uri: localUri,
    remote_url: public_url,
    file_name: args.fileName ?? null,
    mime_type: args.mimeType ?? null,
    size_bytes: sizeBytes,
  });
}
