/**
 * Menu / settings screens. Pure layout + draw + hit-testing — owns no game
 * state. The main loop drives it by calling layout/draw and feeding it pointer
 * events through hit().
 */

import { COLOR } from "./render";
import { drawRocketPreview } from "./render";
import { LEVELS, type Level } from "./levels";
import { SHAPES } from "./rockets";
import { bestScore, clearScores } from "./scores";
import { settings, updateSettings } from "./settings";
import { applySettingsToAudio } from "./audio";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type MenuAction =
  | { kind: "play"; levelId: string }
  | { kind: "openSettings" }
  | { kind: "closeSettings" }
  | { kind: "toggleAudio" }
  | { kind: "setVolume"; v: number }
  | { kind: "setSensitivity"; v: number }
  | { kind: "clearScores" }
  | { kind: "back" };

export type MenuScreen = "main" | "settings";

export class Menu {
  screen: MenuScreen = "main";
  private vw = 0;
  private vh = 0;

  private levelRects: Array<{ rect: Rect; level: Level }> = [];
  private settingsBtn: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private closeBtn: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private audioToggle: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private volMinus: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private volPlus: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private sensMinus: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private sensPlus: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private clearScoresBtn: Rect = { x: 0, y: 0, w: 0, h: 0 };

  layout(vw: number, vh: number) {
    this.vw = vw;
    this.vh = vh;
    const pad = 24;

    // Main screen: title at top, vertical list of level cards, settings gear bottom-right.
    const cardW = Math.min(420, vw - pad * 2);
    const cardH = 96;
    const startY = Math.min(vh * 0.32, 220);
    this.levelRects = LEVELS.map((level, i) => ({
      level,
      rect: { x: (vw - cardW) / 2, y: startY + i * (cardH + 14), w: cardW, h: cardH },
    }));

    this.settingsBtn = { x: vw - 56 - pad, y: vh - 56 - pad, w: 56, h: 56 };

    // Settings overlay rects.
    const sw = Math.min(420, vw - pad * 2);
    const sx = (vw - sw) / 2;
    const sy = Math.min(vh * 0.18, 120);
    this.closeBtn = { x: sx + sw - 44, y: sy, w: 44, h: 36 };
    this.audioToggle = { x: sx + sw - 90, y: sy + 70, w: 90, h: 36 };
    this.volMinus = { x: sx + sw - 90, y: sy + 120, w: 36, h: 36 };
    this.volPlus = { x: sx + sw - 44, y: sy + 120, w: 36, h: 36 };
    this.sensMinus = { x: sx + sw - 90, y: sy + 170, w: 36, h: 36 };
    this.sensPlus = { x: sx + sw - 44, y: sy + 170, w: 36, h: 36 };
    this.clearScoresBtn = { x: sx, y: sy + 230, w: sw, h: 40 };
  }

  /** Hit-test a pointer; returns an action or null. */
  hit(x: number, y: number): MenuAction | null {
    if (this.screen === "main") {
      for (const { rect, level } of this.levelRects) {
        if (inside(rect, x, y)) return { kind: "play", levelId: level.id };
      }
      if (inside(this.settingsBtn, x, y)) return { kind: "openSettings" };
      return null;
    }
    // settings
    if (inside(this.closeBtn, x, y)) return { kind: "closeSettings" };
    if (inside(this.audioToggle, x, y)) return { kind: "toggleAudio" };
    if (inside(this.volMinus, x, y)) return { kind: "setVolume", v: settings.volume - 0.1 };
    if (inside(this.volPlus, x, y)) return { kind: "setVolume", v: settings.volume + 0.1 };
    if (inside(this.sensMinus, x, y))
      return { kind: "setSensitivity", v: settings.sensitivity - 0.25 };
    if (inside(this.sensPlus, x, y))
      return { kind: "setSensitivity", v: settings.sensitivity + 0.25 };
    if (inside(this.clearScoresBtn, x, y)) return { kind: "clearScores" };
    return null;
  }

  /** Mutates settings/persistence in response to an action. */
  apply(action: MenuAction) {
    switch (action.kind) {
      case "openSettings":
        this.screen = "settings";
        break;
      case "closeSettings":
        this.screen = "main";
        break;
      case "toggleAudio":
        updateSettings({ audioOn: !settings.audioOn });
        applySettingsToAudio();
        break;
      case "setVolume":
        updateSettings({ volume: clamp(action.v, 0, 1) });
        applySettingsToAudio();
        break;
      case "setSensitivity":
        updateSettings({ sensitivity: clamp(action.v, 0.5, 2) });
        break;
      case "clearScores":
        clearScores();
        break;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.screen === "main") this.drawMain(ctx);
    else this.drawSettings(ctx);
  }

  private drawMain(ctx: CanvasRenderingContext2D) {
    // Title
    ctx.fillStyle = COLOR.hud;
    ctx.font = "bold 38px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("APOAPSIS", this.vw / 2, Math.min(this.vh * 0.18, 110));
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillStyle = COLOR.hudDim;
    ctx.fillText("get into orbit", this.vw / 2, Math.min(this.vh * 0.18, 110) + 22);

    // Level cards
    for (const { rect, level } of this.levelRects) {
      ctx.strokeStyle = COLOR.hud;
      ctx.lineWidth = 1.5;
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
      ctx.stroke();

      // rocket preview at left of card
      const shape = SHAPES[level.rocket.shape ?? "scout"];
      drawRocketPreview(ctx, shape, rect.x + 44, rect.y + rect.h / 2, rect.h - 24);

      ctx.textAlign = "left";
      ctx.fillStyle = COLOR.hud;
      ctx.font = "bold 18px ui-monospace, monospace";
      ctx.fillText(level.name, rect.x + 96, rect.y + 28);
      ctx.fillStyle = COLOR.hudDim;
      ctx.font = "11px ui-monospace, monospace";
      ctx.fillText(level.blurb, rect.x + 96, rect.y + 48);

      const best = bestScore(level.id);
      ctx.fillStyle = best ? COLOR.win : COLOR.hudDim;
      ctx.font = "11px ui-monospace, monospace";
      const bestLine = best
        ? `BEST  ${best.seconds.toFixed(1)} s   FUEL ${(best.fuelFrac * 100).toFixed(0)}%   ECC ${best.ecc.toFixed(2)}`
        : `BEST  —`;
      ctx.fillText(bestLine, rect.x + 96, rect.y + rect.h - 14);
    }

    // Settings gear button
    ctx.strokeStyle = COLOR.hudDim;
    ctx.lineWidth = 1.5;
    roundRect(ctx, this.settingsBtn.x, this.settingsBtn.y, this.settingsBtn.w, this.settingsBtn.h, 28);
    ctx.stroke();
    ctx.fillStyle = COLOR.hudDim;
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("SET", this.settingsBtn.x + this.settingsBtn.w / 2, this.settingsBtn.y + this.settingsBtn.h / 2 + 4);
  }

  private drawSettings(ctx: CanvasRenderingContext2D) {
    // Dim background
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, this.vw, this.vh);

    const pad = 24;
    const sw = Math.min(420, this.vw - pad * 2);
    const sx = (this.vw - sw) / 2;
    const sy = Math.min(this.vh * 0.18, 120);
    const sh = 290;

    // Panel
    ctx.fillStyle = "#000";
    ctx.strokeStyle = COLOR.hud;
    ctx.lineWidth = 1.5;
    roundRect(ctx, sx, sy, sw, sh, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLOR.hud;
    ctx.font = "bold 18px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText("SETTINGS", sx + 16, sy + 28);

    // Close X
    ctx.strokeStyle = COLOR.hudDim;
    roundRect(ctx, this.closeBtn.x, this.closeBtn.y, this.closeBtn.w, this.closeBtn.h, 18);
    ctx.stroke();
    ctx.fillStyle = COLOR.hudDim;
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("X", this.closeBtn.x + this.closeBtn.w / 2, this.closeBtn.y + this.closeBtn.h / 2 + 4);

    // Audio
    ctx.fillStyle = COLOR.hud;
    ctx.textAlign = "left";
    ctx.font = "13px ui-monospace, monospace";
    ctx.fillText("AUDIO", sx + 16, sy + 90);
    drawToggle(ctx, this.audioToggle, settings.audioOn ? "ON" : "OFF", settings.audioOn);

    // Volume
    ctx.fillStyle = COLOR.hud;
    ctx.fillText(`VOLUME  ${(settings.volume * 100).toFixed(0)}%`, sx + 16, sy + 140);
    drawSmallBtn(ctx, this.volMinus, "−");
    drawSmallBtn(ctx, this.volPlus, "+");

    // Sensitivity
    ctx.fillStyle = COLOR.hud;
    ctx.fillText(`GIMBAL SENSITIVITY  ${settings.sensitivity.toFixed(2)}x`, sx + 16, sy + 190);
    drawSmallBtn(ctx, this.sensMinus, "−");
    drawSmallBtn(ctx, this.sensPlus, "+");

    // Clear scores
    ctx.strokeStyle = COLOR.warn;
    ctx.lineWidth = 1.5;
    roundRect(
      ctx,
      this.clearScoresBtn.x,
      this.clearScoresBtn.y,
      this.clearScoresBtn.w,
      this.clearScoresBtn.h,
      14,
    );
    ctx.stroke();
    ctx.fillStyle = COLOR.warn;
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      "CLEAR HIGH SCORES",
      this.clearScoresBtn.x + this.clearScoresBtn.w / 2,
      this.clearScoresBtn.y + this.clearScoresBtn.h / 2 + 4,
    );
  }
}

function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
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

function drawSmallBtn(ctx: CanvasRenderingContext2D, r: Rect, label: string) {
  ctx.strokeStyle = COLOR.hud;
  ctx.lineWidth = 1.5;
  roundRect(ctx, r.x, r.y, r.w, r.h, 18);
  ctx.stroke();
  ctx.fillStyle = COLOR.hud;
  ctx.font = "16px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 6);
}

function drawToggle(ctx: CanvasRenderingContext2D, r: Rect, label: string, on: boolean) {
  ctx.strokeStyle = on ? COLOR.win : COLOR.hudDim;
  ctx.lineWidth = 1.5;
  roundRect(ctx, r.x, r.y, r.w, r.h, 18);
  if (on) {
    ctx.fillStyle = "rgba(184,107,255,0.18)";
    ctx.fill();
  }
  ctx.stroke();
  ctx.fillStyle = on ? COLOR.win : COLOR.hudDim;
  ctx.font = "12px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 4);
}
