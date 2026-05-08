/**
 * Tutorial / help overlay. Pure render + close-hit-test.
 */

import { COLOR } from "./render";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class HelpOverlay {
  visible = false;
  private close: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private vw = 0;
  private vh = 0;

  layout(vw: number, vh: number) {
    this.vw = vw;
    this.vh = vh;
    this.close = { x: vw - 60, y: 16, w: 44, h: 36 };
  }

  /** Returns true if the pointer was consumed. */
  hit(x: number, y: number): boolean {
    if (!this.visible) return false;
    if (
      x >= this.close.x &&
      x <= this.close.x + this.close.w &&
      y >= this.close.y &&
      y <= this.close.y + this.close.h
    ) {
      this.visible = false;
      return true;
    }
    // Tap anywhere else also closes (forgiving on mobile).
    this.visible = false;
    return true;
  }

  toggle() {
    this.visible = !this.visible;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.visible) return;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, this.vw, this.vh);

    ctx.fillStyle = COLOR.hud;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    const x = Math.max(20, this.vw * 0.08);
    let y = 60;
    const lh = 22;

    ctx.font = "bold 22px ui-monospace, monospace";
    ctx.fillText("HOW TO FLY", x, y);
    y += 36;

    ctx.font = "13px ui-monospace, monospace";
    ctx.fillStyle = COLOR.hud;
    const lines = [
      "GOAL    Reach a stable orbit with periapsis above the level",
      "        threshold and eccentricity below the cap. Hold for 4s.",
      "",
      "THR     Throttle slider (left). Burn fuel to gain speed.",
      "GIMBAL  Steer (bottom right). Pulls in local frame, so up",
      "        stays up relative to the surface beneath you.",
      "PRO     Lock heading along velocity (best for circularizing).",
      "RET     Lock heading retrograde (slow down, lower orbit).",
      "STAGE   Center button (reserved for staging).",
      "",
      "CAMERA  Drag empty space to pan. Pinch or scroll to zoom.",
      "FOLLOW  Pill — re-engages auto-frame on the rocket.",
      "◎      Recenter and reset zoom.",
      "",
      "TIPS    Pitch over to ~45° between 5 and 30 km altitude.",
      "        Cut throttle once apoapsis is above the target.",
      "        Coast to apoapsis then PRO + burn to circularize.",
      "",
      "KEYS    W/S throttle, A/D gimbal, P prograde, O retrograde,",
      "        F follow, C center, R restart, Q/Esc quit, ? help.",
      "",
      "Tap anywhere to dismiss.",
    ];
    for (const ln of lines) {
      ctx.fillText(ln, x, y);
      y += lh;
    }

    // Close X
    ctx.strokeStyle = COLOR.hud;
    ctx.lineWidth = 1.5;
    roundRect(ctx, this.close.x, this.close.y, this.close.w, this.close.h, 18);
    ctx.stroke();
    ctx.fillStyle = COLOR.hud;
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("X", this.close.x + this.close.w / 2, this.close.y + this.close.h / 2 + 4);
  }
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
