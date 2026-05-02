import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { DEVICE_ID_STORAGE_KEY } from "@cyaccess/shared";

let cachedId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedId) return cachedId;
  const existing = await SecureStore.getItemAsync(DEVICE_ID_STORAGE_KEY);
  if (existing) {
    cachedId = existing;
    return existing;
  }
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_STORAGE_KEY, id);
  cachedId = id;
  return id;
}

export async function clearDeviceId(): Promise<void> {
  cachedId = null;
  await SecureStore.deleteItemAsync(DEVICE_ID_STORAGE_KEY);
}
