import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CLOUD_API_BASE_URL } from "@studynest/shared";
import { useApp } from "../store.js";
import { firstName, getProfile } from "../lib/profile.js";
import { refreshUserBadges } from "../lib/badgesSync.js";
import { upsertClass } from "../db/repositories.js";
import { setUserId } from "../db/client.js";
import { BRAND_LOGO_URL } from "../lib/brand.js";
import { ArrowRightIcon, CheckIcon, PlusIcon, SparklesIcon, } from "./icons.js";
const NEW_USER_STEPS = ["intro", "name", "role", "classes", "done"];
const RETURNING_USER_STEPS = ["intro", "pair"];
const ROLES = [
    { id: "high-school", label: "High school", sub: "Grades 9–12" },
    { id: "college", label: "College", sub: "Undergrad" },
    { id: "grad", label: "Grad school", sub: "Masters / PhD" },
    { id: "self-learner", label: "Self-learner", sub: "Studying on my own" },
    { id: "other", label: "Something else", sub: "Tell us later" },
];
const CLASS_COLORS = [
    "var(--color-accentRose)",
    "var(--color-accentSky)",
    "var(--color-accentSage)",
    "var(--color-accentAmber)",
    "var(--color-accentLilac)",
];
export const Onboarding = () => {
    const profile = useApp((s) => s.profile);
    const setProfile = useApp((s) => s.setProfile);
    const [step, setStep] = useState("intro");
    const [direction, setDirection] = useState("forward");
    const [track, setTrack] = useState(null);
    const [name, setName] = useState(profile.name);
    const [role, setRole] = useState(profile.role);
    const [classes, setClasses] = useState(["", "", ""]);
    const [finishing, setFinishing] = useState(false);
    /** Step ordering depends on which branch the user picked at the intro. */
    const order = useMemo(() => (track === "returning" ? RETURNING_USER_STEPS : NEW_USER_STEPS), [track]);
    const stepIndex = order.indexOf(step);
    const totalSteps = order.length;
    const goTo = useCallback((next, dir) => {
        setDirection(dir);
        setStep(next);
    }, []);
    const next = useCallback(() => {
        const i = order.indexOf(step);
        const target = order[i + 1];
        if (target)
            goTo(target, "forward");
    }, [goTo, order, step]);
    const back = useCallback(() => {
        const i = order.indexOf(step);
        const target = order[i - 1];
        if (target)
            goTo(target, "backward");
        if (target === "intro")
            setTrack(null);
    }, [goTo, order, step]);
    /** Persists the profile + best-effort initial classes, then unmounts. */
    const finishNew = useCallback(async () => {
        if (finishing)
            return;
        setFinishing(true);
        setProfile({
            ...getProfile(),
            name: name.trim(),
            role,
            onboardedAt: new Date().toISOString(),
        });
        void refreshUserBadges();
        const wanted = classes.map((c) => c.trim()).filter(Boolean);
        void Promise.all(wanted.map((cname, i) => upsertClass({
            name: cname,
            color: CLASS_COLORS[i % CLASS_COLORS.length] ?? null,
        }))).catch(() => {
            /* user can re-add later in Classes */
        });
    }, [classes, finishing, name, role, setProfile]);
    /**
     * Returning-device path. We don't have the original profile name in the
     * pair response (the cloud API only returns `user_id`), but the next
     * sync tick will fill in classes/notes/etc., and the user can edit
     * their display name in Settings if they want.
     */
    const finishReturning = useCallback((userId, displayName) => {
        void setUserId(userId);
        setProfile({
            ...getProfile(),
            name: displayName,
            role: null,
            onboardedAt: new Date().toISOString(),
        });
        void refreshUserBadges();
    }, [setProfile]);
    return (_jsxs("div", { className: "onboarding-shell", children: [_jsx(BackgroundOrbs, {}), _jsx("div", { className: "ob-logo-bg", "aria-hidden": true, children: _jsx("img", { src: BRAND_LOGO_URL, alt: "" }) }), _jsx("div", { className: "onboarding-stage", children: _jsxs("div", { className: `onboarding-step ${direction === "forward" ? "enter-forward" : "enter-backward"}`, children: [step === "intro" && (_jsx(IntroStep, { onPickNew: () => {
                                setTrack("new");
                                goTo("name", "forward");
                            }, onPickReturning: () => {
                                setTrack("returning");
                                goTo("pair", "forward");
                            } })), step === "name" && (_jsx(NameStep, { name: name, setName: setName, onNext: next, onBack: back })), step === "role" && (_jsx(RoleStep, { role: role, setRole: setRole, onNext: next, onBack: back })), step === "classes" && (_jsx(ClassesStep, { classes: classes, setClasses: setClasses, onNext: next, onBack: back })), step === "done" && (_jsx(DoneStep, { name: name, onBack: back, onFinish: finishNew, finishing: finishing })), step === "pair" && (_jsx(PairStep, { onBack: back, onPaired: finishReturning }))] }, step) }), step !== "intro" && (_jsx(StepDots, { count: totalSteps - 1, active: stepIndex - 1 }))] }));
};
/* ---------- step: intro (branching) ------------------------------ */
const IntroStep = ({ onPickNew, onPickReturning }) => {
    return (_jsxs("div", { className: "ob-card ob-card-intro", children: [_jsx("div", { className: "ob-eyebrow", children: "Welcome" }), _jsx("h1", { className: "ob-title", children: "Let's get you set up" }), _jsx("p", { className: "ob-sub", children: "Note Goat is a calm, focused space for your notes, flashcards, and study plans. How are you joining us today?" }), _jsxs("div", { className: "ob-choice-list", children: [_jsxs("button", { type: "button", className: "ob-choice", onClick: onPickNew, autoFocus: true, children: [_jsxs("span", { className: "ob-choice-body", children: [_jsx("span", { className: "ob-choice-title", children: "I'm new here" }), _jsx("span", { className: "ob-choice-sub", children: "Set up your profile and start fresh." })] }), _jsx(ArrowRightIcon, { size: 16 })] }), _jsxs("button", { type: "button", className: "ob-choice", onClick: onPickReturning, children: [_jsxs("span", { className: "ob-choice-body", children: [_jsx("span", { className: "ob-choice-title", children: "I already have data on another device" }), _jsx("span", { className: "ob-choice-sub", children: "Pair with a code and pick up where you left off." })] }), _jsx(ArrowRightIcon, { size: 16 })] })] })] }));
};
/* ---------- step: name ------------------------------------------- */
const NameStep = ({ name, setName, onNext, onBack }) => {
    const inputRef = useRef(null);
    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);
    const trimmed = name.trim();
    const handleKey = (e) => {
        if (e.key === "Enter" && trimmed)
            onNext();
    };
    return (_jsxs("div", { className: "ob-card", children: [_jsx("div", { className: "ob-eyebrow", children: "First, the basics" }), _jsx("h1", { className: "ob-title", children: "What should we call you?" }), _jsx("p", { className: "ob-sub", children: "We'll use this to greet you when you open the app." }), _jsx("input", { ref: inputRef, className: "ob-input", type: "text", value: name, onChange: (e) => setName(e.target.value), onKeyDown: handleKey, placeholder: "Your name", autoComplete: "given-name", spellCheck: false, maxLength: 60 }), _jsxs("div", { className: "ob-actions", children: [_jsx("button", { type: "button", className: "ob-secondary", onClick: onBack, children: "Back" }), _jsxs("button", { type: "button", className: "ob-primary", onClick: onNext, disabled: !trimmed, children: ["Continue ", _jsx(ArrowRightIcon, { size: 16 })] })] })] }));
};
/* ---------- step: role ------------------------------------------- */
const RoleStep = ({ role, setRole, onNext, onBack }) => {
    return (_jsxs("div", { className: "ob-card", children: [_jsx("div", { className: "ob-eyebrow", children: "Optional" }), _jsx("h1", { className: "ob-title", children: "Where are you in your learning journey?" }), _jsx("p", { className: "ob-sub", children: "Helps us tune defaults like study session length. You can skip this." }), _jsx("div", { className: "ob-roles", children: ROLES.map((r) => {
                    const active = role === r.id;
                    return (_jsxs("button", { type: "button", className: `ob-role ${active ? "active" : ""}`, onClick: () => setRole(active ? null : r.id), children: [_jsx("span", { className: "ob-role-label", children: r.label }), _jsx("span", { className: "ob-role-sub", children: r.sub }), active && (_jsx("span", { className: "ob-role-check", "aria-hidden": true, children: _jsx(CheckIcon, { size: 12 }) }))] }, r.id));
                }) }), _jsxs("div", { className: "ob-actions", children: [_jsx("button", { type: "button", className: "ob-secondary", onClick: onBack, children: "Back" }), _jsx("button", { type: "button", className: "ob-ghost", onClick: onNext, children: "Skip" }), _jsxs("button", { type: "button", className: "ob-primary", onClick: onNext, children: ["Continue ", _jsx(ArrowRightIcon, { size: 16 })] })] })] }));
};
/* ---------- step: classes ---------------------------------------- */
const ClassesStep = ({ classes, setClasses, onNext, onBack }) => {
    const update = (i, v) => {
        const next = classes.slice();
        next[i] = v;
        setClasses(next);
    };
    const add = () => setClasses([...classes, ""]);
    const remove = (i) => {
        const next = classes.slice();
        next.splice(i, 1);
        setClasses(next.length ? next : [""]);
    };
    return (_jsxs("div", { className: "ob-card", children: [_jsx("div", { className: "ob-eyebrow", children: "Optional" }), _jsx("h1", { className: "ob-title", children: "Add a few classes" }), _jsx("p", { className: "ob-sub", children: "Group your notes by subject. You can edit, add, or remove these any time from Classes." }), _jsxs("div", { className: "ob-classes", children: [classes.map((c, i) => (_jsxs("div", { className: "ob-class-row", children: [_jsx("span", { className: "ob-class-dot", style: {
                                    background: CLASS_COLORS[i % CLASS_COLORS.length] ??
                                        "var(--color-primary)",
                                }, "aria-hidden": true }), _jsx("input", { className: "ob-input ob-input-inline", type: "text", value: c, onChange: (e) => update(i, e.target.value), placeholder: i === 0
                                    ? "e.g. Biology"
                                    : i === 1
                                        ? "e.g. World History"
                                        : "Another class", maxLength: 80 }), classes.length > 1 && (_jsx("button", { type: "button", className: "ob-class-remove", onClick: () => remove(i), "aria-label": `Remove class ${i + 1}`, children: "\u00D7" }))] }, i))), _jsxs("button", { type: "button", className: "ob-class-add", onClick: add, children: [_jsx(PlusIcon, { size: 14 }), " Add another class"] })] }), _jsxs("div", { className: "ob-actions", children: [_jsx("button", { type: "button", className: "ob-secondary", onClick: onBack, children: "Back" }), _jsx("button", { type: "button", className: "ob-ghost", onClick: onNext, children: "Skip" }), _jsxs("button", { type: "button", className: "ob-primary", onClick: onNext, children: ["Continue ", _jsx(ArrowRightIcon, { size: 16 })] })] })] }));
};
/* ---------- step: done (new user) -------------------------------- */
const DoneStep = ({ name, onBack, onFinish, finishing }) => {
    const first = useMemo(() => firstName(name) || "friend", [name]);
    return (_jsxs("div", { className: "ob-card", children: [_jsx("span", { className: "ob-celebrate", "aria-hidden": true, children: _jsx(SparklesIcon, { size: 28 }) }), _jsxs("h1", { className: "ob-title", children: ["You're all set, ", first] }), _jsx("p", { className: "ob-sub", children: "Your space is ready. Jump in and start your first note whenever you're ready." }), _jsxs("div", { className: "ob-actions", children: [_jsx("button", { type: "button", className: "ob-secondary", onClick: onBack, disabled: finishing, children: "Back" }), _jsxs("button", { type: "button", className: "ob-primary", onClick: () => void onFinish(), disabled: finishing, autoFocus: true, children: ["Enter Note Goat ", _jsx(ArrowRightIcon, { size: 16 })] })] })] }));
};
/* ---------- step: pair (returning user) -------------------------- */
const PairStep = ({ onBack, onPaired }) => {
    const [code, setCode] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const codeRef = useRef(null);
    useEffect(() => {
        codeRef.current?.focus();
    }, []);
    const cleanCode = code.trim().toUpperCase();
    const canSubmit = cleanCode.length >= 4 && !busy;
    const submit = useCallback(async () => {
        if (!canSubmit)
            return;
        setBusy(true);
        setError(null);
        try {
            const deviceId = (await window.studynest?.sidecarBaseUrl?.()) ?? "desktop";
            const res = await fetch(`${CLOUD_API_BASE_URL}/devices/pair/confirm`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ code: cleanCode, device_id: deviceId }),
            });
            if (!res.ok) {
                setError(res.status === 404 || res.status === 410
                    ? "That code is invalid or has expired. Try generating a new one."
                    : `Couldn't pair (status ${res.status}).`);
                return;
            }
            const data = (await res.json());
            onPaired(data.user_id, displayName.trim());
        }
        catch {
            setError("Couldn't reach the cloud. Check your connection and retry.");
        }
        finally {
            setBusy(false);
        }
    }, [canSubmit, cleanCode, displayName, onPaired]);
    const handleKey = (e) => {
        if (e.key === "Enter")
            void submit();
    };
    return (_jsxs("div", { className: "ob-card", children: [_jsx("div", { className: "ob-eyebrow", children: "Welcome back" }), _jsx("h1", { className: "ob-title", children: "Pair with another device" }), _jsxs("p", { className: "ob-sub", children: ["On a device that's already signed in, open", " ", _jsx("strong", { children: "Settings \u2192 Device pairing" }), " and tap", " ", _jsx("strong", { children: "Generate pairing code" }), ". Enter that code here and your notes, classes, and flashcards will start syncing in."] }), _jsx("input", { ref: codeRef, className: "ob-input ob-input-code", type: "text", value: code, onChange: (e) => setCode(e.target.value), onKeyDown: handleKey, placeholder: "ABCD-1234", autoComplete: "off", spellCheck: false, maxLength: 16 }), _jsx("input", { className: "ob-input", type: "text", value: displayName, onChange: (e) => setDisplayName(e.target.value), onKeyDown: handleKey, placeholder: "Your name (optional)", autoComplete: "given-name", spellCheck: false, maxLength: 60 }), error && _jsx("div", { className: "ob-error", children: error }), _jsxs("div", { className: "ob-actions", children: [_jsx("button", { type: "button", className: "ob-secondary", onClick: onBack, disabled: busy, children: "Back" }), _jsx("button", { type: "button", className: "ob-primary", onClick: () => void submit(), disabled: !canSubmit, children: busy ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "ob-spinner", "aria-hidden": true }), " Pairing\u2026"] })) : (_jsxs(_Fragment, { children: ["Pair & sync ", _jsx(ArrowRightIcon, { size: 16 })] })) })] })] }));
};
/* ---------- chrome ----------------------------------------------- */
const StepDots = ({ count, active }) => (_jsx("div", { className: "ob-dots", role: "presentation", children: Array.from({ length: count }).map((_, i) => (_jsx("span", { className: `ob-dot ${i === active ? "active" : ""} ${i < active ? "done" : ""}` }, i))) }));
const BackgroundOrbs = () => (_jsxs("div", { className: "ob-orbs", "aria-hidden": true, children: [_jsx("span", { className: "ob-orb ob-orb-a" }), _jsx("span", { className: "ob-orb ob-orb-b" }), _jsx("span", { className: "ob-orb ob-orb-c" })] }));
//# sourceMappingURL=Onboarding.js.map