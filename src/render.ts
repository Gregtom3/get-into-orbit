import { fromAngle, len, type Vec2 } from "./vec2";
import type { Planet, Rocket } from "./physics";
import { SHAPES, type RocketShape } from "./rockets";

export interface Camera {
  /** World-space center of view (m). */
  center: Vec2;
  /** Meters per CSS pixel. */
  metersPerPx: number;
  /** Viewport size in CSS pixels. */
  vw: number;
  vh: number;
}

export const COLOR = {
  bg: "#000000",
  grid: "#0a3744",
  planet: "#7df9ff",
  atmo: "#1f6f7c",
  rocket: "#7df9ff",
  flame: "#ff7a3d",
  hud: "#7df9ff",
  hudDim: "#3a7d86",
  warn: "#ffb84d",
  win: "#b86bff",
  predict: "#39c0c8",
} as const;

export function worldToScreen(p: Vec2, cam: Camera): Vec2 {
  return {
    x: cam.vw / 2 + (p.x - cam.center.x) / cam.metersPerPx,
    y: cam.vh / 2 - (p.y - cam.center.y) / cam.metersPerPx,
  };
}

export function clearFrame(ctx: CanvasRenderingContext2D, cam: Camera) {
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, cam.vw, cam.vh);
}

/** Draw the planet as an outlined circle with a faint atmosphere ring. */
export function drawPlanet(
  ctx: CanvasRenderingContext2D,
  planet: Planet,
  cam: Camera,
) {
  const c = worldToScreen({ x: 0, y: 0 }, cam);
  const rPx = planet.radius / cam.metersPerPx;
  if (rPx < 1) return;

  // Atmosphere
  if (planet.atmoTop > 0) {
    const atmoPx = (planet.radius + planet.atmoTop) / cam.metersPerPx;
    ctx.strokeStyle = COLOR.atmo;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, atmoPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Planet outline
  ctx.strokeStyle = COLOR.planet;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(c.x, c.y, rPx, 0, Math.PI * 2);
  ctx.stroke();

  // Latitude grid (subtle Tron-y feel)
  ctx.strokeStyle = COLOR.grid;
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, (rPx * i) / 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Equator + meridian
  ctx.beginPath();
  ctx.moveTo(c.x - rPx, c.y);
  ctx.lineTo(c.x + rPx, c.y);
  ctx.moveTo(c.x, c.y - rPx);
  ctx.lineTo(c.x, c.y + rPx);
  ctx.stroke();
}

/** Draw the rocket using its assigned wireframe shape. */
export function drawRocket(
  ctx: CanvasRenderingContext2D,
  rocket: Rocket,
  cam: Camera,
) {
  const shape: RocketShape = SHAPES[rocket.shape ?? "scout"];
  const p = worldToScreen(rocket.pos, cam);
  const size = 14; // base half-extent in pixels
  const scale = size / shape.extent;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Canvas y grows downward; world heading π/2 = "up". Convert.
  ctx.rotate(-rocket.heading + Math.PI / 2);

  // Flame
  if (rocket.throttle > 0 && !rocket.crashed) {
    ctx.strokeStyle = COLOR.flame;
    ctx.lineWidth = 1.5;
    const fox = shape.flameOrigin[0] * scale;
    const foy = shape.flameOrigin[1] * scale;
    const fhw = shape.flameHalfWidth * scale;
    const flameLen = scale * 1.4 * rocket.throttle * (0.8 + Math.random() * 0.4);
    ctx.beginPath();
    ctx.moveTo(fox - fhw, foy);
    ctx.lineTo(fox, foy + flameLen);
    ctx.lineTo(fox + fhw, foy);
    ctx.stroke();
    // inner flicker
    ctx.strokeStyle = "rgba(255,200,120,0.7)";
    ctx.beginPath();
    ctx.moveTo(fox - fhw * 0.5, foy);
    ctx.lineTo(fox, foy + flameLen * 0.7);
    ctx.lineTo(fox + fhw * 0.5, foy);
    ctx.stroke();
  }

  // Body
  ctx.strokeStyle = rocket.crashed ? COLOR.warn : COLOR.rocket;
  ctx.lineWidth = 1.5;
  for (const poly of shape.lines) {
    ctx.beginPath();
    const p0 = poly[0]!;
    ctx.moveTo(p0[0] * scale, p0[1] * scale);
    for (let i = 1; i < poly.length; i++) {
      const pt = poly[i]!;
      ctx.lineTo(pt[0] * scale, pt[1] * scale);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/** Draw a rocket shape preview centered at (x,y) on the screen, no rotation. */
export function drawRocketPreview(
  ctx: CanvasRenderingContext2D,
  shape: RocketShape,
  x: number,
  y: number,
  pixelHeight: number,
  color = COLOR.rocket,
) {
  const scale = pixelHeight / (shape.extent * 2);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (const poly of shape.lines) {
    ctx.beginPath();
    const p0 = poly[0]!;
    ctx.moveTo(p0[0] * scale, p0[1] * scale);
    for (let i = 1; i < poly.length; i++) {
      const pt = poly[i]!;
      ctx.lineTo(pt[0] * scale, pt[1] * scale);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw a polyline in world space. */
export function drawWorldPath(
  ctx: CanvasRenderingContext2D,
  pts: Vec2[],
  cam: Camera,
  opts: { color: string; dash?: number[]; width?: number } = { color: COLOR.predict },
) {
  if (pts.length < 2) return;
  ctx.strokeStyle = opts.color;
  ctx.lineWidth = opts.width ?? 1;
  if (opts.dash) ctx.setLineDash(opts.dash);
  ctx.beginPath();
  const p0 = worldToScreen(pts[0]!, cam);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < pts.length; i++) {
    const p = worldToScreen(pts[i]!, cam);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  if (opts.dash) ctx.setLineDash([]);
}

/** Draw a faint star field in screen space (purely decorative). */
export function drawStars(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  seed = 1,
) {
  ctx.fillStyle = "#143540";
  // Cheap deterministic stars by hashing index.
  const count = Math.floor((cam.vw * cam.vh) / 6000);
  for (let i = 0; i < count; i++) {
    const n = i * 9301 + seed * 49297;
    const x = (n % 233280) / 233280;
    const y = ((n * 1.31) % 233280) / 233280;
    ctx.fillRect(Math.floor(x * cam.vw), Math.floor(y * cam.vh), 1, 1);
  }
}

/** Choose a metersPerPx that fits the rocket and the planet limb on screen. */
export function fitCamera(
  cam: Camera,
  rocket: Rocket,
  planet: Planet,
  pad = 1.4,
): void {
  const r = len(rocket.pos);
  const altAbove = Math.max(0, r - planet.radius);
  // Want to see at least the local horizon and a margin above the rocket.
  const wantSpan = Math.max(planet.radius * 0.25, altAbove * 2 + 50_000);
  const px = Math.min(cam.vw, cam.vh);
  cam.metersPerPx = (wantSpan * pad) / px;
  // Camera follows rocket but biases toward the planet so the surface stays in view.
  cam.center = { x: rocket.pos.x * 0.6, y: rocket.pos.y * 0.6 };
}

/** Apoapsis/periapsis markers along the predicted trajectory polyline (decorative). */
export function drawApsisMarker(
  ctx: CanvasRenderingContext2D,
  pos: Vec2,
  cam: Camera,
  label: string,
  color: string,
) {
  const p = worldToScreen(pos, cam);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "11px ui-monospace, monospace";
  ctx.fillText(label, p.x + 8, p.y + 4);
}

/** Util: prograde unit vector from velocity (used for prograde markers). */
export const prograde = (vel: Vec2): Vec2 => {
  const l = Math.hypot(vel.x, vel.y);
  return l === 0 ? { x: 1, y: 0 } : { x: vel.x / l, y: vel.y / l };
};

/** Util: a unit vector at a given angle, length n meters (for debug arrows). */
export const arrow = (theta: number, n: number) => fromAngle(theta, n);
