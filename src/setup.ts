/**
 * Pre-launch tuning screen. After a level is chosen the player can adjust:
 *   - Fuel %        (0.25 .. 1.5)
 *   - Thrust ×      (0.5 .. 2.0)
 *   - Gravity ×     (0.5 .. 2.0)
 *   - Initial pitch (-45 .. +45 degrees from local vertical, eastward)
 *
 * Returns a tuning object the game loop can apply to the level when launching.
 */

import { COLOR } from "./render";
import type { Level } from "./levels";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Tuning {
  fuelMul: number;
  thrustMul: number;
  gravityMul: number;
  initialPitchDeg: number;
}

export const DEFAULT_TUNING: Tuning = {
  fuelMul: 1,
  thrustMul: 1,
  gravityMul: 1,
  initialPitchDeg: 0,
};

interface SliderSpec {
  key: keyof Tuning;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
}

const SLIDERS: SliderSpec[] = [
  { key: "fuelMul", label: "FUEL", min: 0.25, max: 1.5, step: 0.05, fmt: (v) => `${(v * 100).toFixed(0)}%` },
  { key: "thrustMul", label: "THRUST", min: 0.5, max: 2.0, step: 0.05, fmt: (v) => `${v.toFixed(2)}×` },
  { key: "gravityMul", label: "GRAVITY", min: 0.5, max: 2.0, step: 0.05, fmt: (v) => `${v.toFixed(2)}×` },
  { key: "initialPitchDeg", label: "PITCH", min: -45, max: 45, step: 1, fmt: (v) => `${v.toFixed(0)}°` },
];

export type SetupAction = { kind: "launch" } | { kind: "back" };

export class SetupScreen {
  level: Level | null = null;
  tuning: Tuning = { ...DEFAULT_TUNING };
  private vw = 0;
  private vh = 0;
  private sliders: Array<{ spec: SliderSpec; track: Rect; minus: Rect; plus: Rect }> = [];
  private launchBtn: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private backBtn: Rect = { x: 0, y: 0, w: 0, h: 0 };

  setLevel(level: Level) {
    this.level = level;
    this.tuning = { ...DEFAULT_TUNING };
  }

  layout(vw: number, vh: number) {
    this.vw = vw;
    this.vh = vh;
    const pad = 20;
    const panelW = Math.min(420, vw - pad * 2);
    const px = (vw - panelW) / 2;
    const headerH = 70;
    const sliderH = 56;
    const totalH = headerH + sliderH * SLIDERS.length + 70;
    let py = Math.max(pad, (vh - totalH) / 2);
    this.backBtn = { x: pad, y: pad, w: 70, h: 36 };
    py += headerH;
    this.sliders = SLIDERS.map((spec) => {
      const trackW = panelW - 130;
      const track: Rect = { x: px + 90, y: py + 14, w: trackW, h: 28 };
      const minus: Rect = { x: px + 14, y: py + 10, w: 36, h: 36 };
      const plus: Rect = { x: px + panelW - 50, y: py + 10, w: 36, h: 36 };
      py += sliderH;
      return { spec, track, minus, plus };
    });
    this.launchBtn = { x: px, y: py + 14, w: panelW, h: 56 };
  }

  /** Hit-test; returns an action, or null if it was a slider drag/tap. */
  hit(x: number, y: number): SetupAction | null {
    if (inside(this.backBtn, x, y)) return { kind: "back" };
    if (inside(this.launchBtn, x, y)) return { kind: "launch" };
    for (const s of this.sliders) {
      if (inside(s.minus, x, y)) {
        this.tuning[s.spec.key] = clampStep(
          (this.tuning[s.spec.key] as number) - s.spec.step,
          s.spec.min,
          s.spec.max,
        );
        return null;
      }
      if (inside(s.plus, x, y)) {
        this.tuning[s.spec.key] = clampStep(
          (this.tuning[s.spec.key] as number) + s.spec.step,
          s.spec.min,
          s.spec.max,
        );
        return null;
      }
      if (inside(s.track, x, y)) {
        const t = (x - s.track.x) / s.track.w;
        const v = s.spec.min + t * (s.spec.max - s.spec.min);
        this.tuning[s.spec.key] = clampStep(v, s.spec.min, s.spec.max);
        return null;
      }
    }
    return null;
  }

  /** Continuous drag on a slider track. */
  drag(x: number, y: number) {
    for (const s of this.sliders) {
      if (inside(s.track, x, y)) {
        const t = (x - s.track.x) / s.track.w;
        const v = s.spec.min + t * (s.spec.max - s.spec.min);
        this.tuning[s.spec.key] = clampStep(v, s.spec.min, s.spec.max);
        return;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.vw, this.vh);

    if (!this.level) return;

    // Back button
    ctx.strokeStyle = COLOR.hudDim;
    ctx.lineWidth = 1.5;
    roundRect(ctx, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, 18);
    ctx.stroke();
    ctx.fillStyle = COLOR.hudDim;
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("← BACK", this.backBtn.x + this.backBtn.w / 2, this.backBtn.y + this.backBtn.h / 2);

    const pad = 20;
    const panelW = Math.min(420, this.vw - pad * 2);
    const px = (this.vw - panelW) / 2;
    const py0 = this.sliders[0]?.track.y ? this.sliders[0].track.y - 70 : 100;

    // Title
    ctx.fillStyle = COLOR.hud;
    ctx.textAlign = "center";
    ctx.font = "bold 22px ui-monospace, monospace";
    ctx.fillText(`LAUNCH ${this.level.name}`, this.vw / 2, py0 - 30);
    ctx.fillStyle = COLOR.hudDim;
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillText(this.level.blurb, this.vw / 2, py0 - 6);

    // Sliders
    for (const s of this.sliders) {
      const v = this.tuning[s.spec.key] as number;
      const t = (v - s.spec.min) / (s.spec.max - s.spec.min);
      ctx.textAlign = "left";
      ctx.fillStyle = COLOR.hud;
      ctx.font = "12px ui-monospace, monospace";
      ctx.fillText(s.spec.label, px + 14, s.minus.y - 8);
      ctx.textAlign = "right";
      ctx.fillStyle = COLOR.hud;
      ctx.fillText(s.spec.fmt(v), px + panelW - 14, s.minus.y - 8);

      // Track
      ctx.strokeStyle = COLOR.hudDim;
      ctx.lineWidth = 1.5;
      roundRect(ctx, s.track.x, s.track.y, s.track.w, s.track.h, 14);
      ctx.stroke();
      // Fill
      ctx.fillStyle = "rgba(125,249,255,0.18)";
      const fillW = Math.max(0, t * s.track.w);
      ctx.fillRect(s.track.x + 2, s.track.y + 2, Math.max(0, fillW - 4), s.track.h - 4);
      // Knob
      ctx.fillStyle = COLOR.hud;
      ctx.beginPath();
      ctx.arc(s.track.x + t * s.track.w, s.track.y + s.track.h / 2, 8, 0, Math.PI * 2);
      ctx.fill();

      // +/- buttons
      drawSquareBtn(ctx, s.minus, "−");
      drawSquareBtn(ctx, s.plus, "+");
    }

    // Launch button
    ctx.strokeStyle = COLOR.win;
    ctx.lineWidth = 2;
    roundRect(ctx, this.launchBtn.x, this.launchBtn.y, this.launchBtn.w, this.launchBtn.h, 22);
    ctx.fillStyle = "rgba(184,107,255,0.18)";
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLOR.win;
    ctx.font = "bold 18px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      "▶ LAUNCH",
      this.launchBtn.x + this.launchBtn.w / 2,
      this.launchBtn.y + this.launchBtn.h / 2,
    );
    ctx.textBaseline = "alphabetic";
  }
}

/** Apply tuning to a level, returning a new Level. */
export function applyTuning(level: Level, t: Tuning): Level {
  const planet = { ...level.planet };
  const rocket = { ...level.rocket, pos: { ...level.rocket.pos }, vel: { ...level.rocket.vel } };

  if (t.gravityMul !== 1) planet.mu *= t.gravityMul;
  if (t.thrustMul !== 1) rocket.thrust *= t.thrustMul;
  if (t.fuelMul !== 1) {
    const fuel = (rocket.mass - rocket.dryMass) * t.fuelMul;
    rocket.mass = rocket.dryMass + fuel;
  }
  // Initial pitch: rotate the rocket heading by N degrees off vertical (eastward = positive).
  // Default heading is π/2 (straight up at the launch site on +y axis); pitch eastward
  // means heading angle decreases.
  if (t.initialPitchDeg !== 0) {
    rocket.heading = rocket.heading - (t.initialPitchDeg * Math.PI) / 180;
  }
  return { ...level, planet, rocket };
}

function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function clampStep(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v * 1000) / 1000));
}

function drawSquareBtn(ctx: CanvasRenderingContext2D, r: Rect, label: string) {
  ctx.strokeStyle = COLOR.hud;
  ctx.lineWidth = 1.5;
  roundRect(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.stroke();
  ctx.fillStyle = COLOR.hud;
  ctx.font = "16px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  ctx.textBaseline = "alphabetic";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
