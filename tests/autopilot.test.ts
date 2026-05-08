import { describe, expect, it } from "vitest";
import { angleDelta, slewHeading, targetHeading, wrapAngle } from "../src/autopilot";

describe("wrapAngle", () => {
  it("wraps into [-π, π]", () => {
    expect(wrapAngle(0)).toBeCloseTo(0);
    expect(wrapAngle(Math.PI + 0.1)).toBeCloseTo(-Math.PI + 0.1, 6);
    expect(wrapAngle(-Math.PI - 0.1)).toBeCloseTo(Math.PI - 0.1, 6);
  });
});

describe("angleDelta", () => {
  it("takes the short way around", () => {
    expect(angleDelta(0.1, -0.1)).toBeCloseTo(-0.2, 6);
    expect(angleDelta(-3, 3)).toBeCloseTo(-2 * Math.PI + 6, 6); // negative, short way
  });
});

describe("targetHeading", () => {
  it("manual returns the user heading", () => {
    expect(targetHeading("manual", { x: 1, y: 0 }, { x: 0, y: 1 }, 0.42)).toBe(0.42);
  });
  it("prograde points along velocity", () => {
    const h = targetHeading("prograde", { x: 0, y: 1 }, { x: 1, y: 0 }, 0);
    expect(h).toBeCloseTo(0, 6);
  });
  it("retrograde is prograde + π", () => {
    const h = targetHeading("retrograde", { x: 0, y: 1 }, { x: 1, y: 0 }, 0);
    expect(Math.abs(wrapAngle(h - Math.PI))).toBeLessThan(1e-6);
  });
  it("radial-out points away from planet center", () => {
    const h = targetHeading("radial-out", { x: 0, y: 5 }, { x: 0, y: 0 }, 0);
    expect(h).toBeCloseTo(Math.PI / 2, 6);
  });
  it("falls back to manual at rest for prograde", () => {
    expect(targetHeading("prograde", { x: 0, y: 1 }, { x: 0, y: 0 }, 1.23)).toBe(1.23);
  });
});

describe("slewHeading", () => {
  it("snaps when within one step", () => {
    expect(slewHeading(0, 0.05, 1, 0.1)).toBeCloseTo(0.05, 6);
  });
  it("rotates by maxRate*dt toward target otherwise", () => {
    const r = slewHeading(0, 1, 1, 0.1);
    expect(r).toBeCloseTo(0.1, 6);
  });
  it("takes the short way", () => {
    // 0 → π+0.1: short way is negative direction.
    const r = slewHeading(0, Math.PI + 0.1, 10, 0.01);
    expect(r).toBeLessThan(0);
  });
});
