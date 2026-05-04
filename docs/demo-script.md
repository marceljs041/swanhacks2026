# StudyNest demo script

Total runtime: ~5 minutes.

## Setup (before you walk on stage)

1. Make sure the cloud API is running: `pnpm api dev` (or the deployed Supabase + cloud API).
2. Make sure the Gemma 4 E4B snapshot is present at `app-data/models/gemma-4-e4b-it/` (run `pnpm --filter ./apps/desktop fetch-model` once; requires `HF_TOKEN` for gated weights).
3. Run `STUDYNEST_USER_DATA="$HOME/Library/Application Support/Note Goat" pnpm --filter ./apps/desktop seed` to pre-populate one class, three notes, a flashcard set, a quiz, and a week of study tasks. (On Linux: `~/.config/Note Goat`. On Windows: `%APPDATA%\Note Goat`.)
4. Open the desktop app: `pnpm desktop dev`.
5. Open the mobile app on a phone or simulator: `pnpm mobile dev`.
6. Pair the two devices via Settings → "Generate pairing code" → scan/enter on mobile.

## Live demo

### 1. The hook (30s)

> "Most AI study apps die when the Wi-Fi dies. StudyNest is built for the opposite — it works in class, even when campus Wi-Fi doesn't."

Turn on airplane mode. Show the sync pill flip from `synced` → `offline`. The local AI status pill stays green: `AI ready`.

### 2. Capture (45s — mobile)

On mobile (still offline):
- Tap **Capture → 🎤 Record audio**. Say "Reminder: BST is left smaller, right larger."
- Tap **Capture → 📷 Take photo** of a whiteboard.
- Tap **Capture → 📝 New note**, type "Need to review week 1 lectures."

Three notes appear in **Notes**. Each shows "Local only" on the attachments — they're queued for upload.

### 3. Offline AI (90s — desktop)

Switch to desktop, open `Lecture 1: Requirements engineering`.

- Click **Summarize**. Local Gemma generates a 3-sentence summary in 5–10 seconds. The right panel updates.
- Click **Generate flashcards**. Eight cards land in the flashcard set, all locally.
- Click **Generate quiz**. Five questions appear.

> "Notice — no cloud calls. The model is running on this laptop, in `llama-cpp-python`, with the inference happening on the GPU."

### 4. Study layer (45s)

- Open **Study → Requirements — flashcards**. Flip a card, mark it Easy. The streak ticks.
- Open the seeded quiz. Answer two correctly. Show the score and explanations.
- Open **Calendar**. Show the week. Click "Generate study plan" — Gemma builds a plan from the notes.

### 5. Sync the punchline (45s)

Turn Wi-Fi back on. The sync pill flips: `offline` → `syncing` → `synced`.

Switch to mobile. Pull to refresh. The notes/flashcards/study plan you generated on desktop are now there.

> "The same data, on every device, with AI that works offline first. That's StudyNest."

## Closing line

> "Built for students who study where Wi-Fi can't — libraries, dorms, planes, and a 9am lecture hall in the basement of an engineering building."

## If something breaks

- **Sidecar won't load model**: the AI status pill will say "AI offline". Cloud fallback still answers — fine for the demo.
- **Cloud API unreachable**: sync pill stays `offline`. The demo still works locally; just don't promise the cross-device sync moment.
- **Mobile camera permission denied**: skip the photo capture, do audio + typed notes only.
