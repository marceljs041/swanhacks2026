import { CLOUD_API_BASE_URL } from "@studynest/shared";
import { getDeviceId, getUserId, setUserId } from "../db/client.js";

/**
 * Ensures a row exists in Supabase `devices` whenever the API is reachable.
 * Offline-first users have no row until this runs after `ping` succeeds.
 */
export async function registerDeviceWithCloud(): Promise<void> {
  const device_id = await getDeviceId();
  const user_id = await getUserId();
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${CLOUD_API_BASE_URL}/devices/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        device_id,
        user_id,
        label: "Note Goat desktop",
      }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { resolved_user_id?: string };
    if (data.resolved_user_id && user_id == null) {
      await setUserId(data.resolved_user_id);
    }
  } catch {
    /* offline / timeout */
  } finally {
    window.clearTimeout(timer);
  }
}
