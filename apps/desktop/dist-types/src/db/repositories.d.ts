/**
 * CRUD repositories. All writes are wrapped in a transaction that also
 * inserts a sync_outbox row, so every change is durable AND replayable
 * to the cloud.
 *
 * Pass `{ skipOutbox: true }` only when applying a row that came FROM the
 * cloud (during sync pull) — otherwise we'd echo the change back.
 */
import { type AttachmentRow, type ClassRow, type FlashcardRow, type FlashcardSetRow, type NoteRow, type QuizAttemptRow, type QuizQuestionRow, type QuizRow, type QuizSessionRow, type StudyPlanRow, type StudyTaskRow, type RewardPointsEventRow, type SyncOutboxRow } from "@studynest/shared";
interface WriteOpts {
    skipOutbox?: boolean;
}
export declare function listClasses(): Promise<ClassRow[]>;
/**
 * Soft-delete a class. Notes that reference it keep their `class_id`
 * pointer (filtered out by `deleted_at` joins); we leave that decision
 * to the caller because in practice users may want to re-create the
 * class with the same id, or move notes elsewhere first.
 */
export declare function softDeleteClass(id: string): Promise<void>;
/**
 * Archive (deactivate) a class — hidden from active lists; notes keep class_id.
 */
export declare function archiveClass(id: string): Promise<void>;
/**
 * Per-class aggregates used by the Classes page. Returns a record keyed
 * by `class_id` with note / flashcard / quiz totals computed in a single
 * query each (and joined together client-side). Flashcards and quizzes
 * are reachable from a class via their parent note.
 */
export interface ClassAggregate {
    notes: number;
    flashcards: number;
    quizzes: number;
    /** Total scheduled study tasks tied to the class via plan or note. */
    totalTasks: number;
    /** Tasks already completed within `totalTasks`. Drives progress bar. */
    completedTasks: number;
}
export declare function classAggregates(): Promise<Map<string, ClassAggregate>>;
/**
 * Next non-completed study task per class — used by the class card
 * "Next: …" footer. Tasks are matched via plan or note class.
 */
export declare function nextTaskByClass(): Promise<Map<string, StudyTaskRow>>;
/**
 * Days-until-next-exam per class. We treat any study_task whose title
 * mentions "exam" / "midterm" / "final" as an exam, and also fall back
 * to study_plans.exam_date when no explicit task exists.
 */
export declare function nextExamByClass(): Promise<Map<string, {
    iso: string;
    days: number;
}>>;
/**
 * "Weak topic" candidates for a class — flashcard fronts the user has
 * recently rated `hard`. We trim to the first short clause so the chip
 * stays readable.
 */
export declare function weakTopicsForClass(classId: string, limit?: number): Promise<string[]>;
/**
 * Flashcard sets that belong to *any* note in `classId`. Reused by the
 * class view's Flashcards tab to render decks the user can drop into.
 */
export declare function flashcardSetsForClass(classId: string): Promise<FlashcardSetRow[]>;
/** Quizzes whose parent note belongs to `classId`. */
export declare function quizzesForClass(classId: string): Promise<QuizRow[]>;
/**
 * Study tasks scoped to `classId`. A task counts when EITHER its parent
 * plan OR its parent note resolves to the class — same join used by
 * `classAggregates`. Optionally filter by an inclusive ISO date range.
 */
export declare function tasksForClass(classId: string, fromIso?: string, toIso?: string): Promise<StudyTaskRow[]>;
/**
 * Class-scoped quiz stats. Same shape as `quizStats` but only counts
 * attempts against quizzes whose note belongs to `classId`.
 */
export declare function quizStatsForClass(classId: string): Promise<QuizStats>;
export interface ClassActivityDay {
    /** Local-date ISO `YYYY-MM-DD`, oldest → newest. */
    date: string;
    /** Notes touched (created or edited) on this day. */
    notesUpdated: number;
    /** Flashcards reviewed (had `last_reviewed_at` set) this day. */
    flashcardsReviewed: number;
    /** Quiz attempts recorded this day. */
    quizAttempts: number;
    /** Convenience sum used by the bar chart. */
    total: number;
}
/**
 * 7-day activity histogram for a single class. Drives the "Class
 * Activity" bar chart in the class view. We compute one day at a time
 * client-side instead of grouping in SQL because there are at most
 * seven buckets and the joins keep readability higher.
 */
export declare function classActivityWeek(classId: string): Promise<ClassActivityDay[]>;
export declare function upsertClass(input: Partial<ClassRow> & {
    name: string;
}, opts?: WriteOpts): Promise<ClassRow>;
export declare function listNotes(classId?: string | null): Promise<NoteRow[]>;
export declare function getNote(id: string): Promise<NoteRow | null>;
export declare function upsertNote(input: Partial<NoteRow> & {
    title: string;
}, opts?: WriteOpts): Promise<NoteRow>;
export declare function softDeleteNote(id: string): Promise<void>;
/**
 * Counts of notes updated at or after `iso`. Used for the "This Week"
 * smart collection — `iso` is typically `now - 7d` truncated to midnight.
 */
export declare function notesUpdatedSince(iso: string): Promise<number>;
/**
 * Counts notes whose JSON tag array contains `tag` (case-insensitive
 * substring match — `tags_json` is a tiny TEXT blob, fine for hundreds
 * of notes). Powers the "Exam Prep" chip.
 */
export declare function notesByTagLike(tag: string): Promise<number>;
/**
 * Counts distinct notes that have at least one non-deleted attachment of
 * the given type. Drives the "Audio Notes" / "Board Scans" chips.
 */
export declare function notesWithAttachmentType(type: AttachmentRow["type"]): Promise<number>;
/**
 * Notes whose `updated_at` is older than `iso`. Stand-in for "Needs
 * Review" until we record an explicit "last opened" timestamp.
 */
export declare function notesNotOpenedSince(iso: string): Promise<number>;
/**
 * Recent notes that have neither a flashcard set nor a quiz attached.
 * Drives the "needs study tools" tile and seeds the AI Ready Queue.
 */
export declare function notesMissingStudyTools(limit?: number): Promise<NoteRow[]>;
/**
 * Notes whose AI summary hasn't been generated yet but which have
 * enough body to make summarisation worthwhile. Powers the "Summarize"
 * action in the AI Ready Queue.
 */
export declare function notesNeedingSummary(limit?: number): Promise<NoteRow[]>;
/**
 * Audio attachments whose transcript hasn't been generated yet — the
 * "needs transcription" tile counts these.
 */
export declare function audioAttachmentsMissingTranscript(): Promise<number>;
/**
 * Notes (distinct entity_ids) with pending writes in the sync outbox.
 * Drives the "unsynced changes" tile.
 */
export declare function unsyncedNotesCount(): Promise<number>;
/**
 * Cloud sync progress for the sidebar: combine pull cursor, last successful
 * upload, and outbox backpressure. `lastActivityAt` is the more recent of pull
 * vs push so “just now” reflects a real round-trip, not only an empty pull.
 *
 * Also includes the most recent outbox error so the UI can show why uploads
 * are stuck instead of just a count.
 */
export declare function getCloudSyncMeta(): Promise<{
    lastPulledAt: string | null;
    lastPushedAt: string | null;
    lastActivityAt: string | null;
    pendingOutbox: number;
    lastOutboxError: {
        entity_type: string;
        reason: string;
    } | null;
}>;
/** Outbox rows that have failed at least once; surfaced in Settings/diagnostics. */
export declare function listOutboxErrors(limit?: number): Promise<Array<{
    id: string;
    entity_type: string;
    entity_id: string;
    retry_count: number;
    last_error: string;
    created_at: string;
}>>;
/**
 * Existence checks for the AI Ready Queue heuristic — lets the UI pick
 * the next-best AI action per note (summarise → flashcards → quiz).
 */
export declare function noteHasFlashcards(noteId: string): Promise<boolean>;
export declare function noteHasQuiz(noteId: string): Promise<boolean>;
/**
 * Lightweight LIKE search across note title + body. Good enough for the
 * home hero typeahead — we keep it bounded so a long-running query never
 * blocks paint.
 */
export declare function searchNotes(query: string, limit?: number): Promise<NoteRow[]>;
/**
 * Per-note attachment summary used by the "All Notes" table — returns one
 * row per note that has at least one non-deleted attachment, with counts
 * keyed by attachment type.
 */
export declare function attachmentCountsByNote(): Promise<Map<string, {
    audio: number;
    image: number;
    pdf: number;
    file: number;
    total: number;
}>>;
/**
 * Set of note ids that currently have unsynced writes pending in the
 * outbox. Drives the per-row "sync status" pill on the All Notes page.
 */
export declare function unsyncedNoteIds(): Promise<Set<string>>;
/**
 * Set of note ids that have at least one flashcard set OR quiz attached.
 * Used to flag rows as "Ready" in the AI status column.
 */
export declare function noteIdsWithStudyTools(): Promise<Set<string>>;
export declare function upsertAttachment(input: Partial<AttachmentRow> & {
    note_id: string;
    type: AttachmentRow["type"];
    local_uri: string;
}, opts?: WriteOpts): Promise<AttachmentRow>;
export declare function upsertFlashcardSet(input: Partial<FlashcardSetRow> & {
    title: string;
}, opts?: WriteOpts): Promise<FlashcardSetRow>;
export declare function upsertFlashcard(input: Partial<FlashcardRow> & {
    set_id: string;
    front: string;
    back: string;
}, opts?: WriteOpts): Promise<FlashcardRow>;
export declare function listFlashcardSets(noteId?: string | null): Promise<FlashcardSetRow[]>;
export declare function listFlashcards(setId: string): Promise<FlashcardRow[]>;
export declare function listDueFlashcards(limit?: number): Promise<FlashcardRow[]>;
/**
 * Mastery / weakness thresholds reused across hub stats, deck cards,
 * and the deck-detail rail. Tuned to feel right with the SM-2-ish
 * scheduler in `Flashcards.tsx`: a card that's been pushed out three
 * weeks counts as "mastered", and any card the user explicitly rated
 * `hard` is "weak" until it's promoted again.
 */
export declare const FC_MASTERED_INTERVAL_DAYS = 21;
export interface DeckStats {
    total: number;
    due: number;
    mastered: number;
    weak: number;
    /** Mastery as a 0..1 ratio of mastered cards over total. */
    mastery_pct: number;
}
/** Per-deck rollup used by the deck grid + deck-detail rail. */
export declare function deckStats(setId: string): Promise<DeckStats>;
export interface FlashcardsHubStats {
    dueToday: number;
    totalDecks: number;
    mastered: number;
    studyStreakDays: number;
}
/**
 * Aggregate stats for the four hero tiles on the Flashcards hub. Done in
 * a single round-trip so the hub paint doesn't wait on N small queries.
 */
export declare function flashcardsHubStats(): Promise<FlashcardsHubStats>;
export interface DeckSummary {
    set: FlashcardSetRow;
    /** Parent note when present; null for orphan decks. */
    note: NoteRow | null;
    /** Class id resolved from the parent note, when one exists. */
    classId: string | null;
    stats: DeckStats;
    /** ISO of the next future `due_at` after now. Null when nothing scheduled. */
    nextDueAt: string | null;
}
/**
 * One row per non-deleted deck, joined with its parent note + class id
 * and a precomputed stats blob. Drives the hub deck grid and the
 * deck-detail rail's class header.
 */
export declare function listDeckSummaries(): Promise<DeckSummary[]>;
export type ReviewMode = "due" | "cram" | "weak" | "audio";
/**
 * Cards filtered by review mode for the active deck:
 *  - `due`   — only cards whose `due_at` is now-or-earlier (SM-2 schedule).
 *  - `cram`  — every card in the deck, scheduling ignored. Order by
 *              creation so a fresh review doesn't surprise the user.
 *  - `weak`  — anything currently rated `hard`, regardless of schedule.
 *  - `audio` — same set as `due`; the review screen layers on speech.
 */
export declare function listFlashcardsByMode(setId: string, mode: ReviewMode): Promise<FlashcardRow[]>;
/**
 * Mark a single card "weak" so it surfaces in the Weak Cards deck. We
 * also reset `due_at` to now so the next due-cycle picks it up.
 */
export declare function markCardForReview(cardId: string): Promise<void>;
/** Earliest future due timestamp for a deck, or null when nothing scheduled. */
export declare function nextReviewDateForDeck(setId: string): Promise<string | null>;
/**
 * Decks topically similar to the given card. We tokenize the card's
 * front into 4+ char keywords and rank other (non-deleted) decks by how
 * many of those tokens appear in any of their cards. Cheap O(N×k) scan
 * over typically <100 decks — fine for the side rail.
 */
export declare function relatedDecksForCard(cardId: string, limit?: number): Promise<DeckSummary[]>;
/**
 * Decks whose newest review is older than `cutoffIso`. Drives the
 * "Decks not reviewed in 5+ days" row in the Needs Attention card.
 */
export declare function decksNotReviewedSince(cutoffIso: string): Promise<number>;
/**
 * Decks whose parent note doesn't yet have any quiz attached. Powers
 * the "Decks ready for quiz generation" row in Needs Attention.
 */
export declare function decksMissingQuiz(): Promise<number>;
/** Count of all currently weak (hard-rated) cards across every deck. */
export declare function totalWeakCards(): Promise<number>;
export declare function upsertQuiz(input: Partial<QuizRow> & {
    title: string;
}, opts?: WriteOpts): Promise<QuizRow>;
export declare function upsertQuizQuestion(input: Partial<QuizQuestionRow> & {
    quiz_id: string;
    type: QuizQuestionRow["type"];
    question: string;
    correct_answer: string;
}, opts?: WriteOpts): Promise<QuizQuestionRow>;
export declare function softDeleteQuiz(id: string): Promise<void>;
export declare function listQuizzes(noteId?: string | null): Promise<QuizRow[]>;
export declare function getQuiz(id: string): Promise<QuizRow | null>;
export declare function listQuizQuestions(quizId: string): Promise<QuizQuestionRow[]>;
export interface QuizStats {
    taken: number;
    /** Average score as a percentage (0–100), rounded. 0 when there are no attempts. */
    avgPct: number;
    /** Best single-attempt score as a percentage (0–100), rounded. */
    best: number;
}
/**
 * Aggregates over all `quiz_attempts` rows. We average per-attempt
 * percentages so a single 100/100 attempt isn't drowned out by a long
 * 70/100 attempt.
 */
export declare function quizStats(): Promise<QuizStats>;
/** Aggregates for `@studynest/shared` user badges (desktop local DB). */
export interface BadgeProgressMetrics {
    noteCount: number;
    classCount: number;
    quizAttempts: number;
    quizBestPct: number;
    flashcardReviews: number;
    streak: number;
    totalXp: number;
}
export declare function fetchBadgeProgressMetrics(): Promise<BadgeProgressMetrics>;
export interface QuizSummary {
    quiz: QuizRow;
    /** Resolved class — either via `quiz.class_id` directly or via `note.class_id`. */
    classId: string | null;
    /** Note when the quiz is sourced from a single note; null otherwise. */
    noteTitle: string | null;
    questionCount: number;
    attempts: number;
    /** Most recent attempt percentage (0–100), or null if untaken. */
    lastScorePct: number | null;
    /** Best attempt percentage. */
    bestScorePct: number | null;
    /** ISO ts of most recent attempt. */
    lastAttemptAt: string | null;
    /** Effective status — overrides stored `status` based on attempts/sessions. */
    status: "new" | "in_progress" | "completed";
    /** True when the most recent attempt percent < 70. */
    needsReview: boolean;
    /** Pending unsynced writes for this quiz id. */
    unsynced: boolean;
}
/**
 * One row per non-deleted quiz with computed last/best score and a
 * resolved class id. We do the joins in SQL but compute percentages
 * client-side because the existing `quiz_attempts.total` can be 0 for
 * abandoned attempts.
 */
export declare function quizSummaries(): Promise<QuizSummary[]>;
export interface QuizzesHubStats {
    taken: number;
    avgPct: number;
    weakTopicCount: number;
    /** Quiz-typed study tasks scheduled for today. */
    dueToday: number;
}
export declare function quizzesHubStats(): Promise<QuizzesHubStats>;
/** Topic labels surfaced by aggregating recent attempts' weak_topics_json. */
export declare function recentWeakTopics(limit?: number): Promise<string[]>;
export declare function quizAttemptsForQuiz(quizId: string): Promise<QuizAttemptRow[]>;
export interface TopicPerformance {
    topic: string;
    total: number;
    correct: number;
    /** 0–100 rounded. */
    pct: number;
}
/**
 * For the most recent completed attempt on a quiz, group questions by
 * `topic` and report correct / total counts. Used by the results screen.
 */
export declare function topicPerformance(quizId: string, attemptId?: string): Promise<TopicPerformance[]>;
export interface RecordAttemptArgs {
    quiz_id: string;
    score: number;
    total: number;
    answers: Record<string, string>;
    weak_topics: string[];
    started_at: string;
    finished_at: string;
    time_spent_seconds: number;
    completed?: boolean;
}
export declare function recordQuizAttempt(args: RecordAttemptArgs): Promise<QuizAttemptRow>;
export declare function getQuizSession(quizId: string): Promise<QuizSessionRow | null>;
export interface SaveQuizSessionInput {
    quiz_id: string;
    current_index: number;
    answers: Record<string, string>;
    /** Optional explicit start ts when creating a brand-new row. */
    started_at?: string;
}
export declare function saveQuizSession(input: SaveQuizSessionInput, opts?: WriteOpts): Promise<QuizSessionRow>;
export declare function clearQuizSession(quizId: string): Promise<void>;
export declare function upsertStudyPlan(input: Partial<StudyPlanRow> & {
    title: string;
}, opts?: WriteOpts): Promise<StudyPlanRow>;
export declare function upsertStudyTask(input: Partial<StudyTaskRow> & {
    title: string;
    type: StudyTaskRow["type"];
    scheduled_for: string;
}, opts?: WriteOpts): Promise<StudyTaskRow>;
/**
 * Returns scheduled study tasks in `[fromIso, toIso)` from the legacy
 * `study_tasks` table joined with the newer `calendar_events` table,
 * adapted to the same `StudyTaskRow` shape so existing widgets
 * (Home, RightPanel) keep working without modification while we
 * migrate them to read calendar_events directly.
 *
 * Dedup rule: events whose id is `evt_legacy_<x>` were created by
 * `ensureCalendarBackfill` and represent the same entity as the
 * `study_tasks` row with id `<x>`. We hide those mirrors so the user
 * doesn't see double rows. New events created via the Calendar UI
 * (regular `evt_…` ids) flow through as synthetic study tasks.
 */
export declare function listTasksForRange(fromIso: string, toIso: string): Promise<StudyTaskRow[]>;
export declare function recordXp(action: string, points: number): Promise<void>;
export declare function upsertRewardPointsEvent(input: Partial<RewardPointsEventRow> & {
    id: string;
}, opts?: WriteOpts): Promise<RewardPointsEventRow>;
export declare function recordRewardPoints(action: string, points: number): Promise<void>;
export declare function totalXpToday(): Promise<number>;
export declare function totalXp(): Promise<number>;
export declare function totalRewardPoints(): Promise<number>;
export declare function spendRewardPoints(action: string, cost: number): Promise<boolean>;
export declare function goatUpgradePurchases(): Promise<Set<string>>;
/**
 * Returns daily XP totals for the last `days` days (most recent first).
 * Used by the activity heatmap so we don't ship the full event log.
 */
export declare function xpByDay(days: number): Promise<Array<{
    date: string;
    points: number;
}>>;
export declare function currentStreak(): Promise<number>;
export declare function listOutbox(limit: number): Promise<SyncOutboxRow[]>;
export declare function markOutboxSynced(ids: string[]): Promise<void>;
export declare function recordOutboxFailure(id: string, error: string): Promise<void>;
/**
 * Clears `last_error` and resets `retry_count` so failed rows are retried as
 * if fresh — useful after the cloud schema is fixed and we want sync to
 * re-attempt previously stuck pushes immediately.
 */
export declare function resetOutboxErrors(): Promise<number>;
/**
 * Re-enqueues every existing local row into `sync_outbox` so the next push
 * uploads them. Used when the outbox got out of sync with reality (e.g. rows
 * created via `skipOutbox`, dev tooling, or a previous app version that
 * marked things synced incorrectly).
 *
 * Strategy: delete any pending (un-synced) outbox row whose `(entity_type,
 * entity_id)` matches a live local row, then insert a fresh "upsert"
 * envelope per live row. Already-synced outbox history is left intact.
 */
export declare function reenqueueAllLocalRows(): Promise<number>;
export {};
//# sourceMappingURL=repositories.d.ts.map