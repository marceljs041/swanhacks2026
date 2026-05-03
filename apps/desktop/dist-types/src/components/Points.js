import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { fetchBadgeProgressMetrics, goatUpgradePurchases, spendRewardPoints, totalRewardPoints, totalXp, totalXpToday, xpByDay, } from "../db/repositories.js";
import { refreshUserBadges } from "../lib/badgesSync.js";
import { GOAT_BASE_IMAGE, UPGRADE_ITEMS, buildBadges, buildRewardState, equipUpgrade, goatPreviewImage, loadEquippedUpgradeIds, rewardLevel, saveEquippedUpgradeIds, } from "../lib/rewards.js";
import { useApp } from "../store.js";
import { withViewTransition } from "../lib/viewTransition.js";
import { BellIcon, CheckIcon, CloudCheckIcon, LockIcon, PencilIcon, PlusIcon, SparklesIcon, StarIcon, TargetIcon, TrophyIcon, } from "./icons.js";
const SHOP_TABS = ["All", "Outfits", "Accessories", "Effects", "Boosts"];
const BADGE_TABS = ["All", "Unlocked", "Locked", "Study", "Streaks", "Quiz"];
export const Points = () => {
    const syncStatus = useApp((s) => s.syncStatus);
    const setView = useApp((s) => s.setView);
    const profile = useApp((s) => s.profile);
    const [state, setState] = useState(null);
    const [badges, setBadges] = useState([]);
    const [xpTodayValue, setXpTodayValue] = useState(0);
    const [shopTab, setShopTab] = useState("All");
    const [badgeTab, setBadgeTab] = useState("All");
    const [busyId, setBusyId] = useState(null);
    const [notice, setNotice] = useState(null);
    async function reload() {
        let points = 0;
        let ownedUpgradeIds = [];
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
            const [realPoints, ownedSet, realLifetimeXp, realTodayXp, realMetrics, weeklyDays] = await Promise.all([
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
        }
        catch {
            /* Vite-in-browser lacks the Electron filesystem bridge; keep the rewards UI previewable. */
        }
        const equippedUpgradeIds = loadEquippedUpgradeIds(ownedUpgradeIds);
        const nextBadges = buildBadges(metrics, profile.badges, !!profile.onboardedAt);
        setBadges(nextBadges);
        setXpTodayValue(todayXp);
        setState(buildRewardState({
            lifetimeXp,
            points,
            ownedUpgradeIds,
            equippedUpgradeIds,
            badges: nextBadges,
            weeklyProgress,
            syncStatus: usingPreviewFallback ? "synced" : syncStatus,
        }));
    }
    useEffect(() => {
        void refreshUserBadges()
            .catch(() => undefined)
            .then(() => reload());
    }, []);
    useEffect(() => {
        if (!state)
            return;
        setState({ ...state, syncStatus });
    }, [syncStatus]);
    useEffect(() => {
        if (!notice)
            return;
        const id = window.setTimeout(() => setNotice(null), 2600);
        return () => window.clearTimeout(id);
    }, [notice]);
    const level = useMemo(() => rewardLevel(state?.lifetimeXp ?? 0), [state?.lifetimeXp]);
    const owned = useMemo(() => new Set(state?.ownedUpgradeIds ?? []), [state?.ownedUpgradeIds]);
    const equipped = useMemo(() => new Set(state?.equippedUpgradeIds ?? []), [state?.equippedUpgradeIds]);
    const filteredShop = useMemo(() => shopTab === "All"
        ? UPGRADE_ITEMS
        : UPGRADE_ITEMS.filter((item) => item.category === shopTab), [shopTab]);
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
    const nextUnlock = useMemo(() => UPGRADE_ITEMS.find((item) => !owned.has(item.id)) ??
        UPGRADE_ITEMS[UPGRADE_ITEMS.length - 1], [owned]);
    async function unlock(item) {
        if (!state || busyId || owned.has(item.id) || state.points < item.price)
            return;
        setBusyId(item.id);
        const prev = state;
        const nextOwned = [...state.ownedUpgradeIds, item.id];
        const autoEquipped = item.id === "cozyScarf"
            ? equipUpgrade(item, state.equippedUpgradeIds)
            : state.equippedUpgradeIds;
        setState({
            ...state,
            points: state.points - item.price,
            ownedUpgradeIds: nextOwned,
            equippedUpgradeIds: autoEquipped,
            lastUpdatedAt: new Date().toISOString(),
        });
        if (autoEquipped !== state.equippedUpgradeIds)
            saveEquippedUpgradeIds(autoEquipped);
        try {
            const ok = await spendRewardPoints(`goatUpgrade:${item.id}`, item.price);
            if (!ok) {
                setState(prev);
                setNotice("Not enough points for that upgrade yet.");
                return;
            }
            setNotice(`${item.name} unlocked.`);
            await reload();
        }
        finally {
            setBusyId(null);
        }
    }
    function equip(item) {
        if (!state || !owned.has(item.id))
            return;
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
        return (_jsx("main", { className: "main rewards-main-shell", children: _jsx("div", { className: "rewards-loading", children: "Loading Goat Rewards..." }) }));
    }
    const goatImage = goatPreviewImage(state.equippedUpgradeIds);
    const xpLine = `${state.xp.toLocaleString()} / ${state.xpToNextLevel.toLocaleString()}`;
    return (_jsx("main", { className: "main rewards-main-shell", children: _jsxs("div", { className: "rewards-page", children: [_jsxs("div", { className: "rewards-content", children: [_jsxs("header", { className: "rewards-header", children: [_jsxs("div", { children: [_jsx("h1", { children: "Goat Rewards" }), _jsx("p", { children: "Earn points from studying and unlock upgrades for your goat companion." })] }), notice && _jsx("span", { className: "rewards-notice", children: notice })] }), _jsxs("section", { className: "rewards-stat-grid", "aria-label": "Reward summary", children: [_jsx(RewardStatCard, { icon: _jsx(TrophyIcon, {}), value: `Level ${state.level}`, label: state.levelName, tone: "gold" }), _jsx(RewardStatCard, { icon: _jsx("span", { children: "XP" }), value: xpLine, label: "XP", tone: "orange" }), _jsx(RewardStatCard, { icon: _jsx("span", { children: "P" }), value: state.points.toLocaleString(), label: "Points", tone: "peach" }), _jsx(RewardStatCard, { icon: _jsx(StarIcon, {}), value: state.badgesUnlocked.toString(), label: "Badges", tone: "green" })] }), _jsxs("section", { className: "rewards-hero-grid", children: [_jsx(TodayProgressCard, { xpLine: `${xpLine} XP to Level ${Math.min(5, state.level + 1)}`, percent: level.progressPct, onFlashcards: () => withViewTransition(() => setView({ kind: "flashcards" })), onQuiz: () => withViewTransition(() => setView({ kind: "quizzes" })) }), _jsx(GoatCompanionPreview, { level: state.level, levelName: state.levelName, percent: level.progressPct, goatImage: goatImage, owned: owned, equippedIds: state.equippedUpgradeIds, onCustomize: () => setShopTab("Accessories") })] }), _jsxs("section", { className: "rewards-section", children: [_jsx(SectionHeader, { title: "Goat Companion Shop", children: _jsx(TabRow, { tabs: SHOP_TABS, active: shopTab, onChange: (tab) => setShopTab(tab) }) }), _jsx("div", { className: "reward-shop-grid", children: filteredShop.map((item) => (_jsx(UpgradeCard, { item: item, points: state.points, owned: owned.has(item.id), equipped: equipped.has(item.id), busy: busyId === item.id, onUnlock: () => void unlock(item), onEquip: () => equip(item) }, item.id))) })] }), _jsxs("section", { className: "rewards-section", children: [_jsx(SectionHeader, { title: "Badge Wall", subtitle: `${state.badgesUnlocked} of ${state.totalBadges} unlocked`, children: _jsx(TabRow, { tabs: [...BADGE_TABS], active: badgeTab, onChange: (tab) => setBadgeTab(tab) }) }), _jsx("div", { className: "reward-badge-grid", children: filteredBadges.map((badge) => (_jsx(BadgeCard, { badge: badge }, badge.id))) })] })] }), _jsx(RewardsRightPanel, { state: state, levelProgress: level.progressPct, nextUnlock: nextUnlock, nextUnlockOwned: owned.has(nextUnlock.id), xpToday: xpTodayValue })] }) }));
};
function RewardStatCard({ icon, value, label, tone, }) {
    return (_jsxs("article", { className: "reward-stat-card", children: [_jsx("span", { className: `reward-stat-icon ${tone}`, children: icon }), _jsxs("span", { children: [_jsx("strong", { children: value }), _jsx("small", { children: label })] })] }));
}
function TodayProgressCard({ xpLine, percent, onFlashcards, onQuiz, }) {
    return (_jsxs("article", { className: "reward-card today-progress-card", children: [_jsxs("div", { className: "reward-card-title", children: [_jsx("span", { className: "reward-title-icon", children: _jsx(TargetIcon, {}) }), _jsx("h2", { children: "Today's Progress" })] }), _jsxs("div", { className: "today-progress-row", children: [_jsx("strong", { children: xpLine }), _jsxs("strong", { children: [percent, "%"] })] }), _jsx(ProgressBar, { value: percent }), _jsx("p", { children: "Complete 2 more study actions to earn points." }), _jsxs("div", { className: "reward-quick-actions", children: [_jsxs("button", { type: "button", onClick: onFlashcards, children: [_jsx("img", { src: "/flashcard.svg", alt: "" }), _jsx("span", { children: "Review Flashcards" })] }), _jsxs("button", { type: "button", onClick: onQuiz, children: [_jsx("img", { src: "/quiz.svg", alt: "" }), _jsx("span", { children: "Take a Quiz" })] })] })] }));
}
function GoatCompanionPreview({ level, levelName, percent, goatImage, owned, equippedIds, onCustomize, }) {
    const slots = [
        { id: "neck", label: "Neck" },
        { id: "head", label: "Head" },
        { id: "effect", label: "Effect" },
    ];
    return (_jsxs("article", { className: "reward-card goat-preview-card", children: [_jsx("button", { type: "button", className: "goat-edit-button", onClick: onCustomize, "aria-label": "Customize goat", children: _jsx(PencilIcon, { size: 16 }) }), _jsxs("div", { className: "goat-level-ring", style: { "--pct": `${percent}%` }, children: [_jsxs("strong", { children: ["Level ", level] }), _jsx("span", { children: levelName })] }), _jsx("div", { className: "goat-stage", children: _jsx("img", { src: goatImage, alt: "Goat companion preview" }) }), _jsx("div", { className: "goat-slot-row", children: slots.map((slot) => {
                    const item = UPGRADE_ITEMS.find((upgrade) => upgrade.slot === slot.id && equippedIds.includes(upgrade.id));
                    return (_jsxs("div", { className: `goat-slot ${item ? "filled" : "empty"}`, children: [item ? (_jsx("img", { src: item.image, alt: `${item.name} equipped` })) : (_jsx(PlusIcon, { size: 18, "aria-hidden": true })), _jsx("span", { children: item ? item.name : slot.label })] }, slot.id));
                }) }), owned.size === 0 && _jsx("p", { className: "goat-empty-hint", children: "Take your first quiz to earn points." })] }));
}
function SectionHeader({ title, subtitle, children, }) {
    return (_jsxs("div", { className: "reward-section-head", children: [_jsxs("div", { children: [_jsx("h2", { children: title }), subtitle && _jsx("span", { children: subtitle })] }), children] }));
}
function TabRow({ tabs, active, onChange, }) {
    return (_jsx("div", { className: "reward-tabs", children: tabs.map((tab) => (_jsx("button", { type: "button", className: active === tab ? "active" : "", onClick: () => onChange(tab), children: tab }, tab))) }));
}
function UpgradeCard({ item, points, owned, equipped, busy, onUnlock, onEquip, }) {
    const canAfford = points >= item.price;
    return (_jsxs("article", { className: `upgrade-card ${equipped ? "equipped" : owned ? "owned" : ""}`, children: [_jsx("img", { className: "upgrade-image", src: item.image, alt: "" }), _jsxs("div", { className: "upgrade-copy", children: [_jsxs("div", { className: "upgrade-title-row", children: [_jsx("h3", { children: item.name }), _jsxs("strong", { children: [item.price, " pts"] })] }), _jsx("p", { children: item.description }), _jsx("div", { className: "upgrade-meta", children: equipped ? (_jsxs("span", { className: "equipped-pill", children: [_jsx(CheckIcon, { size: 13 }), " Equipped"] })) : owned ? (_jsx("button", { type: "button", className: "reward-mini-button", onClick: onEquip, children: "Equip" })) : canAfford ? (_jsx("button", { type: "button", className: "reward-mini-button primary", disabled: busy, onClick: onUnlock, children: busy ? "Unlocking..." : "Unlock" })) : (_jsxs("span", { className: "locked-copy", children: [_jsx(LockIcon, { size: 13 }), " Earn ", item.price - points, " pts to unlock"] })) })] })] }));
}
function BadgeCard({ badge }) {
    const pct = Math.min(100, Math.round((badge.progressCurrent / Math.max(1, badge.progressTarget)) * 100));
    const showProgress = !badge.unlocked || badge.progressTarget > 1;
    return (_jsxs("article", { className: `badge-card ${badge.unlocked ? "unlocked" : "locked"}`, children: [_jsx("span", { className: "badge-status", children: badge.unlocked ? _jsx(CheckIcon, { size: 14 }) : _jsx(LockIcon, { size: 14 }) }), _jsx("img", { src: badge.image, alt: "" }), _jsx("h3", { children: badge.name }), _jsx("p", { children: badge.description }), showProgress && (_jsxs("div", { className: "badge-progress", children: [_jsxs("span", { children: [badge.progressCurrent, " / ", badge.progressTarget, badge.id === "quiz_star" ? "%" : badge.id.includes("warrior") || badge.id.includes("streak") ? " days" : ""] }), _jsx(ProgressBar, { value: pct })] }))] }));
}
function RewardsRightPanel({ state, levelProgress, nextUnlock, nextUnlockOwned, xpToday, }) {
    const pointsNeeded = Math.max(0, nextUnlock.price - state.points);
    const syncGood = state.syncStatus === "synced";
    return (_jsxs("aside", { className: "right-panel rewards-right-panel", children: [_jsxs(PanelCard, { icon: _jsx(TrophyIcon, {}), title: `Level ${state.level}`, children: [_jsx("p", { className: "panel-subtitle", children: state.levelName }), _jsx(PanelMetric, { label: "XP", value: `${state.xp.toLocaleString()} / ${state.xpToNextLevel.toLocaleString()}` }), _jsx(ProgressBar, { value: levelProgress }), _jsx("p", { className: "panel-muted", children: state.level >= 5 ? "Max level reached" : `${state.xpToNextLevel - state.xp} XP to Level ${state.level + 1}` })] }), _jsxs(PanelCard, { icon: _jsx(BellIcon, {}), title: "Next Unlock", children: [_jsxs("div", { className: "next-unlock-row", children: [_jsxs("div", { children: [_jsx("strong", { children: nextUnlock.name }), _jsx("span", { children: nextUnlockOwned ? "Owned" : `${pointsNeeded} points needed` }), _jsx("p", { children: nextUnlock.description })] }), _jsx("img", { src: nextUnlock.id === "cozyScarf" ? GOAT_BASE_IMAGE : nextUnlock.image, alt: "" })] }), _jsx(ProgressBar, { value: Math.min(100, Math.round((state.points / Math.max(1, nextUnlock.price)) * 100)) }), _jsxs("span", { className: "panel-progress-label", children: [Math.min(state.points, nextUnlock.price), " / ", nextUnlock.price, " pts"] })] }), _jsx(PanelCard, { icon: _jsx(SparklesIcon, {}), title: "How to Earn Points", children: _jsxs("div", { className: "earn-list", children: [_jsx(EarnRow, { label: "Complete quiz", value: "+10" }), _jsx(EarnRow, { label: "Score 80%+", value: "+15" }), _jsx(EarnRow, { label: "Review 10 flashcards", value: "+8" }), _jsx(EarnRow, { label: "Finish study task", value: "+5" }), _jsx(EarnRow, { label: "3-day streak", value: "+20" })] }) }), _jsxs(PanelCard, { icon: _jsx(TargetIcon, {}), title: "Weekly Challenge", children: [_jsx("p", { className: "panel-subtitle", children: state.weeklyChallenge.title }), _jsx(ProgressBar, { value: Math.round((state.weeklyChallenge.progressCurrent / state.weeklyChallenge.progressTarget) * 100) }), _jsx(PanelMetric, { label: "Progress", value: `${state.weeklyChallenge.progressCurrent} / ${state.weeklyChallenge.progressTarget}` }), _jsx("p", { className: "panel-muted", children: "Reward: 50 XP + 15 points" })] }), _jsxs(PanelCard, { icon: syncGood ? _jsx(CloudCheckIcon, {}) : _jsx(CloudCheckIcon, {}), title: syncGood ? "All changes synced" : "Sync pending", children: [_jsx("p", { className: "panel-subtitle", children: syncGood ? "Everything is up to date." : `Current status: ${state.syncStatus}` }), _jsx(PanelMetric, { label: "Today", value: `${xpToday} XP` })] })] }));
}
function PanelCard({ icon, title, children, }) {
    return (_jsxs("section", { className: "reward-panel-card", children: [_jsxs("div", { className: "reward-panel-head", children: [_jsx("span", { children: icon }), _jsx("h2", { children: title })] }), children] }));
}
function PanelMetric({ label, value }) {
    return (_jsxs("div", { className: "panel-metric", children: [_jsx("span", { children: label }), _jsx("strong", { children: value })] }));
}
function EarnRow({ label, value }) {
    return (_jsxs("div", { className: "earn-row", children: [_jsx("span", { children: label }), _jsx("strong", { children: value })] }));
}
function ProgressBar({ value }) {
    return (_jsx("div", { className: "reward-progress-bar", "aria-hidden": true, children: _jsx("span", { style: { width: `${Math.max(0, Math.min(100, value))}%` } }) }));
}
//# sourceMappingURL=Points.js.map