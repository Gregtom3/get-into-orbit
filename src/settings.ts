/**
 * Persistent settings stored in localStorage. Pure module — UI lives elsewhere.
 */

export interface Settings {
  audioOn: boolean;
  volume: number; // 0..1
  /** Gimbal slew rate multiplier 0.5..2 (sensitivity). */
  sensitivity: number;
}

const KEY = "apoapsis.settings.v1";

const DEFAULTS: Settings = {
  audioOn: true,
  volume: 0.6,
  sensitivity: 1,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors (private mode, quota)
  }
}

export const settings: Settings = load();

export function updateSettings(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  save();
}
