import Constants from "expo-constants";
import { DEVICE_ID_HEADER } from "@cyaccess/shared";
import { getDeviceId } from "./device";

const fallbackUrl = "http://localhost:8787";

function getBaseUrl(): string {
  // Expo inlines EXPO_PUBLIC_* env vars at build time.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromEnv: string | undefined = (globalThis as any)?.process?.env?.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const fromExpo =
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? null;
  return (fromExpo ?? fallbackUrl).replace(/\/$/, "");
}

export type ApiError = {
  status: number;
  message: string;
  body?: unknown;
};

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const deviceId = await getDeviceId();
  const url = `${getBaseUrl()}${path}`;
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set(DEVICE_ID_HEADER, deviceId);

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    const err: ApiError = {
      status: res.status,
      message:
        (body as { error?: string } | null)?.error ??
        `Request failed (${res.status})`,
      body,
    };
    throw err;
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiUpload(
  uploadUrl: string,
  token: string,
  blob: Blob,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": blob.type || "image/jpeg",
      Authorization: `Bearer ${token}`,
    },
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }
}
