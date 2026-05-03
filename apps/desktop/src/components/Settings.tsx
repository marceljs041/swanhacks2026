import type { FC } from "react";
import { useState } from "react";
import { CLOUD_API_BASE_URL } from "@studynest/shared";
import { themes, type ThemeName } from "@studynest/ui";
import { useApp } from "../store.js";
import { setUserId } from "../db/client.js";
import { Card } from "./ui/Card.js";
import { Placeholder } from "./ui/Placeholder.js";
import { CheckIcon, SettingsIcon } from "./icons.js";

export const Settings: FC = () => {
  const sidecarLoaded = useApp((s) => s.sidecarLoaded);
  const syncStatus = useApp((s) => s.syncStatus);
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);

  const [pairCode, setPairCode] = useState<string | null>(null);
  const [enterCode, setEnterCode] = useState("");
  const [pairResult, setPairResult] = useState<string | null>(null);

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
    <main className="main">
      <div className="main-inner">
        <div className="page-header">
          <SettingsIcon size={22} />
          <h1>Settings</h1>
        </div>

        <div className="settings-grid">
          {/* Theme switcher — proves the modular palette in action. */}
          <Card title="Appearance">
            <div className="setting-row" style={{ background: "transparent", border: "none", padding: 0 }}>
              <div className="meta">
                <span className="name">Theme</span>
                <span className="desc">
                  Pick a colour palette. More themes can be added by extending
                  <code style={{ marginLeft: 4 }}>@studynest/ui</code>.
                </span>
              </div>
              <div className="theme-swatches">
                {(Object.keys(themes) as ThemeName[]).map((name) => (
                  <ThemeSwatch
                    key={name}
                    name={name}
                    active={theme === name}
                    onPick={() => setTheme(name)}
                  />
                ))}
              </div>
            </div>
          </Card>

          <Card title="Learning assistant">
            <div style={{ fontSize: 13 }}>
              {sidecarLoaded ? (
                <span>Ready to help with summaries, quizzes, and questions in your notes.</span>
              ) : (
                <span style={{ color: "var(--color-textMuted)" }}>
                  The assistant is still starting. If this lasts more than a minute, fully quit the app
                  and open it again.
                </span>
              )}
            </div>
          </Card>

          <Card title="Sync">
            <div style={{ fontSize: 13 }}>
              Status: <span className={`pill ${syncStatus}`}><span className="dot" /> {syncStatus}</span>
            </div>
          </Card>

          <Card title="Device pairing">
            <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <button className="btn-secondary" onClick={() => void startPair()}>
                  Generate pairing code
                </button>
                {pairCode && (
                  <div style={{ marginTop: 12, fontSize: 32, fontWeight: 700, letterSpacing: 6 }}>
                    {pairCode}
                  </div>
                )}
              </div>
              <div style={{ minWidth: 280, display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  className="field"
                  placeholder="Enter pairing code from another device"
                  value={enterCode}
                  onChange={(e) => setEnterCode(e.target.value)}
                />
                <button className="btn-primary" onClick={() => void confirmPair()}>
                  Pair this device
                </button>
                {pairResult && (
                  <div style={{ color: "var(--color-textMuted)", fontSize: 12 }}>{pairResult}</div>
                )}
              </div>
            </div>
          </Card>

          <Card title="Notifications">
            <Placeholder
              title="Notifications not yet implemented"
              description="Daily study reminders and deadline pings are on the roadmap."
            />
          </Card>

          <Card title="Account">
            <Placeholder
              title="Account management not yet implemented"
              description="Profile, password, and subscription settings will live here."
            />
          </Card>
        </div>
      </div>
    </main>
  );
};

const ThemeSwatch: FC<{ name: ThemeName; active: boolean; onPick: () => void }> = ({
  name,
  active,
  onPick,
}) => {
  const palette = themes[name];
  return (
    <button
      type="button"
      className={`theme-swatch ${active ? "active" : ""}`}
      title={name}
      onClick={onPick}
      style={{
        background: `linear-gradient(135deg, ${palette.primary} 0 50%, ${palette.surface} 50% 100%)`,
        borderColor: active ? palette.primary : "var(--color-border)",
      }}
    >
      {active && <CheckIcon size={14} />}
    </button>
  );
};
