/**
 * URL query params for live tuning. Examples:
 *   ?level=ascent
 *   ?gravity=2.5     (overrides surface g; mu recomputed)
 *   ?fuel=0.8        (sets initial fuel as fraction of wet mass)
 *   ?thrust=1.5      (multiplies thrust)
 *   ?atmo=0          (disables atmosphere)
 *   ?debug=1         (draw debug arrows)
 *
 * All overrides apply at level-load time. Bad values are ignored.
 */

import type { Level } from "./levels";

export interface UrlParams {
  level: string | null;
  gravity: number | null;
  fuel: number | null;
  thrust: number | null;
  atmo: boolean | null;
  debug: boolean;
}

function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function readParams(search = window.location.search): UrlParams {
  const u = new URLSearchParams(search);
  return {
    level: u.get("level"),
    gravity: num(u.get("gravity")),
    fuel: num(u.get("fuel")),
    thrust: num(u.get("thrust")),
    atmo: u.has("atmo") ? u.get("atmo") !== "0" : null,
    debug: u.get("debug") === "1",
  };
}

/** Apply URL overrides to a freshly-loaded level (returns a new Level). */
export function applyOverrides(level: Level, p: UrlParams): Level {
  const planet = { ...level.planet };
  const rocket = { ...level.rocket, pos: { ...level.rocket.pos }, vel: { ...level.rocket.vel } };

  if (p.gravity != null && p.gravity > 0) {
    // mu = g * r^2 (surface g override)
    planet.mu = p.gravity * planet.radius * planet.radius;
  }
  if (p.atmo === false) {
    planet.atmoScaleHeight = 0;
    planet.atmoSeaLevelDensity = 0;
    planet.atmoTop = 0;
  }
  if (p.thrust != null && p.thrust > 0) {
    rocket.thrust = rocket.thrust * p.thrust;
  }
  if (p.fuel != null && p.fuel >= 0 && p.fuel <= 1) {
    rocket.mass = rocket.dryMass + (rocket.mass - rocket.dryMass) * p.fuel;
  }

  return { ...level, planet, rocket };
}
