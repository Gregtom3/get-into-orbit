import { COLOR } from "./render";
import type { Input } from "./input";
import type { Rocket } from "./physics";
import type { OrbitElements } from "./orbit";

export interface HudData {
  altitude: number;
  speed: number;
  apoAlt: number; // can be Infinity
  periAlt: number; // can be negative (suborbital)
  ecc: number;
  fuelFrac: number; // 0..1
  status: "FLY" | "WIN" | "CRASH";
  message?: string;
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  vw: number,
  data: HudData,
) {
  ctx.save();
  ctx.fillStyle = COLOR.hud;
  ctx.font = "12px ui-monospace, monospace";
  ctx.textBaseline = "top";

  const fmt = (n: number, unit: string) => {
    if (!isFinite(n)) return `∞ ${unit}`;
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)} k${unit}`;
    return `${n.toFixed(0)} ${unit}`;
  };

  const lines = [
    `ALT  ${fmt(data.altitude, "m")}`,
    `VEL  ${fmt(data.speed, "m/s")}`,
    `APO  ${fmt(data.apoAlt, "m")}`,
    `PER  ${fmt(data.periAlt, "m")}`,
    `ECC  ${data.ecc.toFixed(3)}`,
    `FUEL ${(data.fuelFrac * 100).toFixed(0)}%`,
  ];
  let y = 12;
  for (const ln of lines) {
    ctx.fillText(ln, 12, y);
    y += 16;
  }

  if (data.status === "WIN") {
    ctx.fillStyle = COLOR.win;
    ctx.font = "bold 18px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("ORBIT ACHIEVED", vw / 2, 24);
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText("tap RESET to fly again", vw / 2, 48);
    ctx.textAlign = "left";
  } else if (data.status === "CRASH") {
    ctx.fillStyle = COLOR.warn;
    ctx.font = "bold 18px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("CRASHED", vw / 2, 24);
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText("tap RESET to retry", vw / 2, 48);
    ctx.textAlign = "left";
  } else if (data.message) {
    ctx.fillStyle = COLOR.hudDim;
    ctx.font = "12px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(data.message, vw / 2, 16);
    ctx.textAlign = "left";
  }

  ctx.restore();
}

/** Draw the three input pills as wireframes. */
export function drawPills(
  ctx: CanvasRenderingContext2D,
  input: Input,
) {
  const r = input.layoutRects();
  const s = input.state;

  ctx.save();
  ctx.lineWidth = 1.5;

  // throttle (vertical slider) -- left
  ctx.strokeStyle = COLOR.hud;
  roundRect(ctx, r.throttle.x, r.throttle.y, r.throttle.w, r.throttle.h, 12);
  ctx.stroke();
  // fill bar
  const fillH = s.throttle * r.throttle.h;
  ctx.fillStyle = COLOR.hudDim;
  ctx.fillRect(
    r.throttle.x + 4,
    r.throttle.y + r.throttle.h - fillH + 0,
    r.throttle.w - 8,
    Math.max(0, fillH - 4),
  );
  ctx.fillStyle = COLOR.hud;
  ctx.font = "11px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("THR", r.throttle.x + r.throttle.w / 2, r.throttle.y - 14);
  ctx.fillText(
    `${(s.throttle * 100).toFixed(0)}%`,
    r.throttle.x + r.throttle.w / 2,
    r.throttle.y + r.throttle.h + 4,
  );

  // gimbal (horizontal) -- bottom right
  ctx.strokeStyle = COLOR.hud;
  roundRect(ctx, r.gimbal.x, r.gimbal.y, r.gimbal.w, r.gimbal.h, 28);
  ctx.stroke();
  // indicator
  const cx = r.gimbal.x + r.gimbal.w / 2 + (s.gimbal * r.gimbal.w) / 2;
  ctx.fillStyle = COLOR.hudDim;
  ctx.beginPath();
  ctx.arc(cx, r.gimbal.y + r.gimbal.h / 2, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOR.hud;
  ctx.fillText("◁ GIMBAL ▷", r.gimbal.x + r.gimbal.w / 2, r.gimbal.y + r.gimbal.h / 2 + 4);

  // stage button (center)
  ctx.strokeStyle = COLOR.hud;
  roundRect(ctx, r.stage.x, r.stage.y, r.stage.w, r.stage.h, 28);
  ctx.stroke();
  ctx.fillStyle = COLOR.hud;
  ctx.fillText("STAGE", r.stage.x + r.stage.w / 2, r.stage.y + r.stage.h / 2 + 4);

  // reset (top right)
  ctx.strokeStyle = COLOR.hudDim;
  roundRect(ctx, r.reset.x, r.reset.y, r.reset.w, r.reset.h, 18);
  ctx.stroke();
  ctx.fillStyle = COLOR.hudDim;
  ctx.fillText("RESET", r.reset.x + r.reset.w / 2, r.reset.y + r.reset.h / 2 + 4);

  // prograde/retrograde locks
  drawLockPill(ctx, r.prograde, "PRO", s.headingMode === "prograde");
  drawLockPill(ctx, r.retrograde, "RET", s.headingMode === "retrograde");

  ctx.textAlign = "left";
  ctx.restore();
}

function drawLockPill(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  label: string,
  active: boolean,
) {
  ctx.strokeStyle = active ? COLOR.win : COLOR.hudDim;
  ctx.lineWidth = active ? 2 : 1.5;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18);
  if (active) {
    ctx.fillStyle = "rgba(184,107,255,0.18)";
    ctx.fill();
  }
  ctx.stroke();
  ctx.fillStyle = active ? COLOR.win : COLOR.hud;
  ctx.font = "12px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4);
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

export function hudDataOf(
  rocket: Rocket,
  el: OrbitElements,
  planet: { radius: number },
  fuelFrac: number,
  status: "FLY" | "WIN" | "CRASH",
  message?: string,
): HudData {
  const r = Math.hypot(rocket.pos.x, rocket.pos.y);
  const speed = Math.hypot(rocket.vel.x, rocket.vel.y);
  return {
    altitude: r - planet.radius,
    speed,
    apoAlt: el.apoapsis - planet.radius,
    periAlt: el.periapsis - planet.radius,
    ecc: el.e,
    fuelFrac,
    status,
    message,
  };
}
