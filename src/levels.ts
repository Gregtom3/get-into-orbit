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

// --- HOP: tiny moon, no atmosphere, scout rocket ---
export const HOP: Level = (() => {
  const planet: Planet = {
    mu: 4.9e12,
    radius: 1_737_000,
    atmoScaleHeight: 0,
    atmoSeaLevelDensity: 0,
    atmoTop: 0,
  };
  return {
    id: "hop",
    name: "HOP",
    blurb: "Tiny moon. No air. Light gravity. Reach a 20 km orbit.",
    planet,
    rocket: rocketAtSurface(planet, {
      mass: 4_000,
      dryMass: 1_400,
      thrust: 14_000,
      isp: 320,
      area: 2,
      cd: 0.3,
      shape: "scout",
    }),
    minPeriAlt: 20_000,
    maxEcc: 0.2,
  };
})();

// --- ASCENT: Earth-like body with atmosphere, lifter rocket ---
export const ASCENT: Level = (() => {
  const planet: Planet = {
    mu: 3.986e14,
    radius: 6_371_000,
    atmoScaleHeight: 8_500,
    atmoSeaLevelDensity: 1.225,
    atmoTop: 100_000,
  };
  // TWR ~1.4 at surface; mass ratio ~3.5 for ~3.7 km/s ΔV
  return {
    id: "ascent",
    name: "ASCENT",
    blurb: "Earth-like world. Atmosphere fights you. Pitch over above 5 km.",
    planet,
    rocket: rocketAtSurface(planet, {
      mass: 350_000,
      dryMass: 100_000,
      thrust: 4_900_000,
      isp: 320,
      area: 12,
      cd: 0.3,
      shape: "lifter",
    }),
    minPeriAlt: 130_000,
    maxEcc: 0.15,
  };
})();

// --- HEAVY: dense world, beefier rocket ---
export const HEAVY_LIFT: Level = (() => {
  const planet: Planet = {
    mu: 6.0e14, // about 1.5x Earth gravity
    radius: 6_800_000,
    atmoScaleHeight: 9_000,
    atmoSeaLevelDensity: 1.6,
    atmoTop: 110_000,
  };
  return {
    id: "heavy",
    name: "HEAVY",
    blurb: "Heavy world. Dense air. Three cores, brute force.",
    planet,
    rocket: rocketAtSurface(planet, {
      mass: 1_200_000,
      dryMass: 320_000,
      thrust: 22_000_000,
      isp: 330,
      area: 30,
      cd: 0.32,
      shape: "heavy",
    }),
    minPeriAlt: 150_000,
    maxEcc: 0.18,
  };
})();

export const LEVELS: Level[] = [HOP, ASCENT, HEAVY_LIFT];

export function levelById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}
