import { add, fromAngle, len, scale, sub, type Vec2 } from "./vec2";

export interface Planet {
  /** Standard gravitational parameter mu = G*M (m^3/s^2). */
  mu: number;
  /** Surface radius (m). */
  radius: number;
  /** Atmosphere scale height (m). 0 disables atmosphere. */
  atmoScaleHeight: number;
  /** Sea-level air density (kg/m^3). */
  atmoSeaLevelDensity: number;
  /** Atmosphere top altitude above surface (m). Above this, drag is zero. */
  atmoTop: number;
}

export interface Rocket {
  pos: Vec2; // m, planet-centered inertial frame
  vel: Vec2; // m/s
  /** Heading angle in radians, 0 = +x, pi/2 = +y (up at launch site on +y axis). */
  heading: number;
  /** Throttle 0..1. */
  throttle: number;
  /** Wet mass (kg) — dry + remaining fuel. */
  mass: number;
  dryMass: number;
  /** Sea-level thrust (N). */
  thrust: number;
  /** Specific impulse (s). Used to compute mass flow. */
  isp: number;
  /** Drag area (m^2). */
  area: number;
  /** Drag coefficient (dimensionless). */
  cd: number;
  /** Crashed flag. */
  crashed: boolean;
  /** Total elapsed flight time (s). */
  t: number;
  /** Visual shape id (purely cosmetic). */
  shape?: import("./rockets").RocketKind;
}

export const G_STANDARD = 9.80665; // m/s^2 used by Isp definition

/** Acceleration due to gravity from a planet centered at origin acting on body at pos. */
export function gravity(pos: Vec2, planet: Planet): Vec2 {
  const r = len(pos);
  if (r === 0) return { x: 0, y: 0 };
  const a = -planet.mu / (r * r);
  return { x: (pos.x / r) * a, y: (pos.y / r) * a };
}

/** Air density at altitude (m above surface). Exponential atmosphere. */
export function airDensity(altitude: number, planet: Planet): number {
  if (planet.atmoScaleHeight <= 0) return 0;
  if (altitude >= planet.atmoTop) return 0;
  if (altitude < 0) altitude = 0;
  return planet.atmoSeaLevelDensity * Math.exp(-altitude / planet.atmoScaleHeight);
}

/** Drag acceleration on rocket (opposes velocity). */
export function dragAccel(rocket: Rocket, planet: Planet): Vec2 {
  const r = len(rocket.pos);
  const alt = r - planet.radius;
  const rho = airDensity(alt, planet);
  if (rho === 0) return { x: 0, y: 0 };
  const speed = len(rocket.vel);
  if (speed === 0) return { x: 0, y: 0 };
  // F_drag = -1/2 * rho * v^2 * Cd * A * vhat   ⇒ a = F/m
  const fmag = 0.5 * rho * speed * speed * rocket.cd * rocket.area;
  const amag = fmag / rocket.mass;
  return { x: (-rocket.vel.x / speed) * amag, y: (-rocket.vel.y / speed) * amag };
}

/** Thrust acceleration along rocket heading, scaled by throttle. */
export function thrustAccel(rocket: Rocket): Vec2 {
  if (rocket.throttle <= 0 || rocket.mass <= rocket.dryMass) return { x: 0, y: 0 };
  const f = rocket.thrust * rocket.throttle;
  const a = f / rocket.mass;
  return fromAngle(rocket.heading, a);
}

/** Mass flow rate (kg/s) at current throttle. */
export function massFlow(rocket: Rocket): number {
  if (rocket.throttle <= 0 || rocket.mass <= rocket.dryMass) return 0;
  return (rocket.thrust * rocket.throttle) / (rocket.isp * G_STANDARD);
}

/** Total acceleration (gravity + drag + thrust). */
export function totalAccel(rocket: Rocket, planet: Planet): Vec2 {
  const g = gravity(rocket.pos, planet);
  const d = dragAccel(rocket, planet);
  const t = thrustAccel(rocket);
  return { x: g.x + d.x + t.x, y: g.y + d.y + t.y };
}

/**
 * Semi-implicit (symplectic) Euler step. Stable for orbital motion at modest dt.
 * Mutates rocket.
 */
export function step(rocket: Rocket, planet: Planet, dt: number): void {
  if (rocket.crashed) return;
  const a = totalAccel(rocket, planet);
  rocket.vel = add(rocket.vel, scale(a, dt));
  rocket.pos = add(rocket.pos, scale(rocket.vel, dt));
  const dm = massFlow(rocket) * dt;
  rocket.mass = Math.max(rocket.dryMass, rocket.mass - dm);
  rocket.t += dt;

  // Surface collision: if velocity points downward and we're below surface, crash.
  const r = len(rocket.pos);
  if (r < planet.radius) {
    // clamp to surface, kill velocity for now (landing/crash handled by game logic)
    const speed = len(rocket.vel);
    const hard = speed > 8; // > 8 m/s vertical equivalent counts as crash
    rocket.pos = scale({ x: rocket.pos.x, y: rocket.pos.y }, planet.radius / Math.max(r, 1e-6));
    rocket.vel = { x: 0, y: 0 };
    if (hard) rocket.crashed = true;
  }
}

/** Specific orbital energy (J/kg). Negative = bound orbit. */
export function specificEnergy(pos: Vec2, vel: Vec2, planet: Planet): number {
  const r = len(pos);
  const v2 = vel.x * vel.x + vel.y * vel.y;
  return v2 / 2 - planet.mu / r;
}

/** Helper for tests/predictions: a pure step that returns new pos/vel without mutation. */
export function pureStep(
  pos: Vec2,
  vel: Vec2,
  planet: Planet,
  dt: number,
): { pos: Vec2; vel: Vec2 } {
  const r = len(pos);
  const ax = -(planet.mu * pos.x) / (r * r * r);
  const ay = -(planet.mu * pos.y) / (r * r * r);
  const nv = { x: vel.x + ax * dt, y: vel.y + ay * dt };
  const np = { x: pos.x + nv.x * dt, y: pos.y + nv.y * dt };
  return { pos: np, vel: nv };
}

export const _internal = { add, sub, scale, len };
