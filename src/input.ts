/**
 * Touch + mouse input. Three pills: throttle (vertical slider, left), gimbal
 * (horizontal slider, right), and a center stage/restart button.
 *
 * All controls report into a shared `InputState` that the game loop reads.
 */

export interface InputState {
  throttle: number; // 0..1
  gimbal: number; // -1..1 (left/right)
  stagePressed: boolean; // edge-triggered, consumed by reader
  resetPressed: boolean;
}

interface PillRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Input {
  state: InputState = { throttle: 0, gimbal: 0, stagePressed: false, resetPressed: false };

  private throttlePill: PillRect = { x: 0, y: 0, w: 0, h: 0 };
  private gimbalPill: PillRect = { x: 0, y: 0, w: 0, h: 0 };
  private stagePill: PillRect = { x: 0, y: 0, w: 0, h: 0 };
  private resetPill: PillRect = { x: 0, y: 0, w: 0, h: 0 };

  private activePointers = new Map<number, "throttle" | "gimbal" | null>();

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("pointerleave", this.onUp);
    // Keyboard fallback for desktop testing
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKeyUp);
  }

  layout(vw: number, vh: number) {
    const pad = 16;
    const w = Math.min(80, vw * 0.18);
    const h = Math.min(220, vh * 0.45);
    this.throttlePill = { x: pad, y: vh - h - pad, w, h };
    this.gimbalPill = {
      x: vw - vw * 0.6 - pad,
      y: vh - 56 - pad,
      w: vw * 0.6,
      h: 56,
    };
    const sw = 90;
    this.stagePill = { x: vw / 2 - sw / 2, y: vh - 56 - pad, w: sw, h: 56 };
    this.resetPill = { x: vw - 90 - pad, y: pad, w: 90, h: 36 };
  }

  layoutRects() {
    return {
      throttle: this.throttlePill,
      gimbal: this.gimbalPill,
      stage: this.stagePill,
      reset: this.resetPill,
    };
  }

  /** Read pending edges; clears stagePressed/resetPressed. */
  consumeEdges(): { stage: boolean; reset: boolean } {
    const out = { stage: this.state.stagePressed, reset: this.state.resetPressed };
    this.state.stagePressed = false;
    this.state.resetPressed = false;
    return out;
  }

  // --- internal ---

  private hit(rect: PillRect, x: number, y: number): boolean {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  private clientToCss(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private setThrottleFromY(y: number) {
    const t = 1 - (y - this.throttlePill.y) / this.throttlePill.h;
    this.state.throttle = Math.max(0, Math.min(1, t));
  }

  private setGimbalFromX(x: number) {
    const center = this.gimbalPill.x + this.gimbalPill.w / 2;
    const half = this.gimbalPill.w / 2;
    const g = (x - center) / half;
    this.state.gimbal = Math.max(-1, Math.min(1, g));
  }

  private onDown = (e: PointerEvent) => {
    e.preventDefault();
    const { x, y } = this.clientToCss(e);
    if (this.hit(this.stagePill, x, y)) {
      this.state.stagePressed = true;
      return;
    }
    if (this.hit(this.resetPill, x, y)) {
      this.state.resetPressed = true;
      return;
    }
    if (this.hit(this.throttlePill, x, y)) {
      this.activePointers.set(e.pointerId, "throttle");
      this.setThrottleFromY(y);
      return;
    }
    if (this.hit(this.gimbalPill, x, y)) {
      this.activePointers.set(e.pointerId, "gimbal");
      this.setGimbalFromX(x);
      return;
    }
    this.activePointers.set(e.pointerId, null);
  };

  private onMove = (e: PointerEvent) => {
    const target = this.activePointers.get(e.pointerId);
    if (!target) return;
    const { x, y } = this.clientToCss(e);
    if (target === "throttle") this.setThrottleFromY(y);
    else if (target === "gimbal") this.setGimbalFromX(x);
  };

  private onUp = (e: PointerEvent) => {
    const target = this.activePointers.get(e.pointerId);
    this.activePointers.delete(e.pointerId);
    // Release gimbal to neutral on lift; keep throttle latched.
    if (target === "gimbal") this.state.gimbal = 0;
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp" || e.key === "w") this.state.throttle = Math.min(1, this.state.throttle + 0.1);
    else if (e.key === "ArrowDown" || e.key === "s") this.state.throttle = Math.max(0, this.state.throttle - 0.1);
    else if (e.key === "ArrowLeft" || e.key === "a") this.state.gimbal = -1;
    else if (e.key === "ArrowRight" || e.key === "d") this.state.gimbal = 1;
    else if (e.key === " ") this.state.stagePressed = true;
    else if (e.key === "r" || e.key === "R") this.state.resetPressed = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "ArrowRight" || e.key === "d")
      this.state.gimbal = 0;
  };
}
