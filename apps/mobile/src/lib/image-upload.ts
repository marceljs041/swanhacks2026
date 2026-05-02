import { apiUpload } from "./api";

/**
 * Read a local file:// URI as a Blob and PUT it to the signed URL we got from
 * the API. Returns the public read URL to use for AI calls / DB storage.
 */
export async function uploadLocalImage(
  localUri: string,
  signed: { uploadUrl: string; token: string; publicReadUrl: string },
): Promise<string> {
  const res = await fetch(localUri);
  const blob = await res.blob();
  await apiUpload(signed.uploadUrl, signed.token, blob);
  return signed.publicReadUrl;
}
