import type { Planet, Rocket } from "./physics";
import type { RocketKind } from "./rockets";

export interface Level {
  id: string;
  name: string;
  blurb: string;
  planet: Planet;
  rocket: Rocket;
  /** Required minimum periapsis altitude above surface (m) for win. */
  minPeriAlt: number;
  /** Required maximum eccentricity for win. */
  maxEcc: number;
}

/**
 * NOTE on scale: these are GAME planets, not realistic ones. Physics is
 * Newtonian and self-consistent, but radii are 1/30–1/100 of real bodies so
 * launches reach orbit in roughly 60–90 seconds of play time instead of
 * thousands of seconds. The orbital-mechanics intuition (apoapsis/periapsis,
 * gravity turns, circularization burns) all still applies.
 */

function rocketAtSurface(planet: Planet, overrides: Partial<Rocket>): Rocket {
  const surface = { x: 0, y: planet.radius + 1 };
  return {
    pos: surface,
    vel: { x: 0, y: 0 },
    heading: Math.PI / 2,
    throttle: 0,
    mass: 1,
    dryMass: 0.4,
    thrust: 1,
    isp: 280,
    area: 1,
    cd: 0.3,
    crashed: false,
    t: 0,
    shape: "scout" as RocketKind,
    ...overrides,
  };
}

// --- HOP: tiny rocky body, no atmosphere ---
// radius 60 km, surface g ≈ 1.5 m/s², circular orbit ~300 m/s.
// Target a 5 km circular orbit. Reachable in ~60-80 seconds at full burn.
export const HOP: Level = (() => {
  const radius = 60_000;
  const g = 1.5;
  const planet: Planet = {
    mu: g * radius * radius, // 5.4e9
    radius,
    atmoScaleHeight: 0,
    atmoSeaLevelDensity: 0,
    atmoTop: 0,
  };
  return {
    id: "hop",
    name: "HOP",
    blurb: "No air. Reach 5 km orbit.",
    planet,
    rocket: rocketAtSurface(planet, {
      mass: 4_000,
      dryMass: 1_400,
      // Surface weight ≈ 6 kN, TWR ≈ 2.7. Snappy launch.
      thrust: 16_000,
      isp: 320,
      area: 2,
      cd: 0.3,
      shape: "scout",
    }),
    minPeriAlt: 5_000,
    maxEcc: 0.25,
  };
})();

// --- ASCENT: Earth-flavor with a real atmosphere to push through ---
// radius 200 km, g ≈ 4.5 m/s², atmo top 25 km. Target 25 km orbit.
export const ASCENT: Level = (() => {
  const radius = 200_000;
  const g = 4.5;
  const planet: Planet = {
    mu: g * radius * radius, // 1.8e11
    radius,
    atmoScaleHeight: 4_000,
    atmoSeaLevelDensity: 1.2,
    atmoTop: 25_000,
  };
  return {
    id: "ascent",
    name: "ASCENT",
    blurb: "Atmosphere. 25 km orbit.",
    planet,
    rocket: rocketAtSurface(planet, {
      mass: 80_000,
      dryMass: 22_000,
      // Surface weight = 360 kN, TWR ≈ 1.6.
      thrust: 580_000,
      isp: 320,
      area: 6,
      cd: 0.3,
      shape: "lifter",
    }),
    minPeriAlt: 25_000,
    maxEcc: 0.18,
  };
})();

// --- HEAVY: dense world, beefier rocket ---
// radius 300 km, g ≈ 7, atmo top 35 km. Target 50 km orbit.
export const HEAVY_LIFT: Level = (() => {
  const radius = 300_000;
  const g = 7;
  const planet: Planet = {
    mu: g * radius * radius, // 6.3e11
    radius,
    atmoScaleHeight: 5_000,
    atmoSeaLevelDensity: 1.6,
    atmoTop: 35_000,
  };
  return {
    id: "heavy",
    name: "HEAVY",
    blurb: "Heavy world. 50 km orbit.",
    planet,
    rocket: rocketAtSurface(planet, {
      mass: 220_000,
      dryMass: 60_000,
      // Surface weight = 1.54 MN, TWR ≈ 1.5.
      thrust: 2_300_000,
      isp: 330,
      area: 12,
      cd: 0.32,
      shape: "heavy",
    }),
    minPeriAlt: 50_000,
    maxEcc: 0.2,
  };
})();

export const LEVELS: Level[] = [HOP, ASCENT, HEAVY_LIFT];

export function levelById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}
