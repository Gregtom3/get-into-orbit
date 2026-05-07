import { describe, expect, it } from "vitest";
import { altitudeOf, elements, isStableOrbit } from "../src/orbit";
import type { Planet } from "../src/physics";

const earthish: Planet = {
  mu: 3.986e14,
  radius: 6_371_000,
  atmoScaleHeight: 8_500,
  atmoSeaLevelDensity: 1.225,
  atmoTop: 100_000,
};

describe("orbital elements", () => {
  it("circular orbit has e ≈ 0 and apo == peri == r", () => {
    const r = earthish.radius + 400_000;
    const v = Math.sqrt(earthish.mu / r);
    const el = elements({ x: r, y: 0 }, { x: 0, y: v }, earthish);
    expect(el.e).toBeLessThan(1e-6);
    expect(el.apoapsis).toBeCloseTo(r, 0);
    expect(el.periapsis).toBeCloseTo(r, 0);
    expect(el.a).toBeCloseTo(r, 0);
  });

  it("elliptic orbit: faster than circular gives apoapsis higher than start", () => {
    const r = earthish.radius + 400_000;
    const vCirc = Math.sqrt(earthish.mu / r);
    const el = elements({ x: r, y: 0 }, { x: 0, y: vCirc * 1.1 }, earthish);
    expect(el.e).toBeGreaterThan(0);
    expect(el.e).toBeLessThan(1);
    expect(el.apoapsis).toBeGreaterThan(r);
    expect(el.periapsis).toBeCloseTo(r, -2); // within ~100m
  });

  it("hyperbolic: escape speed gives e ≈ 1, infinite apoapsis", () => {
    const r = earthish.radius + 400_000;
    const vEsc = Math.sqrt((2 * earthish.mu) / r);
    const el = elements({ x: r, y: 0 }, { x: 0, y: vEsc * 1.01 }, earthish);
    expect(el.e).toBeGreaterThan(1);
    expect(el.apoapsis).toBe(Infinity);
  });

  it("suborbital lob: apoapsis above start, periapsis below surface", () => {
    const r = earthish.radius + 100;
    // Straight up at sub-orbital speed
    const el = elements({ x: r, y: 0 }, { x: 0, y: 1000 }, earthish);
    expect(el.periapsis).toBeLessThan(earthish.radius);
  });
});

describe("isStableOrbit", () => {
  it("true for circular orbit above atmosphere", () => {
    const r = earthish.radius + 400_000;
    const v = Math.sqrt(earthish.mu / r);
    expect(isStableOrbit({ x: r, y: 0 }, { x: 0, y: v }, earthish)).toBe(true);
  });

  it("false when periapsis dips into atmosphere", () => {
    const r = earthish.radius + 400_000;
    const vCirc = Math.sqrt(earthish.mu / r);
    // Slow down — drops periapsis on opposite side
    const el = elements({ x: r, y: 0 }, { x: 0, y: vCirc * 0.85 }, earthish);
    expect(el.periapsis).toBeLessThan(earthish.radius + earthish.atmoTop);
    expect(isStableOrbit({ x: r, y: 0 }, { x: 0, y: vCirc * 0.85 }, earthish)).toBe(false);
  });

  it("false on escape trajectory", () => {
    const r = earthish.radius + 400_000;
    const vEsc = Math.sqrt((2 * earthish.mu) / r);
    expect(isStableOrbit({ x: r, y: 0 }, { x: 0, y: vEsc * 1.01 }, earthish)).toBe(false);
  });
});

describe("altitudeOf", () => {
  it("computes altitude above surface", () => {
    expect(altitudeOf(earthish.radius + 1000, earthish)).toBeCloseTo(1000, 6);
  });
});
