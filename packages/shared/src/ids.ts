/**
 * Crockford-base32 ULID generator (no deps).
 * 26 chars, lexicographically sortable, monotonic per process.
 */
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

let lastTime = 0;
let lastRandom: number[] = [];

function randomChar(): string {
  const r = Math.floor(Math.random() * ENCODING_LEN);
  return ENCODING[r]!;
}

function encodeTime(now: number): string {
  let mod: number;
  let t = now;
  let out = "";
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    mod = t % ENCODING_LEN;
    out = ENCODING[mod] + out;
    t = (t - mod) / ENCODING_LEN;
  }
  return out;
}

function incrementRandom(rand: number[]): number[] {
  const out = rand.slice();
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i]! < ENCODING_LEN - 1) {
      out[i]!++;
      return out;
    }
    out[i] = 0;
  }
  // Overflow — extremely unlikely; reseed.
  return Array.from({ length: RANDOM_LEN }, () =>
    Math.floor(Math.random() * ENCODING_LEN),
  );
}

export function ulid(prefix?: string): string {
  const now = Date.now();
  let rand: number[];
  if (now === lastTime) {
    rand = incrementRandom(lastRandom);
  } else {
    rand = Array.from({ length: RANDOM_LEN }, () =>
      Math.floor(Math.random() * ENCODING_LEN),
    );
    lastTime = now;
  }
  lastRandom = rand;
  const t = encodeTime(now);
  const r = rand.map((n) => ENCODING[n]).join("");
  const id = `${t}${r}`;
  return prefix ? `${prefix}_${id}` : id;
}

export function nowIso(): string {
  return new Date().toISOString();
}
