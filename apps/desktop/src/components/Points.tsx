import type { FC } from "react";
import { useEffect, useMemo, useState } from "react";
import { BADGE_DEFINITIONS, isBadgeId } from "@studynest/shared";
import {
  goatUpgradePurchases,
  spendRewardPoints,
  totalRewardPoints,
} from "../db/repositories.js";
import { refreshUserBadges } from "../lib/badgesSync.js";
import { useApp } from "../store.js";
import { Card } from "./ui/Card.js";
import { GoatLogo, TrophyIcon } from "./icons.js";
import { withViewTransition } from "../lib/viewTransition.js";

interface GoatUpgrade {
  id: string;
  name: string;
  cost: number;
  description: string;
}

const GOAT_UPGRADES: GoatUpgrade[] = [
  {
    id: "cozyScarf",
    name: "Cozy Scarf",
    cost: 25,
    description: "Keep your goat warm while studying.",
  },
  {
    id: "goldenBell",
    name: "Golden Bell",
    cost: 40,
    description: "A shiny bell for top-streak vibes.",
  },
  {
    id: "nebulaHorns",
    name: "Nebula Horn Polish",
    cost: 60,
    description: "Cosmic glow-up for your companion.",
  },
  {
    id: "jetpack",
    name: "Tiny Jetpack",
    cost: 90,
    description: "For high-speed knowledge quests.",
  },
];

export const Points: FC = () => {
  const syncStatus = useApp((s) => s.syncStatus);
  const setView = useApp((s) => s.setView);
  const profileBadges = useApp((s) => s.profile.badges);
  const [points, setPoints] = useState(0);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function reload(): Promise<void> {
    const [total, upgrades] = await Promise.all([
      totalRewardPoints(),
      goatUpgradePurchases(),
    ]);
    setPoints(total);
    setOwned(upgrades);
  }

  useEffect(() => {
    void reload();
    void refreshUserBadges();
  }, []);

  const unlockedBadgeIds = useMemo(
    () => new Set(profileBadges.filter(isBadgeId)),
    [profileBadges],
  );
  const earnedBadgeCount = useMemo(
    () => BADGE_DEFINITIONS.filter((d) => unlockedBadgeIds.has(d.id)).length,
    [unlockedBadgeIds],
  );

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 2200);
    return () => window.clearTimeout(id);
  }, [notice]);

  const nextAffordable = useMemo(
    () =>
      GOAT_UPGRADES.find((u) => !owned.has(u.id) && points >= u.cost) ?? null,
    [owned, points],
  );

  async function buy(upgrade: GoatUpgrade): Promise<void> {
    if (busyId || owned.has(upgrade.id)) return;
    setBusyId(upgrade.id);
    try {
      const ok = await spendRewardPoints(`goatUpgrade:${upgrade.id}`, upgrade.cost);
      if (!ok) {
        setNotice("Not enough points for that upgrade yet.");
        return;
      }
      await reload();
      setNotice(`${upgrade.name} unlocked!`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="main">
      <div className="topbar">
        <button
          className="btn-ghost"
          onClick={() => withViewTransition(() => setView({ kind: "home" }))}
        >
          Home
        </button>
        <span style={{ flex: 1 }} />
        <span className="pill">{syncStatus === "synced" ? "Synced" : syncStatus}</span>
      </div>
      <div className="main-inner">
        <section className="hero" style={{ marginBottom: 14 }}>
          <div className="hero-main">
            <div className="hero-greeting">
              <h1 className="hero-headline">Points & Goat Companion</h1>
              <p>Spend reward points on companion upgrades as you complete quizzes.</p>
            </div>
          </div>
          <div className="hero-illustration" aria-hidden>
            <GoatLogo size={96} />
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Card className="level-card">
            <div className="level-top">
              <span className="badge"><TrophyIcon size={14} /></span>
              <div className="level-text">
                <span className="l1">Total Points</span>
                <span className="l2">{points.toLocaleString()}</span>
              </div>
            </div>
            <div className="xp-row">
              <span className="label">Owned upgrades</span>
              <span className="val">{owned.size} / {GOAT_UPGRADES.length}</span>
            </div>
            <div className="level-foot">
              {nextAffordable
                ? `Next available: ${nextAffordable.name} (${nextAffordable.cost})`
                : "Keep earning to unlock more goat upgrades."}
            </div>
          </Card>

          <Card title="Goat Companion" icon={<GoatLogo size={18} />}>
            <p className="card-subtitle" style={{ marginTop: 0 }}>
              Upgrade your goat with points earned from correct quiz answers.
            </p>
            {notice && (
              <p
                className="pill"
                style={{ width: "fit-content", margin: "0 0 8px 0" }}
              >
                {notice}
              </p>
            )}
            <div style={{ display: "grid", gap: 8 }}>
              {GOAT_UPGRADES.map((u) => {
                const purchased = owned.has(u.id);
                const canAfford = points >= u.cost;
                return (
                  <div
                    key={u.id}
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: 10,
                      padding: 10,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <strong>{u.name}</strong>
                      <span>{u.cost} pts</span>
                    </div>
                    <p style={{ margin: 0, color: "var(--color-textMuted)", fontSize: 13 }}>
                      {u.description}
                    </p>
                    <button
                      type="button"
                      className={purchased ? "btn-ghost" : "btn-primary"}
                      disabled={purchased || busyId === u.id || !canAfford}
                      onClick={() => void buy(u)}
                    >
                      {purchased
                        ? "Owned"
                        : busyId === u.id
                        ? "Purchasing..."
                        : canAfford
                        ? "Buy upgrade"
                        : "Need more points"}
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div style={{ marginTop: 12 }}>
          <Card title="Badges">
          <div className="badges-settings-head">
            <span style={{ fontSize: 13, color: "var(--color-textMuted)" }}>
              {earnedBadgeCount} of {BADGE_DEFINITIONS.length} unlocked — earned from notes, quizzes,
              flashcards, streaks, and XP.
            </span>
            <button
              type="button"
              className="btn-secondary"
              style={{ flexShrink: 0 }}
              onClick={() => void refreshUserBadges()}
            >
              Refresh progress
            </button>
          </div>
          <ul className="badges-grid" aria-label="All badges">
            {BADGE_DEFINITIONS.map((b) => {
              const on = unlockedBadgeIds.has(b.id);
              return (
                <li
                  key={b.id}
                  className={`badge-tile ${on ? "badge-tile-unlocked" : "badge-tile-locked"}`}
                >
                  <span className="badge-tile-emoji" aria-hidden>
                    {on ? b.emoji : "🔒"}
                  </span>
                  <span className="badge-tile-title">{b.title}</span>
                  <span className="badge-tile-desc">{b.description}</span>
                </li>
              );
            })}
          </ul>
          </Card>
        </div>
      </div>
    </main>
  );
};
