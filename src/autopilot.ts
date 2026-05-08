import { angle, type Vec2 } from "./vec2";

export type HeadingMode = "manual" | "prograde" | "retrograde" | "radial-out" | "radial-in";

/** Wrap an angle into [-π, π]. */
export function wrapAngle(a: number): number {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x < -Math.PI) x += 2 * Math.PI;
  return x;
}

/** Shortest signed angular delta from `from` to `to`. */
export function angleDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}

/** World heading that points along the desired mode given current state. */
export function targetHeading(
  mode: HeadingMode,
  pos: Vec2,
  vel: Vec2,
  manualHeading: number,
): number {
  switch (mode) {
    case "manual":
      return manualHeading;
    case "prograde":
      // If essentially at rest, fall back to manual to avoid flipping.
      if (vel.x === 0 && vel.y === 0) return manualHeading;
      return angle(vel);
    case "retrograde":
      if (vel.x === 0 && vel.y === 0) return manualHeading;
      return angle(vel) + Math.PI;
    case "radial-out":
      return angle(pos);
    case "radial-in":
      return angle(pos) + Math.PI;
  }
}

/**
 * Step a heading toward a target at maxRate (rad/s). Used to give locks a
 * realistic slew time rather than snapping instantly.
 */
export function slewHeading(
  current: number,
  target: number,
  maxRate: number,
  dt: number,
): number {
  const delta = angleDelta(current, target);
  const maxStep = maxRate * dt;
  if (Math.abs(delta) <= maxStep) return target;
  return wrapAngle(current + Math.sign(delta) * maxStep);
}
