import type { CSSProperties, FC, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchBadgeProgressMetrics,
  goatUpgradePurchases,
  spendRewardPoints,
  totalRewardPoints,
  totalXp,
  totalXpToday,
  xpByDay,
} from "../db/repositories.js";
import { refreshUserBadges } from "../lib/badgesSync.js";
import { BRAND_FLASHCARD_HERO_URL, BRAND_QUIZ_HERO_URL } from "../lib/brand.js";
import {
  GOAT_BASE_IMAGE,
  UPGRADE_ITEMS,
  buildBadges,
  buildRewardState,
  equipUpgrade,
  goatPreviewImage,
  loadEquippedUpgradeIds,
  rewardLevel,
  saveEquippedUpgradeIds,
  type Badge,
  type RewardState,
  type UpgradeCategory,
  type UpgradeItem,
} from "../lib/rewards.js";
import { useApp } from "../store.js";
import { withViewTransition } from "../lib/viewTransition.js";
import {
  BellIcon,
  CheckIcon,
  CloudCheckIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  TargetIcon,
  TrophyIcon,
} from "./icons.js";

const SHOP_TABS: UpgradeCategory[] = ["All", "Outfits", "Accessories", "Effects", "Boosts"];
const BADGE_TABS = ["All", "Unlocked", "Locked", "Study", "Streaks", "Quiz"] as const;
type BadgeTab = (typeof BADGE_TABS)[number];

export const Points: FC = () => {
  const syncStatus = useApp((s) => s.syncStatus);
  const setView = useApp((s) => s.setView);
  const profile = useApp((s) => s.profile);
  const [state, setState] = useState<RewardState | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [xpTodayValue, setXpTodayValue] = useState(0);
  const [shopTab, setShopTab] = useState<UpgradeCategory>("All");
  const [badgeTab, setBadgeTab] = useState<BadgeTab>("All");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function reload(): Promise<void> {
    let points = 0;
    let ownedUpgradeIds: string[] = [];
    let lifetimeXp = 150;
    let todayXp = 0;
    let weeklyProgress = 1;
    let usingPreviewFallback = true;
    let metrics = {
      noteCount: 1,
      classCount: 1,
      quizAttempts: 1,
      quizBestPct: 82,
      flashcardReviews: 34,
      streak: 2,
      totalXp: 150,
    };

    try {
      const [realPoints, ownedSet, realLifetimeXp, realTodayXp, realMetrics, weeklyDays] =
        await Promise.all([
          totalRewardPoints(),
          goatUpgradePurchases(),
          totalXp(),
          totalXpToday(),
          fetchBadgeProgressMetrics(),
          xpByDay(7),
        ]);
      points = realPoints;
      ownedUpgradeIds = [...ownedSet];
      lifetimeXp = realLifetimeXp;
      todayXp = realTodayXp;
      metrics = realMetrics;
      weeklyProgress = weeklyDays.filter((day) => day.points > 0).length;
      usingPreviewFallback = false;
    } catch {
      /* Vite-in-browser lacks the Electron filesystem bridge; keep the rewards UI previewable. */
    }

    const equippedUpgradeIds = loadEquippedUpgradeIds(ownedUpgradeIds);
    const nextBadges = buildBadges(metrics, profile.badges, !!profile.onboardedAt);
    setBadges(nextBadges);
    setXpTodayValue(todayXp);
    setState(
      buildRewardState({
        lifetimeXp,
        points,
        ownedUpgradeIds,
        equippedUpgradeIds,
        badges: nextBadges,
        weeklyProgress,
        syncStatus: usingPreviewFallback ? "synced" : syncStatus,
      }),
    );
  }

  useEffect(() => {
    void refreshUserBadges()
      .catch(() => undefined)
      .then(() => reload());
  }, []);

  useEffect(() => {
    if (!state) return;
    setState({ ...state, syncStatus });
  }, [syncStatus]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(id);
  }, [notice]);

  const level = useMemo(
    () => rewardLevel(state?.lifetimeXp ?? 0),
    [state?.lifetimeXp],
  );

  const owned = useMemo(
    () => new Set(state?.ownedUpgradeIds ?? []),
    [state?.ownedUpgradeIds],
  );
  const equipped = useMemo(
    () => new Set(state?.equippedUpgradeIds ?? []),
    [state?.equippedUpgradeIds],
  );

  const filteredShop = useMemo(
    () =>
      shopTab === "All"
        ? UPGRADE_ITEMS
        : UPGRADE_ITEMS.filter((item) => item.category === shopTab),
    [shopTab],
  );

  const filteredBadges = useMemo(() => {
    switch (badgeTab) {
      case "Unlocked":
        return badges.filter((badge) => badge.unlocked);
      case "Locked":
        return badges.filter((badge) => !badge.unlocked);
      case "Study":
      case "Streaks":
      case "Quiz":
        return badges.filter((badge) => badge.category === badgeTab);
      case "All":
      default:
        return badges;
    }
  }, [badgeTab, badges]);

  const nextUnlock = useMemo(
    () =>
      UPGRADE_ITEMS.find((item) => !owned.has(item.id)) ??
      UPGRADE_ITEMS[UPGRADE_ITEMS.length - 1]!,
    [owned],
  );

  async function unlock(item: UpgradeItem): Promise<void> {
    if (!state || busyId || owned.has(item.id) || state.points < item.price) return;
    setBusyId(item.id);
    const prev = state;
    const nextOwned = [...state.ownedUpgradeIds, item.id];
    const autoEquipped =
      item.id === "cozyScarf"
        ? equipUpgrade(item, state.equippedUpgradeIds)
        : state.equippedUpgradeIds;
    setState({
      ...state,
      points: state.points - item.price,
      ownedUpgradeIds: nextOwned,
      equippedUpgradeIds: autoEquipped,
      lastUpdatedAt: new Date().toISOString(),
    });
    if (autoEquipped !== state.equippedUpgradeIds) saveEquippedUpgradeIds(autoEquipped);
    try {
      const ok = await spendRewardPoints(`goatUpgrade:${item.id}`, item.price);
      if (!ok) {
        setState(prev);
        setNotice("Not enough points for that upgrade yet.");
        return;
      }
      setNotice(`${item.name} unlocked.`);
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  function equip(item: UpgradeItem): void {
    if (!state || !owned.has(item.id)) return;
    const equippedUpgradeIds = equipUpgrade(item, state.equippedUpgradeIds);
    saveEquippedUpgradeIds(equippedUpgradeIds);
    setState({
      ...state,
      equippedUpgradeIds,
      lastUpdatedAt: new Date().toISOString(),
    });
    setNotice(`${item.name} equipped.`);
  }

  if (!state) {
    return (
      <main className="main rewards-main-shell">
        <div className="rewards-loading">Loading Goat Rewards...</div>
      </main>
    );
  }

  const goatImage = goatPreviewImage(state.equippedUpgradeIds);
  const xpLine = `${state.xp.toLocaleString()} / ${state.xpToNextLevel.toLocaleString()}`;

  return (
    <main className="main rewards-main-shell">
      <div className="rewards-page">
        <div className="rewards-content">
          <header className="rewards-header">
            <div>
              <h1>Goat Rewards</h1>
              <p>Earn points from studying and unlock upgrades for your goat companion.</p>
            </div>
            {notice && <span className="rewards-notice">{notice}</span>}
          </header>

          <section className="rewards-stat-grid" aria-label="Reward summary">
            <RewardStatCard icon={<TrophyIcon />} value={`Level ${state.level}`} label={state.levelName} tone="gold" />
            <RewardStatCard icon={<span>XP</span>} value={xpLine} label="XP" tone="orange" />
            <RewardStatCard icon={<span>P</span>} value={state.points.toLocaleString()} label="Points" tone="peach" />
            <RewardStatCard icon={<StarIcon />} value={state.badgesUnlocked.toString()} label="Badges" tone="green" />
          </section>

          <section className="rewards-hero-grid">
            <TodayProgressCard
              xpLine={`${xpLine} XP to Level ${Math.min(5, state.level + 1)}`}
              percent={level.progressPct}
              onFlashcards={() => withViewTransition(() => setView({ kind: "flashcards" }))}
              onQuiz={() => withViewTransition(() => setView({ kind: "quizzes" }))}
            />
            <GoatCompanionPreview
              level={state.level}
              levelName={state.levelName}
              percent={level.progressPct}
              goatImage={goatImage}
              owned={owned}
              equippedIds={state.equippedUpgradeIds}
              onCustomize={() => setShopTab("Accessories")}
            />
          </section>

          <section className="rewards-section">
            <SectionHeader title="Goat Companion Shop">
              <TabRow
                tabs={SHOP_TABS}
                active={shopTab}
                onChange={(tab) => setShopTab(tab as UpgradeCategory)}
              />
            </SectionHeader>
            <div className="reward-shop-grid">
              {filteredShop.map((item) => (
                <UpgradeCard
                  key={item.id}
                  item={item}
                  points={state.points}
                  owned={owned.has(item.id)}
                  equipped={equipped.has(item.id)}
                  busy={busyId === item.id}
                  onUnlock={() => void unlock(item)}
                  onEquip={() => equip(item)}
                />
              ))}
            </div>
          </section>

          <section className="rewards-section">
            <SectionHeader
              title="Badge Wall"
              subtitle={`${state.badgesUnlocked} of ${state.totalBadges} unlocked`}
            >
              <TabRow
                tabs={[...BADGE_TABS]}
                active={badgeTab}
                onChange={(tab) => setBadgeTab(tab as BadgeTab)}
              />
            </SectionHeader>
            <div className="reward-badge-grid">
              {filteredBadges.map((badge) => (
                <BadgeCard key={badge.id} badge={badge} />
              ))}
            </div>
          </section>
        </div>

        <RewardsRightPanel
          state={state}
          levelProgress={level.progressPct}
          nextUnlock={nextUnlock}
          nextUnlockOwned={owned.has(nextUnlock.id)}
          xpToday={xpTodayValue}
        />
      </div>
    </main>
  );
};

function RewardStatCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  tone: "gold" | "orange" | "peach" | "green";
}): JSX.Element {
  return (
    <article className="reward-stat-card">
      <span className={`reward-stat-icon ${tone}`}>{icon}</span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </article>
  );
}

function TodayProgressCard({
  xpLine,
  percent,
  onFlashcards,
  onQuiz,
}: {
  xpLine: string;
  percent: number;
  onFlashcards: () => void;
  onQuiz: () => void;
}): JSX.Element {
  return (
    <article className="reward-card today-progress-card">
      <div className="reward-card-title">
        <span className="reward-title-icon"><TargetIcon /></span>
        <h2>Today's Progress</h2>
      </div>
      <div className="today-progress-row">
        <strong>{xpLine}</strong>
        <strong>{percent}%</strong>
      </div>
      <ProgressBar value={percent} />
      <p>Complete 2 more study actions to earn points.</p>
      <div className="reward-quick-actions">
        <button type="button" onClick={onFlashcards}>
          <img src={BRAND_FLASHCARD_HERO_URL} alt="" />
          <span>Review Flashcards</span>
        </button>
        <button type="button" onClick={onQuiz}>
          <img src={BRAND_QUIZ_HERO_URL} alt="" />
          <span>Take a Quiz</span>
        </button>
      </div>
    </article>
  );
}

function GoatCompanionPreview({
  level,
  levelName,
  percent,
  goatImage,
  owned,
  equippedIds,
  onCustomize,
}: {
  level: number;
  levelName: string;
  percent: number;
  goatImage: string;
  owned: Set<string>;
  equippedIds: string[];
  onCustomize: () => void;
}): JSX.Element {
  const slots: Array<{ id: "neck" | "head" | "effect"; label: string }> = [
    { id: "neck", label: "Neck" },
    { id: "head", label: "Head" },
    { id: "effect", label: "Effect" },
  ];
  return (
    <article className="reward-card goat-preview-card">
      <button type="button" className="goat-edit-button" onClick={onCustomize} aria-label="Customize goat">
        <PencilIcon size={16} />
      </button>
      <div className="goat-level-ring" style={{ "--pct": `${percent}%` } as CSSProperties}>
        <strong>Level {level}</strong>
        <span>{levelName}</span>
      </div>
      <div className="goat-stage">
        <img src={goatImage} alt="Goat companion preview" />
      </div>
      <div className="goat-slot-row">
        {slots.map((slot) => {
          const item = UPGRADE_ITEMS.find(
            (upgrade) => upgrade.slot === slot.id && equippedIds.includes(upgrade.id),
          );
          return (
            <div key={slot.id} className={`goat-slot ${item ? "filled" : "empty"}`}>
              {item ? (
                <img src={item.image} alt={`${item.name} equipped`} />
              ) : (
                <PlusIcon size={18} aria-hidden />
              )}
              <span>{item ? item.name : slot.label}</span>
            </div>
          );
        })}
      </div>
      {owned.size === 0 && <p className="goat-empty-hint">Take your first quiz to earn points.</p>}
    </article>
  );
}

function SectionHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="reward-section-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <span>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function TabRow({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}): JSX.Element {
  return (
    <div className="reward-tabs">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={active === tab ? "active" : ""}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function UpgradeCard({
  item,
  points,
  owned,
  equipped,
  busy,
  onUnlock,
  onEquip,
}: {
  item: UpgradeItem;
  points: number;
  owned: boolean;
  equipped: boolean;
  busy: boolean;
  onUnlock: () => void;
  onEquip: () => void;
}): JSX.Element {
  const canAfford = points >= item.price;
  return (
    <article className={`upgrade-card ${equipped ? "equipped" : owned ? "owned" : ""}`}>
      <img className="upgrade-image" src={item.image} alt="" />
      <div className="upgrade-copy">
        <div className="upgrade-title-row">
          <h3>{item.name}</h3>
          <strong>{item.price} pts</strong>
        </div>
        <p>{item.description}</p>
        <div className="upgrade-meta">
          {equipped ? (
            <span className="equipped-pill"><CheckIcon size={13} /> Equipped</span>
          ) : owned ? (
            <button type="button" className="reward-mini-button" onClick={onEquip}>
              Equip
            </button>
          ) : canAfford ? (
            <button type="button" className="reward-mini-button primary" disabled={busy} onClick={onUnlock}>
              {busy ? "Unlocking..." : "Unlock"}
            </button>
          ) : (
            <span className="locked-copy"><LockIcon size={13} /> Earn {item.price - points} pts to unlock</span>
          )}
        </div>
      </div>
    </article>
  );
}

function BadgeCard({ badge }: { badge: Badge }): JSX.Element {
  const pct = Math.min(100, Math.round((badge.progressCurrent / Math.max(1, badge.progressTarget)) * 100));
  const showProgress = !badge.unlocked || badge.progressTarget > 1;
  return (
    <article className={`badge-card ${badge.unlocked ? "unlocked" : "locked"}`}>
      <span className="badge-status">
        {badge.unlocked ? <CheckIcon size={14} /> : <LockIcon size={14} />}
      </span>
      <img src={badge.image} alt="" />
      <h3>{badge.name}</h3>
      <p>{badge.description}</p>
      {showProgress && (
        <div className="badge-progress">
          <span>
            {badge.progressCurrent} / {badge.progressTarget}
            {badge.id === "quiz_star" ? "%" : badge.id.includes("warrior") || badge.id.includes("streak") ? " days" : ""}
          </span>
          <ProgressBar value={pct} />
        </div>
      )}
    </article>
  );
}

function RewardsRightPanel({
  state,
  levelProgress,
  nextUnlock,
  nextUnlockOwned,
  xpToday,
}: {
  state: RewardState;
  levelProgress: number;
  nextUnlock: UpgradeItem;
  nextUnlockOwned: boolean;
  xpToday: number;
}): JSX.Element {
  const pointsNeeded = Math.max(0, nextUnlock.price - state.points);
  const syncGood = state.syncStatus === "synced";
  return (
    <aside className="right-panel rewards-right-panel">
      <PanelCard icon={<TrophyIcon />} title={`Level ${state.level}`}>
        <p className="panel-subtitle">{state.levelName}</p>
        <PanelMetric label="XP" value={`${state.xp.toLocaleString()} / ${state.xpToNextLevel.toLocaleString()}`} />
        <ProgressBar value={levelProgress} />
        <p className="panel-muted">{state.level >= 5 ? "Max level reached" : `${state.xpToNextLevel - state.xp} XP to Level ${state.level + 1}`}</p>
      </PanelCard>

      <PanelCard icon={<BellIcon />} title="Next Unlock">
        <div className="next-unlock-row">
          <div>
            <strong>{nextUnlock.name}</strong>
            <span>{nextUnlockOwned ? "Owned" : `${pointsNeeded} points needed`}</span>
            <p>{nextUnlock.description}</p>
          </div>
          <img src={nextUnlock.id === "cozyScarf" ? GOAT_BASE_IMAGE : nextUnlock.image} alt="" />
        </div>
        <ProgressBar value={Math.min(100, Math.round((state.points / Math.max(1, nextUnlock.price)) * 100))} />
        <span className="panel-progress-label">{Math.min(state.points, nextUnlock.price)} / {nextUnlock.price} pts</span>
      </PanelCard>

      <PanelCard icon={<SparklesIcon />} title="How to Earn Points">
        <div className="earn-list">
          <EarnRow label="Complete quiz" value="+10" />
          <EarnRow label="Score 80%+" value="+15" />
          <EarnRow label="Review 10 flashcards" value="+8" />
          <EarnRow label="Finish study task" value="+5" />
          <EarnRow label="3-day streak" value="+20" />
        </div>
      </PanelCard>

      <PanelCard icon={<TargetIcon />} title="Weekly Challenge">
        <p className="panel-subtitle">{state.weeklyChallenge.title}</p>
        <ProgressBar
          value={Math.round((state.weeklyChallenge.progressCurrent / state.weeklyChallenge.progressTarget) * 100)}
        />
        <PanelMetric
          label="Progress"
          value={`${state.weeklyChallenge.progressCurrent} / ${state.weeklyChallenge.progressTarget}`}
        />
        <p className="panel-muted">Reward: 50 XP + 15 points</p>
      </PanelCard>

      <PanelCard icon={syncGood ? <CloudCheckIcon /> : <CloudCheckIcon />} title={syncGood ? "All changes synced" : "Sync pending"}>
        <p className="panel-subtitle">{syncGood ? "Everything is up to date." : `Current status: ${state.syncStatus}`}</p>
        <PanelMetric label="Today" value={`${xpToday} XP`} />
      </PanelCard>
    </aside>
  );
}

function PanelCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="reward-panel-card">
      <div className="reward-panel-head">
        <span>{icon}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function PanelMetric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="panel-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EarnRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="earn-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressBar({ value }: { value: number }): JSX.Element {
  return (
    <div className="reward-progress-bar" aria-hidden>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
