import type { FC } from "react";
import { useEffect, useState } from "react";
import { listFlashcards, recordXp, upsertFlashcard } from "../db/repositories.js";
import { useApp } from "../store.js";
import type { Difficulty, FlashcardRow } from "@studynest/shared";
import { XP_RULES, nowIso } from "@studynest/shared";

interface Props {
  setId: string;
}

/**
 * Tiny SM-2-like scheduler. Easy → longer interval, hard → reset to 1 day.
 * Returns the next due_at and updated ease/interval.
 */
function schedule(
  card: FlashcardRow,
  diff: Difficulty,
): Pick<FlashcardRow, "due_at" | "ease" | "interval_days" | "review_count"> {
  const factor = { new: 1, easy: 1.5, medium: 1.0, hard: 0.5 }[diff] ?? 1;
  const ease = Math.max(1.3, card.ease + (diff === "easy" ? 0.1 : diff === "hard" ? -0.2 : 0));
  let interval: number;
  if (diff === "hard") interval = 1;
  else if (card.review_count === 0) interval = diff === "easy" ? 3 : 1;
  else interval = Math.max(1, Math.round((card.interval_days || 1) * ease * factor));
  const next = new Date(Date.now() + interval * 86_400_000);
  return {
    due_at: next.toISOString(),
    ease,
    interval_days: interval,
    review_count: card.review_count + 1,
  };
}

export const Flashcards: FC<Props> = ({ setId }) => {
  const [cards, setCards] = useState<FlashcardRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const setView = useApp((s) => s.setView);
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => {
    void listFlashcards(setId).then((cs) => {
      setCards(cs);
      setIdx(0);
      setFlipped(false);
    });
  }, [setId]);

  const card = cards[idx];

  async function rate(diff: Difficulty): Promise<void> {
    if (!card) return;
    const next = schedule(card, diff);
    await upsertFlashcard({ ...card, difficulty: diff, last_reviewed_at: nowIso(), ...next });
    const newReviewed = reviewed + 1;
    setReviewed(newReviewed);
    if (newReviewed > 0 && newReviewed % 10 === 0) {
      await recordXp("reviewTenCards", XP_RULES.reviewTenCards);
    }
    if (idx + 1 >= cards.length) {
      setView({ kind: "study" });
      return;
    }
    setIdx(idx + 1);
    setFlipped(false);
  }

  if (!card) {
    return <div className="main empty">No cards in this set.</div>;
  }

  return (
    <div className="main">
      <div className="toolbar">
        <button className="ghost" onClick={() => setView({ kind: "study" })}>
          ← Study
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ color: "var(--muted)" }}>
          Card {idx + 1} of {cards.length}
        </span>
      </div>
      <div style={{ padding: 24, maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <div className="flashcard" onClick={() => setFlipped((f) => !f)}>
          <div>{flipped ? card.back : card.front}</div>
        </div>
        {flipped && (
          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
            <button onClick={() => void rate("hard")}>Hard</button>
            <button onClick={() => void rate("medium")}>Medium</button>
            <button onClick={() => void rate("easy")} className="primary">
              Easy
            </button>
          </div>
        )}
        {!flipped && (
          <div style={{ textAlign: "center", marginTop: 16, color: "var(--muted)" }}>
            Click the card to reveal
          </div>
        )}
      </div>
    </div>
  );
};
