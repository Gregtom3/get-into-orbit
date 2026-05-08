/**
 * Touch + mouse input. Pills (throttle, gimbal, stage, reset, prograde,
 * retrograde, recenter, follow, help, quit) plus camera gestures (single-
 * finger pan in empty space, two-finger pinch, mouse wheel zoom).
 *
 * All controls report into a shared `InputState` that the game loop reads.
 * Camera-gesture deltas are pushed to a callback supplied by main.ts.
 */

import type { HeadingMode } from "./autopilot";

export interface InputState {
  throttle: number; // 0..1
  gimbal: number; // -1..1 (left/right)
  stagePressed: boolean;
  resetPressed: boolean;
  recenterPressed: boolean;
  followTogglePressed: boolean;
  helpPressed: boolean;
  quitPressed: boolean;
  headingMode: HeadingMode;
}

interface PillRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CameraIntent {
  panPx?: { dx: number; dy: number };
  zoomFactor?: number;
  zoomAnchor?: { x: number; y: number };
}

type PointerKind = "throttle" | "gimbal" | "pan" | null;

interface PointerEntry {
  kind: PointerKind;
  x: number;
  y: number;
}

export class Input {
  state: InputState = {
    throttle: 0,
    gimbal: 0,
    stagePressed: false,
    resetPressed: false,
    recenterPressed: false,
    followTogglePressed: false,
    helpPressed: false,
    quitPressed: false,
    headingMode: "manual",
  };

  /** Set by main.ts to receive camera intents (pan/zoom). */
  onCamera: ((intent: CameraIntent) => void) | null = null;

  private rects: Record<string, PillRect> = {};
  private active = new Map<number, PointerEntry>();

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("pointerleave", this.onUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this.onKey);
      window.addEventListener("keyup", this.onKeyUp);
    }
  }

  layout(vw: number, vh: number) {
    const pad = 12;
    const isNarrow = vw < 480;
    // Bigger throttle (more tactile, easier to drag with thumb).
    const throttleW = isNarrow ? 70 : 96;
    const throttleH = Math.min(vh * 0.5, 260);
    const gimbalH = isNarrow ? 64 : 72;

    this.rects.throttle = { x: pad, y: vh - throttleH - pad, w: throttleW, h: throttleH };

    // Stage centered. Gimbal sits on the right but is sized so it never crosses
    // into the stage button's footprint (was a layout bug on iphone-se).
    const sw = isNarrow ? 70 : 90;
    const stageX = vw / 2 - sw / 2;
    this.rects.stage = { x: stageX, y: vh - gimbalH - pad, w: sw, h: gimbalH };

    const gimbalRight = vw - pad;
    const gimbalLeftLimit = stageX + sw + 8;
    const maxGimbalW = gimbalRight - gimbalLeftLimit;
    const gimbalW = Math.max(110, Math.min(maxGimbalW, 320));
    this.rects.gimbal = {
      x: gimbalRight - gimbalW,
      y: vh - gimbalH - pad,
      w: gimbalW,
      h: gimbalH,
    };

    // Top bar pills (left to right): QUIT, ?HELP, FOLLOW, recenter target, RESET
    const topW = isNarrow ? 60 : 72;
    const topH = 40;
    const gap = 6;
    let tx = pad;
    this.rects.quit = { x: tx, y: pad, w: topW, h: topH };
    tx += topW + gap;
    this.rects.help = { x: tx, y: pad, w: topH, h: topH };
    // FOLLOW + RECENTER + RESET right-aligned.
    let rx = vw - pad;
    rx -= topW;
    this.rects.reset = { x: rx, y: pad, w: topW, h: topH };
    rx -= topH + gap;
    this.rects.recenter = { x: rx, y: pad, w: topH, h: topH };
    rx -= topW + gap;
    this.rects.follow = { x: rx, y: pad, w: topW, h: topH };

    // PRO/RET locks above gimbal.
    const lockW = isNarrow ? 64 : 72;
    const lockH = 44;
    this.rects.prograde = {
      x: vw - lockW * 2 - 8 - pad,
      y: this.rects.gimbal.y - lockH - 8,
      w: lockW,
      h: lockH,
    };
    this.rects.retrograde = {
      x: vw - lockW - pad,
      y: this.rects.gimbal.y - lockH - 8,
      w: lockW,
      h: lockH,
    };
  }

  layoutRects() {
    return this.rects as Readonly<Record<string, PillRect>>;
  }

  consumeEdges() {
    const out = {
      stage: this.state.stagePressed,
      reset: this.state.resetPressed,
      recenter: this.state.recenterPressed,
      followToggle: this.state.followTogglePressed,
      help: this.state.helpPressed,
      quit: this.state.quitPressed,
    };
    this.state.stagePressed = false;
    this.state.resetPressed = false;
    this.state.recenterPressed = false;
    this.state.followTogglePressed = false;
    this.state.helpPressed = false;
    this.state.quitPressed = false;
    return out;
  }

  private hit(rect: PillRect, x: number, y: number): boolean {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  private clientToCss(e: PointerEvent | WheelEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private setThrottleFromY(y: number) {
    const r = this.rects.throttle;
    if (!r) return;
    const t = 1 - (y - r.y) / r.h;
    this.state.throttle = Math.max(0, Math.min(1, t));
  }

  private setGimbalFromX(x: number) {
    const r = this.rects.gimbal;
    if (!r) return;
    const center = r.x + r.w / 2;
    const half = r.w / 2;
    const g = (x - center) / half;
    this.state.gimbal = Math.max(-1, Math.min(1, g));
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    (this.canvas as Element).setPointerCapture?.(e.pointerId);
    const { x, y } = this.clientToCss(e);
    const r = this.rects;

    // Discrete buttons.
    if (r.stage && this.hit(r.stage, x, y)) return void (this.state.stagePressed = true);
    if (r.reset && this.hit(r.reset, x, y)) return void (this.state.resetPressed = true);
    if (r.recenter && this.hit(r.recenter, x, y))
      return void (this.state.recenterPressed = true);
    if (r.follow && this.hit(r.follow, x, y))
      return void (this.state.followTogglePressed = true);
    if (r.help && this.hit(r.help, x, y)) return void (this.state.helpPressed = true);
    if (r.quit && this.hit(r.quit, x, y)) return void (this.state.quitPressed = true);
    if (r.prograde && this.hit(r.prograde, x, y)) {
      this.state.headingMode = this.state.headingMode === "prograde" ? "manual" : "prograde";
      return;
    }
    if (r.retrograde && this.hit(r.retrograde, x, y)) {
      this.state.headingMode =
        this.state.headingMode === "retrograde" ? "manual" : "retrograde";
      return;
    }

    // Sliders.
    if (r.throttle && this.hit(r.throttle, x, y)) {
      this.active.set(e.pointerId, { kind: "throttle", x, y });
      this.setThrottleFromY(y);
      return;
    }
    if (r.gimbal && this.hit(r.gimbal, x, y)) {
      this.active.set(e.pointerId, { kind: "gimbal", x, y });
      this.setGimbalFromX(x);
      if (this.state.headingMode !== "manual") this.state.headingMode = "manual";
      return;
    }

    // Empty space → pan candidate.
    this.active.set(e.pointerId, { kind: "pan", x, y });
  };

  private onMove = (e: PointerEvent) => {
    const entry = this.active.get(e.pointerId);
    if (!entry) return;
    const { x, y } = this.clientToCss(e);
    const dx = x - entry.x;
    const dy = y - entry.y;
    entry.x = x;
    entry.y = y;

    if (entry.kind === "throttle") {
      this.setThrottleFromY(y);
      return;
    }
    if (entry.kind === "gimbal") {
      this.setGimbalFromX(x);
      if (this.state.headingMode !== "manual") this.state.headingMode = "manual";
      return;
    }
    if (entry.kind !== "pan") return;

    // If two pan-pointers are active, treat as pinch zoom.
    const panPointers = [...this.active.values()].filter((p) => p.kind === "pan");
    if (panPointers.length >= 2) {
      // Compute current and previous separations.
      const a = panPointers[0]!;
      const b = panPointers[1]!;
      const cur = Math.hypot(a.x - b.x, a.y - b.y);
      // Approximate the "previous" separation by undoing the latest delta on this pointer.
      const prevX = entry === a ? a.x - dx : entry === b ? b.x - dx : a.x;
      const prevY = entry === a ? a.y - dy : entry === b ? b.y - dy : a.y;
      const other = entry === a ? b : a;
      const prev = Math.hypot(prevX - other.x, prevY - other.y);
      if (prev > 0 && cur > 0) {
        const factor = prev / cur; // bigger spread → zoom in → factor < 1
        const anchor = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.onCamera?.({ zoomFactor: factor, zoomAnchor: anchor });
      }
      return;
    }

    // Single-finger pan.
    this.onCamera?.({ panPx: { dx, dy } });
  };

  private onUp = (e: PointerEvent) => {
    const entry = this.active.get(e.pointerId);
    this.active.delete(e.pointerId);
    // Gimbal is STICKY: it stays where you put it. Tap the gimbal pill at its
    // exact center to neutral, or use the recenter behavior on touch (handled
    // implicitly — players double-tap the center). Throttle is also sticky.
    void entry;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const { x, y } = this.clientToCss(e);
    // Negative deltaY = scroll up = zoom in.
    const factor = Math.exp(e.deltaY * 0.0015);
    this.onCamera?.({ zoomFactor: factor, zoomAnchor: { x, y } });
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp" || e.key === "w")
      this.state.throttle = Math.min(1, this.state.throttle + 0.1);
    else if (e.key === "ArrowDown" || e.key === "s")
      this.state.throttle = Math.max(0, this.state.throttle - 0.1);
    else if (e.key === "ArrowLeft" || e.key === "a") {
      this.state.gimbal = -1;
      this.state.headingMode = "manual";
    } else if (e.key === "ArrowRight" || e.key === "d") {
      this.state.gimbal = 1;
      this.state.headingMode = "manual";
    } else if (e.key === " ") this.state.stagePressed = true;
    else if (e.key === "r" || e.key === "R") this.state.resetPressed = true;
    else if (e.key === "f" || e.key === "F") this.state.followTogglePressed = true;
    else if (e.key === "c" || e.key === "C") this.state.recenterPressed = true;
    else if (e.key === "?" || e.key === "/" || e.key === "h" || e.key === "H")
      this.state.helpPressed = true;
    else if (e.key === "q" || e.key === "Q" || e.key === "Escape")
      this.state.quitPressed = true;
    else if (e.key === "p" || e.key === "P")
      this.state.headingMode = this.state.headingMode === "prograde" ? "manual" : "prograde";
    else if (e.key === "o" || e.key === "O")
      this.state.headingMode = this.state.headingMode === "retrograde" ? "manual" : "retrograde";
    else if (e.key === "+" || e.key === "=")
      this.onCamera?.({ zoomFactor: 0.9, zoomAnchor: { x: 0, y: 0 } });
    else if (e.key === "-" || e.key === "_")
      this.onCamera?.({ zoomFactor: 1.1, zoomAnchor: { x: 0, y: 0 } });
  };

  private onKeyUp = (_e: KeyboardEvent) => {
    // Sticky gimbal: keys release without resetting. Use Q/Esc to neutral
    // via a quit, or tap the gimbal pill at center to zero it manually.
  };
}
