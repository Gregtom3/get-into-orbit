import { describe, expect, it } from "vitest";
import {
  airDensity,
  dragAccel,
  gravity,
  massFlow,
  pureStep,
  specificEnergy,
  step,
  thrustAccel,
  type Planet,
  type Rocket,
} from "../src/physics";

const earthish: Planet = {
  mu: 3.986e14,
  radius: 6_371_000,
  atmoScaleHeight: 8_500,
  atmoSeaLevelDensity: 1.225,
  atmoTop: 100_000,
};

const moonish: Planet = {
  mu: 4.9e12,
  radius: 1_737_000,
  atmoScaleHeight: 0,
  atmoSeaLevelDensity: 0,
  atmoTop: 0,
};

function makeRocket(overrides: Partial<Rocket> = {}): Rocket {
  return {
    pos: { x: 0, y: earthish.radius + 100 },
    vel: { x: 0, y: 0 },
    heading: Math.PI / 2,
    throttle: 0,
    mass: 1000,
    dryMass: 400,
    thrust: 20_000,
    isp: 280,
    area: 1,
    cd: 0.3,
    crashed: false,
    t: 0,
    ...overrides,
  };
}

describe("gravity", () => {
  it("points toward planet center", () => {
    const g = gravity({ x: 0, y: earthish.radius }, earthish);
    expect(g.x).toBeCloseTo(0, 6);
    expect(g.y).toBeLessThan(0);
  });

  it("matches surface g ≈ 9.81 on Earth-like body", () => {
    const g = gravity({ x: 0, y: earthish.radius }, earthish);
    expect(Math.abs(g.y)).toBeCloseTo(9.82, 1);
  });

  it("falls off as 1/r^2", () => {
    const g1 = gravity({ x: 0, y: earthish.radius }, earthish);
    const g2 = gravity({ x: 0, y: earthish.radius * 2 }, earthish);
    expect(Math.abs(g1.y) / Math.abs(g2.y)).toBeCloseTo(4, 2);
  });
});

describe("atmosphere", () => {
  it("density decays exponentially", () => {
    const sea = airDensity(0, earthish);
    const oneScale = airDensity(earthish.atmoScaleHeight, earthish);
    expect(sea).toBeCloseTo(1.225, 3);
    expect(oneScale / sea).toBeCloseTo(Math.exp(-1), 3);
  });

  it("zero above atmoTop", () => {
    expect(airDensity(earthish.atmoTop + 1, earthish)).toBe(0);
  });

  it("zero on airless body", () => {
    expect(airDensity(0, moonish)).toBe(0);
  });
});

describe("thrust and mass flow", () => {
  it("zero when throttle is zero", () => {
    const r = makeRocket({ throttle: 0 });
    expect(thrustAccel(r)).toEqual({ x: 0, y: 0 });
    expect(massFlow(r)).toBe(0);
  });

  it("thrust direction follows heading", () => {
    const r = makeRocket({ throttle: 1, heading: 0 });
    const a = thrustAccel(r);
    expect(a.x).toBeGreaterThan(0);
    expect(a.y).toBeCloseTo(0, 6);
  });

  it("mass flow obeys Tsiolkovsky", () => {
    const r = makeRocket({ throttle: 1 });
    const expected = r.thrust / (r.isp * 9.80665);
    expect(massFlow(r)).toBeCloseTo(expected, 3);
  });

  it("no thrust when out of fuel", () => {
    const r = makeRocket({ throttle: 1, mass: 400, dryMass: 400 });
    expect(thrustAccel(r)).toEqual({ x: 0, y: 0 });
    expect(massFlow(r)).toBe(0);
  });
});

describe("drag", () => {
  it("opposes velocity", () => {
    const r = makeRocket({
      pos: { x: 0, y: earthish.radius + 1000 },
      vel: { x: 100, y: 0 },
    });
    const d = dragAccel(r, earthish);
    expect(d.x).toBeLessThan(0);
    expect(d.y).toBeCloseTo(0, 6);
  });

  it("zero in vacuum", () => {
    const r = makeRocket({
      pos: { x: 0, y: moonish.radius + 100 },
      vel: { x: 100, y: 0 },
    });
    expect(dragAccel(r, moonish)).toEqual({ x: 0, y: 0 });
  });
});

describe("integration — circular orbit conservation", () => {
  // Place a body in a perfect circular orbit, integrate forward, verify radius
  // and energy stay (nearly) constant.
  it("keeps a circular orbit roughly stable on Earth-like body", () => {
    const r0 = earthish.radius + 400_000; // 400 km
    const vCirc = Math.sqrt(earthish.mu / r0);
    let pos = { x: r0, y: 0 };
    let vel = { x: 0, y: vCirc };
    const e0 = specificEnergy(pos, vel, earthish);

    const dt = 1; // 1s
    const steps = 60 * 60; // 1 hour
    for (let i = 0; i < steps; i++) {
      const s = pureStep(pos, vel, earthish, dt);
      pos = s.pos;
      vel = s.vel;
    }

    const r = Math.hypot(pos.x, pos.y);
    const e = specificEnergy(pos, vel, earthish);
    // Symplectic Euler keeps energy bounded; allow 1% drift over an hour.
    expect(Math.abs(r - r0) / r0).toBeLessThan(0.01);
    expect(Math.abs(e - e0) / Math.abs(e0)).toBeLessThan(0.01);
  });
});

describe("integration — free fall", () => {
  it("falls toward surface under gravity alone", () => {
    const r = makeRocket({
      pos: { x: 0, y: earthish.radius + 1000 },
      vel: { x: 0, y: 0 },
      throttle: 0,
    });
    for (let i = 0; i < 5; i++) step(r, earthish, 0.1);
    // After 0.5s, should have fallen by ~1.23 m (½ g t²).
    const altDrop = earthish.radius + 1000 - r.pos.y;
    expect(altDrop).toBeGreaterThan(1.0);
    expect(altDrop).toBeLessThan(1.5);
  });

  it("sets crashed flag on hard impact", () => {
    const r = makeRocket({
      pos: { x: 0, y: earthish.radius + 50 },
      vel: { x: 0, y: -100 },
      throttle: 0,
    });
    for (let i = 0; i < 20; i++) step(r, earthish, 0.1);
    expect(r.crashed).toBe(true);
  });
});

describe("integration — thrust-driven mass loss", () => {
  it("burns fuel only while throttle is on", () => {
    const r = makeRocket({ throttle: 1 });
    const m0 = r.mass;
    for (let i = 0; i < 10; i++) step(r, earthish, 0.1);
    expect(r.mass).toBeLessThan(m0);
    expect(r.mass).toBeGreaterThan(r.dryMass);
  });
});
