import { pureStep, type Planet } from "./physics";
import { len, type Vec2 } from "./vec2";

export interface Prediction {
  points: Vec2[];
  apoapsis: Vec2 | null;
  periapsis: Vec2 | null;
  impact: Vec2 | null;
}

/**
 * Forward-integrate a ballistic trajectory (no thrust, no drag) for `seconds`
 * to draw a predicted path. Stops on surface impact. Marks apo/peri.
 */
export function predict(
  pos: Vec2,
  vel: Vec2,
  planet: Planet,
  seconds: number,
  dt = 1,
): Prediction {
  const points: Vec2[] = [];
  let p = { x: pos.x, y: pos.y };
  let v = { x: vel.x, y: vel.y };
  let lastR = len(p);
  let prevR = lastR;
  let apoapsis: Vec2 | null = null;
  let periapsis: Vec2 | null = null;
  let impact: Vec2 | null = null;

  const total = Math.floor(seconds / dt);
  for (let i = 0; i < total; i++) {
    const next = pureStep(p, v, planet, dt);
    p = next.pos;
    v = next.vel;
    const r = len(p);
    if (r <= planet.radius) {
      impact = p;
      break;
    }
    // Detect turning points.
    if (i > 0) {
      if (lastR > prevR && lastR >= r && apoapsis == null) {
        apoapsis = { x: p.x, y: p.y };
      }
      if (lastR < prevR && lastR <= r && periapsis == null) {
        periapsis = { x: p.x, y: p.y };
      }
    }
    prevR = lastR;
    lastR = r;
    if (i % 2 === 0) points.push({ x: p.x, y: p.y }); // downsample for fewer line segments
  }

  return { points, apoapsis, periapsis, impact };
}
