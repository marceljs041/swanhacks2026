import type { FC } from "react";
import { useEffect, useState } from "react";
import { listDueFlashcards, listFlashcardSets } from "../db/repositories.js";
import type { FlashcardSetRow } from "@studynest/shared";
import { useApp } from "../store.js";
import { Card } from "./ui/Card.js";
import { Donut } from "./ui/ProgressRing.js";
import { Placeholder } from "./ui/Placeholder.js";
import { ArrowRightIcon, FlashcardIcon, SearchIcon } from "./icons.js";

export const FlashcardsHub: FC = () => {
  const setView = useApp((s) => s.setView);
  const dueCards = useApp((s) => s.dueCards);
  const setDueCards = useApp((s) => s.setDueCards);
  const [sets, setSets] = useState<FlashcardSetRow[]>([]);

  useEffect(() => {
    void (async () => {
      setSets(await listFlashcardSets(null));
      setDueCards(await listDueFlashcards(50));
    })();
  }, [setDueCards]);

  return (
    <main className="main">
      <div className="topbar">
        <label className="search">
          <span className="search-icon"><SearchIcon size={16} /></span>
          <input type="search" placeholder="Search flashcard decks..." aria-label="Search flashcards" />
        </label>
      </div>
      <div className="main-inner">
        <div className="page-header">
          <h1>Flashcards</h1>
          <span className="pill">{sets.length} decks</span>
          <span className="spacer" />
        </div>

        <div className="dash-row cols-2">
          <Card title="Cards Due Today" icon={<FlashcardIcon size={18} />}>
            <div className="donut-card">
              <Donut
                segments={[
                  { value: dueCards.length || 1, color: "var(--color-primary)" },
                  { value: Math.max(50 - dueCards.length, 0), color: "var(--color-surfaceMuted)" },
                ]}
                size={104}
                thickness={12}
              >
                <span className="donut-num">{dueCards.length}</span>
                <span className="donut-unit">due</span>
              </Donut>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                <span style={{ color: "var(--color-textMuted)" }}>
                  Practising due cards keeps long-term retention near 90%.
                </span>
                <button
                  type="button"
                  className="review-button"
                  disabled={dueCards.length === 0}
                  onClick={() => {
                    const first = dueCards[0];
                    if (first) setView({ kind: "flashcardSet", setId: first.set_id });
                  }}
                >
                  Start review
                </button>
              </div>
            </div>
          </Card>

          <Card title="Spaced Repetition Settings">
            <Placeholder
              title="Custom intervals not yet implemented"
              description="You'll soon be able to tune ease, max interval, and daily new-card limits per deck."
            />
          </Card>
        </div>

        <Card title="Your Decks" action="more">
          {sets.length === 0 ? (
            <Placeholder
              icon={<FlashcardIcon size={22} />}
              title="No decks yet"
              description="Open any note and tap “Generate flashcards” to create your first deck."
            />
          ) : (
            <div className="recent-notes">
              {sets.map((s) => (
                <div
                  key={s.id}
                  className="recent-row"
                  style={{ gridTemplateColumns: "18px 1fr auto" }}
                  onClick={() => setView({ kind: "flashcardSet", setId: s.id })}
                >
                  <FlashcardIcon size={14} />
                  <span className="recent-title">{s.title}</span>
                  <span className="recent-when">
                    Review <ArrowRightIcon size={11} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
};
