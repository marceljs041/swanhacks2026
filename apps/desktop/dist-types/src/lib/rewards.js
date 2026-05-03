const ASSET_BASE = "/rewards";
const EQUIPPED_KEY = "notegoat:reward-equipped-upgrades-v1";
export const UPGRADE_ITEMS = [
    {
        id: "cozyScarf",
        name: "Cozy Scarf",
        category: "Accessories",
        description: "Keep your goat warm while studying.",
        price: 25,
        image: `${ASSET_BASE}/item-cozy-scarf.png`,
        slot: "neck",
    },
    {
        id: "goldenBell",
        name: "Golden Bell",
        category: "Accessories",
        description: "A shiny bell for top-streak vibes.",
        price: 40,
        image: `${ASSET_BASE}/item-golden-bell.png`,
        slot: "neck",
    },
    {
        id: "nebulaHornPolish",
        name: "Nebula Horn Polish",
        category: "Effects",
        description: "Cosmic glow-up for your companion.",
        price: 60,
        image: `${ASSET_BASE}/item-nebula-horn-polish.png`,
        slot: "effect",
    },
    {
        id: "tinyJetpack",
        name: "Tiny Jetpack",
        category: "Accessories",
        description: "For high-speed knowledge quests.",
        price: 90,
        image: `${ASSET_BASE}/item-tiny-jetpack.png`,
        slot: "effect",
    },
    {
        id: "studyGlasses",
        name: "Study Glasses",
        category: "Accessories",
        description: "Sharper focus for big brain sessions.",
        price: 120,
        image: `${ASSET_BASE}/item-study-glasses.png`,
        slot: "head",
    },
    {
        id: "wizardHat",
        name: "Wizard Hat",
        category: "Outfits",
        description: "Channel peak focus and magic.",
        price: 200,
        image: `${ASSET_BASE}/item-wizard-hat.png`,
        slot: "head",
    },
];
export const GOAT_BASE_IMAGE = `${ASSET_BASE}/goat-base.png`;
export const GOAT_SCARF_IMAGE = `${ASSET_BASE}/goat-cozy-scarf.png`;
const LEVELS = [
    { level: 1, min: 0, next: 250, name: "Study Goat" },
    { level: 2, min: 250, next: 600, name: "Note Nibbler" },
    { level: 3, min: 600, next: 1000, name: "Quiz Climber" },
    { level: 4, min: 1000, next: 1500, name: "Flashcard Farmer" },
    { level: 5, min: 1500, next: 1500, name: "Knowledge Goat" },
];
export function rewardLevel(lifetimeXp) {
    const current = [...LEVELS].reverse().find((level) => lifetimeXp >= level.min) ?? LEVELS[0];
    const xpToNextLevel = current.level === 5 ? current.min : current.next;
    const span = Math.max(1, xpToNextLevel - current.min);
    const inLevel = Math.max(0, lifetimeXp - current.min);
    return {
        level: current.level,
        levelName: current.name,
        xp: lifetimeXp,
        xpToNextLevel,
        xpRemaining: Math.max(0, xpToNextLevel - lifetimeXp),
        progressPct: current.level === 5 ? 100 : Math.min(100, Math.round((inLevel / span) * 100)),
    };
}
export function loadEquippedUpgradeIds(ownedIds) {
    const owned = new Set(ownedIds);
    let parsed = null;
    if (typeof window !== "undefined") {
        try {
            parsed = JSON.parse(window.localStorage.getItem(EQUIPPED_KEY) ?? "[]");
        }
        catch {
            parsed = null;
        }
    }
    const saved = Array.isArray(parsed)
        ? parsed.filter((id) => typeof id === "string" && owned.has(id))
        : [];
    if (saved.length === 0 && owned.has("cozyScarf"))
        return ["cozyScarf"];
    return saved;
}
export function saveEquippedUpgradeIds(ids) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem(EQUIPPED_KEY, JSON.stringify(ids));
    }
    catch {
        /* ignore private-mode write failures */
    }
}
export function equipUpgrade(upgrade, equippedIds) {
    const sameSlot = new Set(UPGRADE_ITEMS.filter((item) => item.slot === upgrade.slot).map((item) => item.id));
    return [...equippedIds.filter((id) => !sameSlot.has(id)), upgrade.id];
}
export function goatPreviewImage(equippedIds) {
    return equippedIds.includes("cozyScarf") ? GOAT_SCARF_IMAGE : GOAT_BASE_IMAGE;
}
export function buildWeeklyChallenge(progressCurrent) {
    return {
        id: "weekly-study-sessions",
        title: "Complete 3 study sessions",
        progressCurrent: Math.min(3, progressCurrent),
        progressTarget: 3,
        rewardXp: 50,
        rewardPoints: 15,
        completed: progressCurrent >= 3,
    };
}
export function buildBadges(metrics, profileBadgeIds, onboarded) {
    const profile = new Set(profileBadgeIds);
    const quizBest = metrics.quizBestPct;
    const noteCount = metrics.noteCount;
    const classCount = metrics.classCount;
    const flashcards = metrics.flashcardReviews;
    const streak = metrics.streak;
    const totalXp = metrics.totalXp;
    const rows = [
        {
            id: "welcome_aboard",
            name: "Welcome Aboard",
            description: "Joined the nest.",
            category: "Study",
            image: `${ASSET_BASE}/badge-welcome-aboard.png`,
            progressCurrent: onboarded ? 1 : 0,
            progressTarget: 1,
            profileIds: ["welcome_aboard"],
        },
        {
            id: "organizer",
            name: "Organizer",
            description: "Created your first class.",
            category: "Study",
            image: `${ASSET_BASE}/badge-organizer.png`,
            progressCurrent: Math.min(1, classCount),
            progressTarget: 1,
            profileIds: ["organizer"],
        },
        {
            id: "first_note",
            name: "First Note",
            description: "Captured your first note.",
            category: "Study",
            image: `${ASSET_BASE}/badge-first-note.png`,
            progressCurrent: Math.min(1, noteCount),
            progressTarget: 1,
            profileIds: ["first_note"],
        },
        {
            id: "quiz_starter",
            name: "Quiz Starter",
            description: "Completed a quiz attempt.",
            category: "Quiz",
            image: `${ASSET_BASE}/badge-quiz-starter.png`,
            progressCurrent: Math.min(1, metrics.quizAttempts),
            progressTarget: 1,
            profileIds: ["quiz_starter"],
        },
        {
            id: "xp_spark",
            name: "XP Spark",
            description: "Earned 50 lifetime XP.",
            category: "Study",
            image: `${ASSET_BASE}/badge-xp-spark.png`,
            progressCurrent: Math.min(50, totalXp),
            progressTarget: 50,
            profileIds: ["xp_spark"],
        },
        {
            id: "quiz_star",
            name: "Quiz Star",
            description: "Score 90% or higher on a quiz.",
            category: "Quiz",
            image: `${ASSET_BASE}/badge-quiz-star.png`,
            progressCurrent: Math.min(90, quizBest),
            progressTarget: 90,
            profileIds: ["quiz_star"],
        },
        {
            id: "card_buff",
            name: "Card Buff",
            description: "100 flashcard reviews logged.",
            category: "Study",
            image: `${ASSET_BASE}/badge-card-buff.png`,
            progressCurrent: Math.min(100, flashcards),
            progressTarget: 100,
            profileIds: ["card_buff"],
        },
        {
            id: "week_warrior",
            name: "Week Warrior",
            description: "Seven days in a row with study XP.",
            category: "Streaks",
            image: `${ASSET_BASE}/badge-week-warrior.png`,
            progressCurrent: Math.min(7, streak),
            progressTarget: 7,
            profileIds: ["week_warrior"],
        },
        {
            id: "memory_athlete",
            name: "Memory Athlete",
            description: "500 flashcard reviews.",
            category: "Study",
            image: `${ASSET_BASE}/badge-memory-athlete.png`,
            progressCurrent: Math.min(500, flashcards),
            progressTarget: 500,
            profileIds: ["memory_athlete"],
        },
        {
            id: "offline_hero",
            name: "Offline Hero",
            description: "Create 5 notes while offline.",
            category: "Study",
            image: `${ASSET_BASE}/badge-offline-hero.png`,
            progressCurrent: 0,
            progressTarget: 5,
        },
        {
            id: "exam_ready",
            name: "Exam Ready",
            description: "Complete a study plan before an exam.",
            category: "Study",
            image: `${ASSET_BASE}/badge-exam-ready.png`,
            progressCurrent: 0,
            progressTarget: 1,
        },
        {
            id: "class_captain",
            name: "Class Captain",
            description: "Add 5 classes.",
            category: "Study",
            image: `${ASSET_BASE}/badge-class-captain.png`,
            progressCurrent: Math.min(5, classCount),
            progressTarget: 5,
        },
        {
            id: "streak_starter",
            name: "Streak Starter",
            description: "Keep a 3-day study streak.",
            category: "Streaks",
            image: `${ASSET_BASE}/badge-streak-starter.png`,
            progressCurrent: Math.min(3, streak),
            progressTarget: 3,
            profileIds: ["streak_starter"],
        },
        {
            id: "deep_thinker",
            name: "Deep Thinker",
            description: "Create 50 notes.",
            category: "Study",
            image: `${ASSET_BASE}/badge-deep-thinker.png`,
            progressCurrent: Math.min(50, noteCount),
            progressTarget: 50,
            profileIds: ["deep_thinker"],
        },
    ];
    return rows.map((badge) => {
        const profileUnlocked = (badge.profileIds ?? [badge.id]).some((id) => profile.has(id));
        const progressUnlocked = badge.progressCurrent >= badge.progressTarget;
        const unlocked = profileUnlocked || progressUnlocked;
        return {
            ...badge,
            unlocked,
            unlockedAt: unlocked ? new Date().toISOString() : null,
        };
    });
}
export function buildRewardState(args) {
    const level = rewardLevel(args.lifetimeXp);
    return {
        level: level.level,
        levelName: level.levelName,
        xp: level.xp,
        xpToNextLevel: level.xpToNextLevel,
        points: args.points,
        lifetimeXp: args.lifetimeXp,
        badgesUnlocked: args.badges.filter((badge) => badge.unlocked).length,
        totalBadges: args.badges.length,
        ownedUpgradeIds: args.ownedUpgradeIds,
        equippedUpgradeIds: args.equippedUpgradeIds,
        weeklyChallenge: buildWeeklyChallenge(args.weeklyProgress),
        lastUpdatedAt: new Date().toISOString(),
        syncStatus: args.syncStatus,
    };
}
//# sourceMappingURL=rewards.js.map