import { fromAngle, len, type Vec2 } from "./vec2";
import type { Planet, Rocket } from "./physics";
import { SHAPES, type RocketShape } from "./rockets";
import { projectSphere } from "./sphere3d";

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

/**
 * Draw the planet as a 3D-projected wireframe globe (lat/lon grid rotating
 * around Y) plus a hard outline at the limb and a faint atmosphere ring.
 */
export function drawPlanet(
  ctx: CanvasRenderingContext2D,
  planet: Planet,
  cam: Camera,
  yawRad = 0,
) {
  const c = worldToScreen({ x: 0, y: 0 }, cam);
  const rPx = planet.radius / cam.metersPerPx;
  if (rPx < 1) return;

  // Atmosphere ring
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

  // 3D wireframe interior (front-face only)
  if (rPx > 18) {
    const polylines = projectSphere(yawRad);
    ctx.strokeStyle = COLOR.grid;
    ctx.lineWidth = 1;
    for (const pl of polylines) {
      if (pl.pts.length < 2) continue;
      ctx.beginPath();
      const p0 = pl.pts[0]!;
      ctx.moveTo(c.x + p0[0] * rPx, c.y - p0[1] * rPx);
      for (let i = 1; i < pl.pts.length; i++) {
        const p = pl.pts[i]!;
        ctx.lineTo(c.x + p[0] * rPx, c.y - p[1] * rPx);
      }
      ctx.stroke();
    }
  }

  // Hard limb outline
  ctx.strokeStyle = COLOR.planet;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(c.x, c.y, rPx, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Surface terrain — radial spikes (mountains) on the visible limb plus a
 * launch pad marker at the start position. Cheap: deterministic from a seed
 * so it doesn't shimmer.
 */
export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  planet: Planet,
  cam: Camera,
  seed = 1,
) {
  const c = worldToScreen({ x: 0, y: 0 }, cam);
  const rPx = planet.radius / cam.metersPerPx;
  if (rPx < 30) return;

  ctx.strokeStyle = COLOR.planet;
  ctx.lineWidth = 1;

  const count = 96;
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    // Pseudo-random terrain height in pixels
    const h = (hash(i + seed) * 0.6 + 0.2) * Math.min(8, rPx * 0.025);
    const cx = Math.cos(theta);
    const sy = Math.sin(theta);
    const x0 = c.x + cx * rPx;
    const y0 = c.y - sy * rPx;
    const x1 = c.x + cx * (rPx + h);
    const y1 = c.y - sy * (rPx + h);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // Launch pad: small structure at the launch site (planet's +y axis).
  const padTheta = Math.PI / 2;
  const cx = Math.cos(padTheta);
  const sy = Math.sin(padTheta);
  const baseX = c.x + cx * rPx;
  const baseY = c.y - sy * rPx;
  const towerH = 18;
  const towerW = 6;
  ctx.strokeStyle = COLOR.hud;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(baseX - towerW, baseY);
  ctx.lineTo(baseX - towerW, baseY - towerH);
  ctx.lineTo(baseX + towerW, baseY - towerH);
  ctx.lineTo(baseX + towerW, baseY);
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(baseX, baseY - towerH - 8);
  ctx.stroke();
}

function hash(n: number): number {
  // Cheap deterministic [0,1) hash.
  const x = Math.sin(n * 9301.31 + 49297) * 233280;
  return x - Math.floor(x);
}

/** Draw the rocket using its assigned wireframe shape. */
export function drawRocket(
  ctx: CanvasRenderingContext2D,
  rocket: Rocket,
  cam: Camera,
) {
  const shape: RocketShape = SHAPES[rocket.shape ?? "scout"];
  const p = worldToScreen(rocket.pos, cam);
  // Minimum on-screen rocket size: never less than 18px half-extent so the
  // rocket is always visible regardless of zoom level.
  const size = 18;
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

/**
 * If the rocket is somehow off-screen (after a bug, weird zoom, etc.), draw
 * a chevron arrow at the screen edge pointing toward it so the player can
 * never lose track of where it is.
 */
export function drawOffscreenIndicator(
  ctx: CanvasRenderingContext2D,
  rocket: Rocket,
  cam: Camera,
) {
  const s = worldToScreen(rocket.pos, cam);
  const margin = 28;
  if (
    s.x >= margin &&
    s.x <= cam.vw - margin &&
    s.y >= margin &&
    s.y <= cam.vh - margin
  ) {
    return; // visible
  }
  const cx = cam.vw / 2;
  const cy = cam.vh / 2;
  const dx = s.x - cx;
  const dy = s.y - cy;
  // Clamp the arrow tip to within the visible margin band.
  const halfW = cam.vw / 2 - margin;
  const halfH = cam.vh / 2 - margin;
  const t = Math.min(halfW / Math.max(1, Math.abs(dx)), halfH / Math.max(1, Math.abs(dy)));
  const ax = cx + dx * t;
  const ay = cy + dy * t;
  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.strokeStyle = COLOR.warn;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-12, -8);
  ctx.lineTo(0, 0);
  ctx.lineTo(-12, 8);
  ctx.stroke();
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

/**
 * Choose a metersPerPx and center so the rocket is ALWAYS on screen plus a
 * chunk of surface beneath it.
 *
 * Strategy: the visible span scales with altitude (close in low, wide high).
 * The camera centers on the rocket, then offsets slightly toward the planet
 * center so the surface stays in view rather than being clipped at the bottom.
 */
export function fitCamera(
  cam: Camera,
  rocket: Rocket,
  planet: Planet,
  pad = 1.2,
): void {
  const r = Math.max(1, len(rocket.pos));
  const altAbove = Math.max(0, r - planet.radius);

  // Visible world span in meters across the smaller screen dimension.
  // At launch (alt ≈ 0): ~30 km span — rocket is clearly visible against the
  // surface. As altitude grows, the span grows proportionally so apoapsis
  // markers and the predicted orbit stay in frame.
  const wantSpan = Math.max(20_000, altAbove * 3 + 30_000);
  const px = Math.max(1, Math.min(cam.vw, cam.vh));
  cam.metersPerPx = (wantSpan * pad) / px;

  // Center on the rocket, then slide the camera back toward the planet center
  // by a fraction of the visible span so the horizon line stays visible.
  const radial = { x: rocket.pos.x / r, y: rocket.pos.y / r };
  const slide = wantSpan * 0.18;
  cam.center = {
    x: rocket.pos.x - radial.x * slide,
    y: rocket.pos.y - radial.y * slide,
  };
}

/** True iff the world-space point is currently inside the camera's CSS-pixel viewport. */
export function pointOnScreen(p: Vec2, cam: Camera, marginPx = 0): boolean {
  const s = worldToScreen(p, cam);
  return (
    s.x >= -marginPx &&
    s.x <= cam.vw + marginPx &&
    s.y >= -marginPx &&
    s.y <= cam.vh + marginPx
  );
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
