import type { Planet, Rocket } from "./physics";

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
    heading: Math.PI / 2, // straight up
    throttle: 0,
    mass: 1,
    dryMass: 0.4,
    thrust: 1,
    isp: 280,
    area: 1,
    cd: 0.3,
    crashed: false,
    t: 0,
    ...overrides,
  };
}

// Tiny moon — easy first launch. TWR ~2, plenty of fuel.
export const HOP: Level = (() => {
  const planet: Planet = {
    mu: 4.9e12, // Moon-ish
    radius: 1_737_000,
    atmoScaleHeight: 0,
    atmoSeaLevelDensity: 0,
    atmoTop: 0,
  };
  return {
    id: "hop",
    name: "HOP",
    blurb: "Reach orbit. No atmosphere. Light gravity.",
    planet,
    rocket: rocketAtSurface(planet, {
      mass: 4_000,
      dryMass: 1_400,
      thrust: 14_000, // surface g ≈ 1.62 → weight ≈ 6480N → TWR ≈ 2.2 (forgiving but not silly)
      isp: 320,
      area: 2,
      cd: 0.3,
    }),
    minPeriAlt: 20_000,
    maxEcc: 0.2,
  };
})();
