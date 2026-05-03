/**
 * Generates a context-aware greeting for the home hero.
 *
 * Resolution order (most specific wins):
 *   1. Holiday on this calendar date (US/observed — fixed and floating).
 *   2. Special day-of-week vibes (Friday afternoon, Sunday evening, etc.).
 *   3. Time-of-day buckets (early morning, morning, midday, afternoon,
 *      evening, night, late-night).
 *
 * Each bucket has a small pool of phrases — we pick a deterministic one
 * based on `date.toDateString() + bucket` so the greeting stays stable
 * across re-renders within the same day but rotates day-to-day.
 *
 * Phrases use `{name}` as the placeholder for the user's first name.
 * Empty `name` falls back to a no-name variant when one is provided.
 */
/* ---------- bucket pools ----------------------------------------- */
const earlyMorning = {
    key: "early-morning",
    phrases: [
        {
            headline: "Up with the sunrise, {name}",
            subline: "Quiet hours are perfect for deep focus.",
            emoji: "🌅",
        },
        {
            headline: "Early bird, {name}",
            subline: "A calm start usually means a productive day.",
            emoji: "🐦",
        },
    ],
};
const morning = {
    key: "morning",
    phrases: [
        {
            headline: "Good morning, {name}",
            subline: "Ready to learn something great today?",
            emoji: "☀️",
        },
        {
            headline: "Morning, {name}",
            subline: "Fresh start — what should we tackle first?",
            emoji: "☕",
        },
        {
            headline: "Rise and shine, {name}",
            subline: "Your notes are waiting for you.",
            emoji: "🌤️",
        },
    ],
};
const midday = {
    key: "midday",
    phrases: [
        {
            headline: "Hey {name}",
            subline: "Halfway through the day — a focused sprint here pays off.",
            emoji: "🌞",
        },
        {
            headline: "Lunch break, {name}?",
            subline: "Even ten minutes of review keeps the streak alive.",
            emoji: "🥪",
        },
    ],
};
const afternoon = {
    key: "afternoon",
    phrases: [
        {
            headline: "Good afternoon, {name}",
            subline: "Let's keep the momentum going.",
            emoji: "🌤️",
        },
        {
            headline: "Welcome back, {name}",
            subline: "Pick up where you left off.",
            emoji: "📚",
        },
    ],
};
const evening = {
    key: "evening",
    phrases: [
        {
            headline: "Good evening, {name}",
            subline: "Wind down with a quick review session.",
            emoji: "🌆",
        },
        {
            headline: "Evening, {name}",
            subline: "A few flashcards now and you'll thank yourself tomorrow.",
            emoji: "🌇",
        },
    ],
};
const night = {
    key: "night",
    phrases: [
        {
            headline: "Good night, {name}",
            subline: "Studying late? Keep it short and kind to your brain.",
            emoji: "🌙",
        },
        {
            headline: "Burning the midnight oil, {name}?",
            subline: "Ten focused minutes beats an hour of scrolling.",
            emoji: "🕯️",
        },
    ],
};
const lateNight = {
    key: "late-night",
    phrases: [
        {
            headline: "Still up, {name}?",
            subline: "Sleep is a study tool too — finish strong and rest.",
            emoji: "🦉",
        },
        {
            headline: "The quiet hours, {name}",
            subline: "Capture one thought, then call it a night.",
            emoji: "✨",
        },
    ],
};
/* ---------- day-of-week vibes ------------------------------------ */
const fridayAfternoon = {
    key: "friday-afternoon",
    phrases: [
        {
            headline: "Almost the weekend, {name}",
            subline: "One last push — future-you will be grateful.",
            emoji: "🎉",
        },
    ],
};
const sundayEvening = {
    key: "sunday-evening",
    phrases: [
        {
            headline: "Sunday reset, {name}",
            subline: "Plan the week and breathe — Monday will be kind.",
            emoji: "🗓️",
        },
    ],
};
const mondayMorning = {
    key: "monday-morning",
    phrases: [
        {
            headline: "Happy Monday, {name}",
            subline: "Fresh week, fresh notes. Let's go.",
            emoji: "🚀",
        },
    ],
};
function isNthWeekday(d, month, weekday, n) {
    if (d.getMonth() !== month)
        return false;
    if (d.getDay() !== weekday)
        return false;
    return Math.ceil(d.getDate() / 7) === n;
}
function isLastWeekday(d, month, weekday) {
    if (d.getMonth() !== month)
        return false;
    if (d.getDay() !== weekday)
        return false;
    const next = new Date(d);
    next.setDate(d.getDate() + 7);
    return next.getMonth() !== month;
}
const holidays = [
    {
        bucket: {
            key: "new-years",
            phrases: [
                {
                    headline: "Happy New Year, {name}",
                    subline: "A clean slate — what's the first thing you want to learn?",
                    emoji: "🎆",
                },
            ],
        },
        match: (d) => d.getMonth() === 0 && d.getDate() === 1,
    },
    {
        bucket: {
            key: "new-years-eve",
            phrases: [
                {
                    headline: "Last day of the year, {name}",
                    subline: "Wrap up loose ends, then go celebrate.",
                    emoji: "🥂",
                },
            ],
        },
        match: (d) => d.getMonth() === 11 && d.getDate() === 31,
    },
    {
        bucket: {
            key: "valentines",
            phrases: [
                {
                    headline: "Happy Valentine's Day, {name}",
                    subline: "Show your notes a little love today.",
                    emoji: "💖",
                },
            ],
        },
        match: (d) => d.getMonth() === 1 && d.getDate() === 14,
    },
    {
        bucket: {
            key: "st-patricks",
            phrases: [
                {
                    headline: "Happy St. Patrick's Day, {name}",
                    subline: "Lucky for you, knowledge compounds.",
                    emoji: "🍀",
                },
            ],
        },
        match: (d) => d.getMonth() === 2 && d.getDate() === 17,
    },
    {
        bucket: {
            key: "halloween",
            phrases: [
                {
                    headline: "Happy Halloween, {name}",
                    subline: "The only thing that should haunt you is unfinished flashcards.",
                    emoji: "🎃",
                },
            ],
        },
        match: (d) => d.getMonth() === 9 && d.getDate() === 31,
    },
    {
        bucket: {
            key: "thanksgiving",
            phrases: [
                {
                    headline: "Happy Thanksgiving, {name}",
                    subline: "Grateful for every page you've filled.",
                    emoji: "🦃",
                },
            ],
        },
        // 4th Thursday of November.
        match: (d) => isNthWeekday(d, 10, 4, 4),
    },
    {
        bucket: {
            key: "christmas-eve",
            phrases: [
                {
                    headline: "Christmas Eve, {name}",
                    subline: "Take it easy — magic is in the small moments.",
                    emoji: "🎄",
                },
            ],
        },
        match: (d) => d.getMonth() === 11 && d.getDate() === 24,
    },
    {
        bucket: {
            key: "christmas",
            phrases: [
                {
                    headline: "Merry Christmas, {name}",
                    subline: "Hope today is warm, bright, and unhurried.",
                    emoji: "🎁",
                },
            ],
        },
        match: (d) => d.getMonth() === 11 && d.getDate() === 25,
    },
    {
        bucket: {
            key: "independence-day",
            phrases: [
                {
                    headline: "Happy Fourth of July, {name}",
                    subline: "Take the day off — your notes will keep.",
                    emoji: "🎆",
                },
            ],
        },
        match: (d) => d.getMonth() === 6 && d.getDate() === 4,
    },
    {
        bucket: {
            key: "memorial-day",
            phrases: [
                {
                    headline: "Memorial Day, {name}",
                    subline: "A quiet moment of reflection before we begin.",
                    emoji: "🇺🇸",
                },
            ],
        },
        // last Monday of May.
        match: (d) => isLastWeekday(d, 4, 1),
    },
    {
        bucket: {
            key: "labor-day",
            phrases: [
                {
                    headline: "Happy Labor Day, {name}",
                    subline: "You've earned a slow morning.",
                    emoji: "🛠️",
                },
            ],
        },
        // 1st Monday of September.
        match: (d) => isNthWeekday(d, 8, 1, 1),
    },
];
/* ---------- selection ------------------------------------------- */
function timeOfDayBucket(d) {
    const h = d.getHours();
    if (h >= 0 && h < 4)
        return lateNight;
    if (h >= 4 && h < 7)
        return earlyMorning;
    if (h >= 7 && h < 11)
        return morning;
    if (h >= 11 && h < 14)
        return midday;
    if (h >= 14 && h < 17)
        return afternoon;
    if (h >= 17 && h < 21)
        return evening;
    return night;
}
function dayOfWeekBucket(d) {
    const day = d.getDay();
    const h = d.getHours();
    if (day === 5 && h >= 14 && h < 18)
        return fridayAfternoon;
    if (day === 0 && h >= 17 && h < 22)
        return sundayEvening;
    if (day === 1 && h >= 6 && h < 11)
        return mondayMorning;
    return null;
}
function activeHoliday(d) {
    for (const h of holidays) {
        if (h.match(d))
            return h.bucket;
    }
    return null;
}
function pickBucket(d) {
    return activeHoliday(d) ?? dayOfWeekBucket(d) ?? timeOfDayBucket(d);
}
/** djb2 hash — stable across browsers without pulling crypto. */
function stableHash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++)
        h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
}
function interpolate(template, name) {
    if (!name) {
        // Drop a leading ", {name}" or " {name}" and tidy punctuation.
        return template
            .replace(/,?\s*\{name\}\??/g, (m) => (m.endsWith("?") ? "?" : ""))
            .replace(/\s+([?.!])/g, "$1")
            .trim();
    }
    return template.replace(/\{name\}/g, name);
}
export function getGreeting(name, now = new Date()) {
    const bucket = pickBucket(now);
    const seed = `${now.toDateString()}::${bucket.key}`;
    const phrase = bucket.phrases[stableHash(seed) % bucket.phrases.length];
    return {
        headline: interpolate(phrase.headline, name),
        subline: phrase.subline,
        emoji: phrase.emoji,
        bucket: bucket.key,
    };
}
//# sourceMappingURL=greeting.js.map