import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SyncWorker } from "@studynest/sync";
import { getDb } from "@/db/client";
import { mobileSyncDb, mobileTransport } from "@/sync/adapter";
import { useApp } from "@/store";
import { colors } from "@/theme";

let workerStarted = false;

export default function RootLayout() {
  const setSyncStatus = useApp((s) => s.setSyncStatus);

  useEffect(() => {
    if (workerStarted) return;
    workerStarted = true;
    void getDb();
    const worker = new SyncWorker({
      db: mobileSyncDb,
      transport: mobileTransport,
      intervalMs: 12000,
      onStatusChange: setSyncStatus,
    });
    worker.start();
    return () => worker.stop();
  }, [setSyncStatus]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
        <Stack.Screen name="notes/[id]" options={{ title: "Note" }} />
        <Stack.Screen name="notes/new" options={{ presentation: "modal", title: "Capture" }} />
      </Stack>
    </>
  );
}
