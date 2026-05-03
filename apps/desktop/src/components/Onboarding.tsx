/**
 * First-launch onboarding.
 *
 * Renders full-screen on top of nothing (App gates on `profile.onboardedAt`)
 * and walks the user through a small branching flow:
 *
 *     intro ─┬─ "I'm new" ──── name → role → classes → done
 *            └─ "I have data on another device" ── pair → done
 *
 * Returning users enter a pairing code generated on their existing device.
 * Confirming the code calls `setUserId()` so the already-running sync
 * worker (started in `App` regardless of onboarding state) starts pulling
 * remote rows on its next tick — typically within a couple of seconds.
 *
 * Step transitions are pure CSS — each step is keyed by name and the
 * rendered container picks an `enter-forward` / `enter-backward`
 * keyframe based on navigation direction. No motion library needed.
 */
import type { FC, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CLOUD_API_BASE_URL } from "@studynest/shared";
import { useApp } from "../store.js";
import { firstName, getProfile, type LearnerRole } from "../lib/profile.js";
import { refreshUserBadges } from "../lib/badgesSync.js";
import { upsertClass } from "../db/repositories.js";
import { setUserId } from "../db/client.js";
import { BRAND_LOGO_URL } from "../lib/brand.js";
import {
  ArrowRightIcon,
  CheckIcon,
  PlusIcon,
  SparklesIcon,
} from "./icons.js";

type Direction = "forward" | "backward";
type Step = "intro" | "pair" | "name" | "role" | "classes" | "done";

const NEW_USER_STEPS: Step[] = ["intro", "name", "role", "classes", "done"];
const RETURNING_USER_STEPS: Step[] = ["intro", "pair"];

const ROLES: { id: LearnerRole; label: string; sub: string }[] = [
  { id: "high-school",  label: "High school",   sub: "Grades 9–12" },
  { id: "college",      label: "College",       sub: "Undergrad" },
  { id: "grad",         label: "Grad school",   sub: "Masters / PhD" },
  { id: "self-learner", label: "Self-learner",  sub: "Studying on my own" },
  { id: "other",        label: "Something else", sub: "Tell us later" },
];

const CLASS_COLORS = [
  "var(--color-accentRose)",
  "var(--color-accentSky)",
  "var(--color-accentSage)",
  "var(--color-accentAmber)",
  "var(--color-accentLilac)",
];

export const Onboarding: FC = () => {
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);

  const [step, setStep] = useState<Step>("intro");
  const [direction, setDirection] = useState<Direction>("forward");
  const [track, setTrack] = useState<"new" | "returning" | null>(null);

  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState<LearnerRole | null>(profile.role);
  const [classes, setClasses] = useState<string[]>(["", "", ""]);
  const [finishing, setFinishing] = useState(false);

  /** Step ordering depends on which branch the user picked at the intro. */
  const order = useMemo(
    () => (track === "returning" ? RETURNING_USER_STEPS : NEW_USER_STEPS),
    [track],
  );
  const stepIndex = order.indexOf(step);
  const totalSteps = order.length;

  const goTo = useCallback((next: Step, dir: Direction) => {
    setDirection(dir);
    setStep(next);
  }, []);

  const next = useCallback(() => {
    const i = order.indexOf(step);
    const target = order[i + 1];
    if (target) goTo(target, "forward");
  }, [goTo, order, step]);

  const back = useCallback(() => {
    const i = order.indexOf(step);
    const target = order[i - 1];
    if (target) goTo(target, "backward");
    if (target === "intro") setTrack(null);
  }, [goTo, order, step]);

  /** Persists the profile + best-effort initial classes, then unmounts. */
  const finishNew = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    setProfile({
      ...getProfile(),
      name: name.trim(),
      role,
      onboardedAt: new Date().toISOString(),
    });
    void refreshUserBadges();
    const wanted = classes.map((c) => c.trim()).filter(Boolean);
    void Promise.all(
      wanted.map((cname, i) =>
        upsertClass({
          name: cname,
          color: CLASS_COLORS[i % CLASS_COLORS.length] ?? null,
        }),
      ),
    ).catch(() => {
      /* user can re-add later in Classes */
    });
  }, [classes, finishing, name, role, setProfile]);

  /**
   * Returning-device path. We don't have the original profile name in the
   * pair response (the cloud API only returns `user_id`), but the next
   * sync tick will fill in classes/notes/etc., and the user can edit
   * their display name in Settings if they want.
   */
  const finishReturning = useCallback(
    (userId: string, displayName: string) => {
      void setUserId(userId);
      setProfile({
        ...getProfile(),
        name: displayName,
        role: null,
        onboardedAt: new Date().toISOString(),
      });
      void refreshUserBadges();
    },
    [setProfile],
  );

  return (
    <div className="onboarding-shell">
      <BackgroundOrbs />
      {/* Oversized faint logo behind the card — the panel naturally crops it. */}
      <div className="ob-logo-bg" aria-hidden>
        <img src={BRAND_LOGO_URL} alt="" />
      </div>
      <div className="onboarding-stage">
        <div
          className={`onboarding-step ${
            direction === "forward" ? "enter-forward" : "enter-backward"
          }`}
          key={step}
        >
          {step === "intro" && (
            <IntroStep
              onPickNew={() => {
                setTrack("new");
                goTo("name", "forward");
              }}
              onPickReturning={() => {
                setTrack("returning");
                goTo("pair", "forward");
              }}
            />
          )}
          {step === "name" && (
            <NameStep
              name={name}
              setName={setName}
              onNext={next}
              onBack={back}
            />
          )}
          {step === "role" && (
            <RoleStep
              role={role}
              setRole={setRole}
              onNext={next}
              onBack={back}
            />
          )}
          {step === "classes" && (
            <ClassesStep
              classes={classes}
              setClasses={setClasses}
              onNext={next}
              onBack={back}
            />
          )}
          {step === "done" && (
            <DoneStep
              name={name}
              onBack={back}
              onFinish={finishNew}
              finishing={finishing}
            />
          )}
          {step === "pair" && (
            <PairStep onBack={back} onPaired={finishReturning} />
          )}
        </div>
      </div>
      {step !== "intro" && (
        <StepDots count={totalSteps - 1} active={stepIndex - 1} />
      )}
    </div>
  );
};

/* ---------- step: intro (branching) ------------------------------ */

const IntroStep: FC<{
  onPickNew: () => void;
  onPickReturning: () => void;
}> = ({ onPickNew, onPickReturning }) => {
  return (
    <div className="ob-card ob-card-intro">
      <div className="ob-eyebrow">Welcome</div>
      <h1 className="ob-title">Let's get you set up</h1>
      <p className="ob-sub">
        Note Goat is a calm, focused space for your notes, flashcards, and
        study plans. How are you joining us today?
      </p>
      <div className="ob-choice-list">
        <button type="button" className="ob-choice" onClick={onPickNew} autoFocus>
          <span className="ob-choice-body">
            <span className="ob-choice-title">I'm new here</span>
            <span className="ob-choice-sub">
              Set up your profile and start fresh.
            </span>
          </span>
          <ArrowRightIcon size={16} />
        </button>
        <button
          type="button"
          className="ob-choice"
          onClick={onPickReturning}
        >
          <span className="ob-choice-body">
            <span className="ob-choice-title">
              I already have data on another device
            </span>
            <span className="ob-choice-sub">
              Pair with a code and pick up where you left off.
            </span>
          </span>
          <ArrowRightIcon size={16} />
        </button>
      </div>
    </div>
  );
};

/* ---------- step: name ------------------------------------------- */

const NameStep: FC<{
  name: string;
  setName: (s: string) => void;
  onNext: () => void;
  onBack: () => void;
}> = ({ name, setName, onNext, onBack }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const trimmed = name.trim();
  const handleKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" && trimmed) onNext();
  };

  return (
    <div className="ob-card">
      <div className="ob-eyebrow">First, the basics</div>
      <h1 className="ob-title">What should we call you?</h1>
      <p className="ob-sub">
        We'll use this to greet you when you open the app.
      </p>
      <input
        ref={inputRef}
        className="ob-input"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Your name"
        autoComplete="given-name"
        spellCheck={false}
        maxLength={60}
      />
      <div className="ob-actions">
        <button type="button" className="ob-secondary" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="ob-primary"
          onClick={onNext}
          disabled={!trimmed}
        >
          Continue <ArrowRightIcon size={16} />
        </button>
      </div>
    </div>
  );
};

/* ---------- step: role ------------------------------------------- */

const RoleStep: FC<{
  role: LearnerRole | null;
  setRole: (r: LearnerRole | null) => void;
  onNext: () => void;
  onBack: () => void;
}> = ({ role, setRole, onNext, onBack }) => {
  return (
    <div className="ob-card">
      <div className="ob-eyebrow">Optional</div>
      <h1 className="ob-title">Where are you in your learning journey?</h1>
      <p className="ob-sub">
        Helps us tune defaults like study session length. You can skip this.
      </p>
      <div className="ob-roles">
        {ROLES.map((r) => {
          const active = role === r.id;
          return (
            <button
              type="button"
              key={r.id}
              className={`ob-role ${active ? "active" : ""}`}
              onClick={() => setRole(active ? null : r.id)}
            >
              <span className="ob-role-label">{r.label}</span>
              <span className="ob-role-sub">{r.sub}</span>
              {active && (
                <span className="ob-role-check" aria-hidden>
                  <CheckIcon size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="ob-actions">
        <button type="button" className="ob-secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="ob-ghost" onClick={onNext}>
          Skip
        </button>
        <button type="button" className="ob-primary" onClick={onNext}>
          Continue <ArrowRightIcon size={16} />
        </button>
      </div>
    </div>
  );
};

/* ---------- step: classes ---------------------------------------- */

const ClassesStep: FC<{
  classes: string[];
  setClasses: (c: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}> = ({ classes, setClasses, onNext, onBack }) => {
  const update = (i: number, v: string): void => {
    const next = classes.slice();
    next[i] = v;
    setClasses(next);
  };
  const add = (): void => setClasses([...classes, ""]);
  const remove = (i: number): void => {
    const next = classes.slice();
    next.splice(i, 1);
    setClasses(next.length ? next : [""]);
  };

  return (
    <div className="ob-card">
      <div className="ob-eyebrow">Optional</div>
      <h1 className="ob-title">Add a few classes</h1>
      <p className="ob-sub">
        Group your notes by subject. You can edit, add, or remove these any
        time from Classes.
      </p>
      <div className="ob-classes">
        {classes.map((c, i) => (
          <div className="ob-class-row" key={i}>
            <span
              className="ob-class-dot"
              style={{
                background:
                  CLASS_COLORS[i % CLASS_COLORS.length] ??
                  "var(--color-primary)",
              }}
              aria-hidden
            />
            <input
              className="ob-input ob-input-inline"
              type="text"
              value={c}
              onChange={(e) => update(i, e.target.value)}
              placeholder={
                i === 0
                  ? "e.g. Biology"
                  : i === 1
                  ? "e.g. World History"
                  : "Another class"
              }
              maxLength={80}
            />
            {classes.length > 1 && (
              <button
                type="button"
                className="ob-class-remove"
                onClick={() => remove(i)}
                aria-label={`Remove class ${i + 1}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button type="button" className="ob-class-add" onClick={add}>
          <PlusIcon size={14} /> Add another class
        </button>
      </div>
      <div className="ob-actions">
        <button type="button" className="ob-secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="ob-ghost" onClick={onNext}>
          Skip
        </button>
        <button type="button" className="ob-primary" onClick={onNext}>
          Continue <ArrowRightIcon size={16} />
        </button>
      </div>
    </div>
  );
};

/* ---------- step: done (new user) -------------------------------- */

const DoneStep: FC<{
  name: string;
  onBack: () => void;
  onFinish: () => void | Promise<void>;
  finishing: boolean;
}> = ({ name, onBack, onFinish, finishing }) => {
  const first = useMemo(() => firstName(name) || "friend", [name]);
  return (
    <div className="ob-card">
      <span className="ob-celebrate" aria-hidden>
        <SparklesIcon size={28} />
      </span>
      <h1 className="ob-title">You're all set, {first}</h1>
      <p className="ob-sub">
        Your space is ready. Jump in and start your first note whenever you're
        ready.
      </p>
      <div className="ob-actions">
        <button
          type="button"
          className="ob-secondary"
          onClick={onBack}
          disabled={finishing}
        >
          Back
        </button>
        <button
          type="button"
          className="ob-primary"
          onClick={() => void onFinish()}
          disabled={finishing}
          autoFocus
        >
          Enter Note Goat <ArrowRightIcon size={16} />
        </button>
      </div>
    </div>
  );
};

/* ---------- step: pair (returning user) -------------------------- */

const PairStep: FC<{
  onBack: () => void;
  onPaired: (userId: string, displayName: string) => void;
}> = ({ onBack, onPaired }) => {
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  const cleanCode = code.trim().toUpperCase();
  const canSubmit = cleanCode.length >= 4 && !busy;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const deviceId =
        (await window.studynest?.sidecarBaseUrl?.()) ?? "desktop";
      const res = await fetch(`${CLOUD_API_BASE_URL}/devices/pair/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: cleanCode, device_id: deviceId }),
      });
      if (!res.ok) {
        setError(
          res.status === 404 || res.status === 410
            ? "That code is invalid or has expired. Try generating a new one."
            : `Couldn't pair (status ${res.status}).`,
        );
        return;
      }
      const data = (await res.json()) as { user_id: string };
      onPaired(data.user_id, displayName.trim());
    } catch {
      setError("Couldn't reach the cloud. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }, [canSubmit, cleanCode, displayName, onPaired]);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") void submit();
  };

  return (
    <div className="ob-card">
      <div className="ob-eyebrow">Welcome back</div>
      <h1 className="ob-title">Pair with another device</h1>
      <p className="ob-sub">
        On a device that's already signed in, open{" "}
        <strong>Settings → Device pairing</strong> and tap{" "}
        <strong>Generate pairing code</strong>. Enter that code here and your
        notes, classes, and flashcards will start syncing in.
      </p>
      <input
        ref={codeRef}
        className="ob-input ob-input-code"
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={handleKey}
        placeholder="ABCD-1234"
        autoComplete="off"
        spellCheck={false}
        maxLength={16}
      />
      <input
        className="ob-input"
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Your name (optional)"
        autoComplete="given-name"
        spellCheck={false}
        maxLength={60}
      />
      {error && <div className="ob-error">{error}</div>}
      <div className="ob-actions">
        <button
          type="button"
          className="ob-secondary"
          onClick={onBack}
          disabled={busy}
        >
          Back
        </button>
        <button
          type="button"
          className="ob-primary"
          onClick={() => void submit()}
          disabled={!canSubmit}
        >
          {busy ? (
            <>
              <span className="ob-spinner" aria-hidden /> Pairing…
            </>
          ) : (
            <>
              Pair &amp; sync <ArrowRightIcon size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

/* ---------- chrome ----------------------------------------------- */

const StepDots: FC<{ count: number; active: number }> = ({ count, active }) => (
  <div className="ob-dots" role="presentation">
    {Array.from({ length: count }).map((_, i) => (
      <span
        key={i}
        className={`ob-dot ${i === active ? "active" : ""} ${
          i < active ? "done" : ""
        }`}
      />
    ))}
  </div>
);

const BackgroundOrbs: FC = () => (
  <div className="ob-orbs" aria-hidden>
    <span className="ob-orb ob-orb-a" />
    <span className="ob-orb ob-orb-b" />
    <span className="ob-orb ob-orb-c" />
  </div>
);
