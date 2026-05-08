/**
 * Per-level high scores stored in localStorage.
 *
 * Score model: lower is better — measured in seconds-to-orbit, with a tiebreak
 * on fuel remaining (more fuel = better). We store the seconds as the primary
 * metric and the fuel% as secondary so the scoreboard can show both.
 */

export interface ScoreRecord {
  /** Time-to-orbit in seconds (lower is better). */
  seconds: number;
  /** Fuel remaining at win, 0..1 (higher is better). */
  fuelFrac: number;
  /** Eccentricity at win (lower = cleaner orbit). */
  ecc: number;
  /** Wall-clock timestamp (ms since epoch). */
  ts: number;
}

const KEY = "apoapsis.scores.v1";

type Store = Record<string, ScoreRecord>;

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

function save(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function bestScore(levelId: string): ScoreRecord | null {
  const s = load();
  return s[levelId] ?? null;
}

export function allScores(): Store {
  return load();
}

/** Returns true if the new score replaced the old best. */
export function recordScore(levelId: string, score: ScoreRecord): boolean {
  const store = load();
  const prev = store[levelId];
  if (isBetter(score, prev)) {
    store[levelId] = score;
    save(store);
    return true;
  }
  return false;
}

export function isBetter(a: ScoreRecord, b: ScoreRecord | undefined | null): boolean {
  if (!b) return true;
  if (a.seconds < b.seconds - 0.001) return true;
  if (a.seconds > b.seconds + 0.001) return false;
  // tie on time → prefer more fuel
  if (a.fuelFrac > b.fuelFrac + 1e-4) return true;
  return false;
}

export function clearScores() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
