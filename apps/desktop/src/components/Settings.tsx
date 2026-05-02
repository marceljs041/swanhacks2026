import type { FC } from "react";
import { useEffect, useState } from "react";
import { CLOUD_API_BASE_URL } from "@studynest/shared";
import { useApp } from "../store.js";
import { setUserId } from "../db/client.js";

export const Settings: FC = () => {
  const sidecarLoaded = useApp((s) => s.sidecarLoaded);
  const sidecarModel = useApp((s) => s.sidecarModel);
  const syncStatus = useApp((s) => s.syncStatus);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [enterCode, setEnterCode] = useState("");
  const [pairResult, setPairResult] = useState<string | null>(null);

  useEffect(() => {
    void window.studynest?.sidecarStatus().then((s) => {
      // status is reflected by the App-level poller — this is just a refresh.
      void s;
    });
  }, []);

  async function startPair(): Promise<void> {
    const res = await fetch(`${CLOUD_API_BASE_URL}/devices/pair/start`, { method: "POST" });
    const data = (await res.json()) as { code: string; user_id: string };
    setPairCode(data.code);
    await setUserId(data.user_id);
  }

  async function confirmPair(): Promise<void> {
    const deviceId = (await window.studynest.sidecarBaseUrl()) ?? "desktop";
    const res = await fetch(`${CLOUD_API_BASE_URL}/devices/pair/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: enterCode, device_id: deviceId }),
    });
    if (!res.ok) {
      setPairResult("Invalid or expired code.");
      return;
    }
    const data = (await res.json()) as { user_id: string };
    await setUserId(data.user_id);
    setPairResult(`Paired. user_id ${data.user_id.slice(0, 8)}…`);
  }

  return (
    <div className="main">
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>Settings</h2>
      </div>
      <div style={{ padding: 24, display: "grid", gap: 24, maxWidth: 720 }}>
        <div className="stat-card">
          <div className="label">Local AI</div>
          <div style={{ marginTop: 8 }}>
            {sidecarLoaded ? (
              <>
                Loaded: <strong>{sidecarModel}</strong>
              </>
            ) : (
              <span style={{ color: "var(--muted)" }}>
                Local GGUF model is not loaded (sidecar may still be running). The app will
                fall back to the cloud API for AI. Run <code>pnpm desktop fetch-model</code>{" "}
                from the repo root, or set <code>STUDYNEST_GEMMA_MODEL_PATH</code> to an
                absolute path, then restart the desktop app.
              </span>
            )}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Sync</div>
          <div style={{ marginTop: 8 }}>
            Status: <span className={`pill ${syncStatus}`}>{syncStatus}</span>
          </div>
          <div style={{ marginTop: 8, color: "var(--muted)" }}>
            Cloud API: <code>{CLOUD_API_BASE_URL}</code>
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Device pairing</div>
          <div style={{ marginTop: 12, display: "flex", gap: 24, alignItems: "flex-start" }}>
            <div>
              <button onClick={() => void startPair()}>Generate pairing code</button>
              {pairCode && (
                <div style={{ marginTop: 12, fontSize: 32, fontWeight: 700, letterSpacing: 6 }}>
                  {pairCode}
                </div>
              )}
            </div>
            <div>
              <input
                placeholder="Enter pairing code from another device"
                value={enterCode}
                onChange={(e) => setEnterCode(e.target.value)}
                style={{ width: 280 }}
              />
              <button style={{ marginTop: 8 }} onClick={() => void confirmPair()}>
                Pair this device
              </button>
              {pairResult && (
                <div style={{ marginTop: 8, color: "var(--muted)" }}>{pairResult}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
