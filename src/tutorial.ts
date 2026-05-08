/**
 * In-game step-through tutorial. Each step shows a banner with a hint and a
 * dim arrow pointing at the relevant pill. Steps advance when their condition
 * is met by the live game state — so the player learns by doing, not reading.
 *
 * The tutorial fires on the first launch (per-browser localStorage flag).
 * The "?" pill restarts it any time.
 */

import type { InputState } from "./input";
import type { Rocket } from "./physics";
import type { OrbitElements } from "./orbit";

interface StepCtx {
  rocket: Rocket;
  el: OrbitElements;
  altAbove: number;
  input: InputState;
  level: { minPeriAlt: number; maxEcc: number };
}

interface TutorialStep {
  banner: string;
  hint: string;
  /** Optional pill key to point at. */
  pointAt?: string;
  /** Returns true when the step is satisfied; advance to the next. */
  done: (c: StepCtx) => boolean;
}

const STEPS: TutorialStep[] = [
  {
    banner: "WELCOME TO APOAPSIS",
    hint: "Goal: get into orbit. Tap to begin.",
    done: (c) => c.input.throttle > 0 || c.rocket.t > 1.5,
  },
  {
    banner: "STEP 1 — IGNITE",
    hint: "Drag the THROTTLE pill (left) all the way up.",
    pointAt: "throttle",
    done: (c) => c.input.throttle >= 0.9,
  },
  {
    banner: "STEP 2 — PITCH OVER AT 5 KM",
    hint: "When ALT passes 5 km, drag GIMBAL right to tilt east.",
    pointAt: "gimbal",
    done: (c) => c.altAbove >= 5_000 && Math.abs(c.input.gimbal) > 0.1,
  },
  {
    banner: "STEP 3 — BUILD APOAPSIS",
    hint: "Keep burning until APO climbs above the target altitude.",
    done: (c) => c.el.apoapsis - c.altAbove > 0 && c.el.apoapsis - c.rocket.pos.y > c.level.minPeriAlt - 5_000,
  },
  {
    banner: "STEP 4 — LOCK PROGRADE",
    hint: "Tap PRO. The rocket will steer along its velocity automatically.",
    pointAt: "prograde",
    done: (c) => c.input.headingMode === "prograde",
  },
  {
    banner: "STEP 5 — CIRCULARIZE AT APOAPSIS",
    hint: "Coast to APO, then full throttle to raise PER above the threshold.",
    done: (c) => c.el.periapsis > 0 && c.el.e < 0.3,
  },
  {
    banner: "STEP 6 — HOLD",
    hint: "Hold a stable orbit for 4 seconds to win.",
    done: () => false, // ends when game enters WIN state — handled externally
  },
];

const STORE_KEY = "apoapsis.tutorial.v1.done";

export class Tutorial {
  active = false;
  stepIdx = 0;

  /** Auto-start tutorial only on the user's first run. */
  maybeStart() {
    try {
      if (!localStorage.getItem(STORE_KEY)) {
        this.active = true;
        this.stepIdx = 0;
      }
    } catch {
      this.active = true;
      this.stepIdx = 0;
    }
  }

  /** Force-start (called from the ? button). */
  start() {
    this.active = true;
    this.stepIdx = 0;
  }

  finish() {
    this.active = false;
    try {
      localStorage.setItem(STORE_KEY, "1");
    } catch {
      // ignore
    }
  }

  current(): TutorialStep | null {
    if (!this.active) return null;
    return STEPS[this.stepIdx] ?? null;
  }

  /** Advance the tutorial if the current step's done() condition is met. */
  tick(ctx: StepCtx) {
    if (!this.active) return;
    const step = STEPS[this.stepIdx];
    if (!step) {
      this.finish();
      return;
    }
    if (step.done(ctx)) {
      this.stepIdx++;
      if (this.stepIdx >= STEPS.length) this.finish();
    }
  }

  /** Player completes the level — mark tutorial complete. */
  win() {
    this.finish();
  }
}
