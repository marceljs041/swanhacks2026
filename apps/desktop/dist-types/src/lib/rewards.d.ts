import type { BadgeProgressMetrics } from "../db/repositories.js";
export type UpgradeCategory = "All" | "Outfits" | "Accessories" | "Effects" | "Boosts";
export type UpgradeSlotId = "neck" | "head" | "effect";
export type SyncState = "synced" | "syncing" | "saving" | "offline" | "conflict" | "error";
export interface UpgradeItem {
    id: string;
    name: string;
    category: Exclude<UpgradeCategory, "All">;
    description: string;
    price: number;
    image: string;
    slot: UpgradeSlotId;
}
export interface WeeklyChallenge {
    id: string;
    title: string;
    progressCurrent: number;
    progressTarget: number;
    rewardXp: number;
    rewardPoints: number;
    completed: boolean;
}
export interface RewardLevel {
    level: number;
    levelName: string;
    xp: number;
    xpToNextLevel: number;
    xpRemaining: number;
    progressPct: number;
}
export interface Badge {
    id: string;
    name: string;
    description: string;
    category: "Study" | "Streaks" | "Quiz";
    image: string;
    unlocked: boolean;
    progressCurrent: number;
    progressTarget: number;
    unlockedAt: string | null;
}
export interface RewardState {
    level: number;
    levelName: string;
    xp: number;
    xpToNextLevel: number;
    points: number;
    lifetimeXp: number;
    badgesUnlocked: number;
    totalBadges: number;
    ownedUpgradeIds: string[];
    equippedUpgradeIds: string[];
    weeklyChallenge: WeeklyChallenge;
    lastUpdatedAt: string;
    syncStatus: SyncState;
}
export declare const UPGRADE_ITEMS: UpgradeItem[];
export declare const GOAT_BASE_IMAGE = "/rewards/goat-base.png";
export declare const GOAT_SCARF_IMAGE = "/rewards/goat-cozy-scarf.png";
export declare function rewardLevel(lifetimeXp: number): RewardLevel;
export declare function loadEquippedUpgradeIds(ownedIds: string[]): string[];
export declare function saveEquippedUpgradeIds(ids: string[]): void;
export declare function equipUpgrade(upgrade: UpgradeItem, equippedIds: string[]): string[];
export declare function goatPreviewImage(equippedIds: string[]): string;
export declare function buildWeeklyChallenge(progressCurrent: number): WeeklyChallenge;
export declare function buildBadges(metrics: BadgeProgressMetrics, profileBadgeIds: string[], onboarded: boolean): Badge[];
export declare function buildRewardState(args: {
    lifetimeXp: number;
    points: number;
    ownedUpgradeIds: string[];
    equippedUpgradeIds: string[];
    badges: Badge[];
    weeklyProgress: number;
    syncStatus: SyncState;
}): RewardState;
//# sourceMappingURL=rewards.d.ts.map