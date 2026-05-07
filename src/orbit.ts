import { cross, len, type Vec2 } from "./vec2";
import type { Planet } from "./physics";

export interface OrbitElements {
  /** Semi-major axis (m). Negative for hyperbolic trajectories. */
  a: number;
  /** Eccentricity (dimensionless). */
  e: number;
  /** Apoapsis distance from planet center (m). Infinity if e>=1. */
  apoapsis: number;
  /** Periapsis distance from planet center (m). */
  periapsis: number;
  /** Specific orbital energy (J/kg). */
  energy: number;
  /** Specific angular momentum (m^2/s, signed in 2D). */
  h: number;
}

/**
 * Compute Keplerian elements from a planet-centered state vector.
 * Works in 2D; uses scalar h = x*vy - y*vx.
 */
export function elements(pos: Vec2, vel: Vec2, planet: Planet): OrbitElements {
  const r = len(pos);
  const v2 = vel.x * vel.x + vel.y * vel.y;
  const energy = v2 / 2 - planet.mu / r;
  const h = cross(pos, vel);

  // Semi-major axis: a = -mu/(2*epsilon)
  const a = -planet.mu / (2 * energy);

  // Eccentricity vector magnitude: e = sqrt(1 + 2*epsilon*h^2 / mu^2)
  const inside = 1 + (2 * energy * h * h) / (planet.mu * planet.mu);
  const e = Math.sqrt(Math.max(0, inside));

  let apoapsis: number;
  let periapsis: number;
  if (e < 1) {
    apoapsis = a * (1 + e);
    periapsis = a * (1 - e);
  } else {
    // Parabolic / hyperbolic — periapsis = h^2/mu / (1+e), apoapsis unbounded.
    periapsis = (h * h) / (planet.mu * (1 + e));
    apoapsis = Infinity;
  }

  return { a, e, apoapsis, periapsis, energy, h };
}

/** Stable orbit: bound (e<1) AND periapsis above the atmosphere top. */
export function isStableOrbit(
  pos: Vec2,
  vel: Vec2,
  planet: Planet,
  marginM = 0,
): boolean {
  const el = elements(pos, vel, planet);
  if (el.e >= 1) return false;
  const minPeriR = planet.radius + planet.atmoTop + marginM;
  return el.periapsis >= minPeriR;
}

/** Convert apsis distance to altitude above surface (m). */
export const altitudeOf = (rFromCenter: number, planet: Planet): number =>
  rFromCenter - planet.radius;
