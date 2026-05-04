import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { CLOUD_API_BASE_URL } from "@studynest/shared";
import { themes } from "@studynest/ui";
import { useApp } from "../store.js";
import { getDeviceId, setUserId } from "../db/client.js";
import { Card } from "./ui/Card.js";
import { Placeholder } from "./ui/Placeholder.js";
import { CheckIcon, SettingsIcon } from "./icons.js";
export const Settings = () => {
    const sidecarLoaded = useApp((s) => s.sidecarLoaded);
    const sidecarError = useApp((s) => s.sidecarError);
    const syncStatus = useApp((s) => s.syncStatus);
    const theme = useApp((s) => s.theme);
    const setTheme = useApp((s) => s.setTheme);
    const [pairCode, setPairCode] = useState(null);
    const [enterCode, setEnterCode] = useState("");
    const [pairResult, setPairResult] = useState(null);
    async function startPair() {
        const res = await fetch(`${CLOUD_API_BASE_URL}/devices/pair/start`, { method: "POST" });
        const data = (await res.json());
        setPairCode(data.code);
        await setUserId(data.user_id);
    }
    async function confirmPair() {
        const deviceId = await getDeviceId();
        const res = await fetch(`${CLOUD_API_BASE_URL}/devices/pair/confirm`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code: enterCode, device_id: deviceId }),
        });
        if (!res.ok) {
            setPairResult("Invalid or expired code.");
            return;
        }
        const data = (await res.json());
        await setUserId(data.user_id);
        setPairResult(`Paired. user_id ${data.user_id.slice(0, 8)}…`);
    }
    return (_jsx("main", { className: "main", children: _jsxs("div", { className: "main-inner", children: [_jsxs("div", { className: "page-header", children: [_jsx(SettingsIcon, { size: 22 }), _jsx("h1", { children: "Settings" })] }), _jsxs("div", { className: "settings-grid", children: [_jsx(Card, { title: "Appearance", children: _jsxs("div", { className: "setting-row", style: { background: "transparent", border: "none", padding: 0 }, children: [_jsxs("div", { className: "meta", children: [_jsx("span", { className: "name", children: "Theme" }), _jsxs("span", { className: "desc", children: ["Pick a colour palette. More themes can be added by extending", _jsx("code", { style: { marginLeft: 4 }, children: "@studynest/ui" }), "."] })] }), _jsx("div", { className: "theme-swatches", children: Object.keys(themes).map((name) => (_jsx(ThemeSwatch, { name: name, active: theme === name, onPick: () => setTheme(name) }, name))) })] }) }), _jsx(Card, { title: "Learning assistant", children: _jsx("div", { style: { fontSize: 13 }, children: sidecarLoaded ? (_jsx("span", { children: "Ready to help with summaries, quizzes, and questions in your notes." })) : sidecarError ? (_jsxs("span", { style: { color: "var(--color-danger, #b42318)" }, children: ["Local AI failed to start: ", sidecarError, " Voice notes use a separate Gemma 4 audio stack if installed; otherwise they fall back to a placeholder until Python deps and models are available."] })) : (_jsx("span", { style: { color: "var(--color-textMuted)" }, children: "The assistant is still starting. If this lasts more than a minute, fully quit the app and open it again." })) }) }), _jsx(Card, { title: "Sync", children: _jsxs("div", { style: { fontSize: 13 }, children: ["Status: ", _jsxs("span", { className: `pill ${syncStatus}`, children: [_jsx("span", { className: "dot" }), " ", syncStatus] })] }) }), _jsx(Card, { title: "Device pairing", children: _jsxs("div", { style: { display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }, children: [_jsxs("div", { children: [_jsx("button", { className: "btn-secondary", onClick: () => void startPair(), children: "Generate pairing code" }), pairCode && (_jsx("div", { style: { marginTop: 12, fontSize: 32, fontWeight: 700, letterSpacing: 6 }, children: pairCode }))] }), _jsxs("div", { style: { minWidth: 280, display: "flex", flexDirection: "column", gap: 8 }, children: [_jsx("input", { className: "field", placeholder: "Enter pairing code from another device", value: enterCode, onChange: (e) => setEnterCode(e.target.value) }), _jsx("button", { className: "btn-primary", onClick: () => void confirmPair(), children: "Pair this device" }), pairResult && (_jsx("div", { style: { color: "var(--color-textMuted)", fontSize: 12 }, children: pairResult }))] })] }) }), _jsx(Card, { title: "Notifications", children: _jsx(Placeholder, { title: "Notifications not yet implemented", description: "Daily study reminders and deadline pings are on the roadmap." }) }), _jsx(Card, { title: "Account", children: _jsx(Placeholder, { title: "Account management not yet implemented", description: "Profile, password, and subscription settings will live here." }) })] })] }) }));
};
const ThemeSwatch = ({ name, active, onPick, }) => {
    const palette = themes[name];
    return (_jsx("button", { type: "button", className: `theme-swatch ${active ? "active" : ""}`, title: name, onClick: onPick, style: {
            background: `linear-gradient(135deg, ${palette.primary} 0 50%, ${palette.surface} 50% 100%)`,
            borderColor: active ? palette.primary : "var(--color-border)",
        }, children: active && _jsx(CheckIcon, { size: 14 }) }));
};
//# sourceMappingURL=Settings.js.map