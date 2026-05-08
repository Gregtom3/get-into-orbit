import { COLOR } from "./render";
import type { Input } from "./input";
import { G_STANDARD, type Planet, type Rocket } from "./physics";
import type { OrbitElements } from "./orbit";
import type { CameraController } from "./camera";
import type { Tutorial } from "./tutorial";

export interface HudData {
  altitude: number;
  speed: number;
  apoAlt: number; // can be Infinity
  periAlt: number; // can be negative (suborbital)
  ecc: number;
  fuelFrac: number; // 0..1
  fuelKg: number;
  massKg: number;
  twr: number; // current thrust-to-weight ratio
  deltaV: number; // remaining ΔV (m/s)
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
    `ALT   ${fmt(data.altitude, "m")}`,
    `VEL   ${fmt(data.speed, "m/s")}`,
    `APO   ${fmt(data.apoAlt, "m")}`,
    `PER   ${fmt(data.periAlt, "m")}`,
    `ECC   ${data.ecc.toFixed(3)}`,
    ``,
    `FUEL  ${(data.fuelFrac * 100).toFixed(0)}%  ${fmt(data.fuelKg, "g")}`,
    `MASS  ${fmt(data.massKg, "g")}`,
    `TWR   ${data.twr.toFixed(2)}`,
    `ΔV    ${fmt(data.deltaV, "m/s")}`,
  ];
  let y = 12;
  for (const ln of lines) {
    ctx.fillText(ln, 12, y);
    y += 15;
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

/** Draw the tutorial banner + arrow toward the targeted pill. */
export function drawTutorialBanner(
  ctx: CanvasRenderingContext2D,
  vw: number,
  input: Input,
  tutorial: Tutorial,
) {
  const step = tutorial.current();
  if (!step) return;
  ctx.save();

  // Banner panel near the top, below the top-bar pills
  const bw = Math.min(vw - 24, 460);
  const bx = (vw - bw) / 2;
  const by = 60;
  const bh = 60;
  ctx.fillStyle = "rgba(0,0,0,0.78)";
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = COLOR.win;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

  ctx.fillStyle = COLOR.win;
  ctx.font = "bold 13px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(step.banner, bx + bw / 2, by + 8);

  ctx.fillStyle = COLOR.hud;
  ctx.font = "12px ui-monospace, monospace";
  ctx.fillText(step.hint, bx + bw / 2, by + 30);

  // Arrow pointing at the target pill if any
  if (step.pointAt) {
    const target = input.layoutRects()[step.pointAt];
    if (target) {
      const tx = target.x + target.w / 2;
      const ty = target.y + target.h / 2;
      const bcx = bx + bw / 2;
      const bcy = by + bh;
      ctx.strokeStyle = COLOR.win;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(bcx, bcy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      // pulse outline around the target pill
      ctx.strokeStyle = COLOR.win;
      ctx.lineWidth = 3;
      const pulse = 4 + Math.sin(performance.now() * 0.008) * 2;
      ctx.strokeRect(target.x - pulse, target.y - pulse, target.w + pulse * 2, target.h + pulse * 2);
    }
  }

  ctx.restore();
}

/** Draw all input pills as wireframes. */
export function drawPills(
  ctx: CanvasRenderingContext2D,
  input: Input,
  cameraCtrl?: CameraController,
) {
  const r = input.layoutRects();
  const s = input.state;

  ctx.save();
  ctx.lineWidth = 1.5;

  if (!r.throttle) return;
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

  if (!r.gimbal) return;
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
  if (r.stage) {
    ctx.strokeStyle = COLOR.hud;
    roundRect(ctx, r.stage.x, r.stage.y, r.stage.w, r.stage.h, 28);
    ctx.stroke();
    ctx.fillStyle = COLOR.hud;
    ctx.fillText("STAGE", r.stage.x + r.stage.w / 2, r.stage.y + r.stage.h / 2 + 4);
  }

  // top bar: QUIT, ?HELP, FOLLOW, CENTER, RESET
  if (r.quit) drawTopPill(ctx, r.quit, "QUIT", COLOR.warn);
  if (r.help) drawTopPill(ctx, r.help, "?", COLOR.hud);
  if (r.follow) {
    const followOn = cameraCtrl ? cameraCtrl.follow : true;
    drawLockPill(ctx, r.follow, "FOLLOW", followOn);
  }
  if (r.recenter) drawTopPill(ctx, r.recenter, "◎", COLOR.hud);
  if (r.reset) drawTopPill(ctx, r.reset, "RESTART", COLOR.hudDim);

  // prograde/retrograde locks
  if (r.prograde) drawLockPill(ctx, r.prograde, "PRO", s.headingMode === "prograde");
  if (r.retrograde) drawLockPill(ctx, r.retrograde, "RET", s.headingMode === "retrograde");

  ctx.textAlign = "left";
  ctx.restore();
}

function drawTopPill(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  label: string,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "12px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4);
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
  planet: Planet,
  fuelFrac: number,
  status: "FLY" | "WIN" | "CRASH",
  message?: string,
): HudData {
  const r = Math.hypot(rocket.pos.x, rocket.pos.y);
  const speed = Math.hypot(rocket.vel.x, rocket.vel.y);
  const fuelKg = rocket.mass - rocket.dryMass;
  // Current local gravity for TWR
  const localG = planet.mu / (r * r);
  const twr = rocket.thrust / Math.max(1, rocket.mass * localG);
  // ΔV remaining via Tsiolkovsky: Isp * g0 * ln(m_wet / m_dry)
  const deltaV =
    rocket.dryMass > 0 && rocket.mass > rocket.dryMass
      ? rocket.isp * G_STANDARD * Math.log(rocket.mass / rocket.dryMass)
      : 0;
  return {
    altitude: r - planet.radius,
    speed,
    apoAlt: el.apoapsis - planet.radius,
    periAlt: el.periapsis - planet.radius,
    ecc: el.e,
    fuelFrac,
    fuelKg,
    massKg: rocket.mass,
    twr,
    deltaV,
    status,
    message,
  };
}
