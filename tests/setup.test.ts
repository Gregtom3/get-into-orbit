import { describe, expect, it } from "vitest";
import { applyTuning, DEFAULT_TUNING } from "../src/setup";
import { HOP } from "../src/levels";

describe("applyTuning", () => {
  it("default tuning is identity", () => {
    const out = applyTuning(HOP, DEFAULT_TUNING);
    expect(out.planet.mu).toBe(HOP.planet.mu);
    expect(out.rocket.thrust).toBe(HOP.rocket.thrust);
    expect(out.rocket.mass).toBe(HOP.rocket.mass);
    expect(out.rocket.heading).toBe(HOP.rocket.heading);
  });

  it("scales gravity (mu) multiplicatively", () => {
    const out = applyTuning(HOP, { ...DEFAULT_TUNING, gravityMul: 1.5 });
    expect(out.planet.mu).toBeCloseTo(HOP.planet.mu * 1.5);
  });

  it("scales thrust", () => {
    const out = applyTuning(HOP, { ...DEFAULT_TUNING, thrustMul: 0.7 });
    expect(out.rocket.thrust).toBeCloseTo(HOP.rocket.thrust * 0.7);
  });

  it("scales fuel mass without touching dry mass", () => {
    const out = applyTuning(HOP, { ...DEFAULT_TUNING, fuelMul: 0.5 });
    const fuelOriginal = HOP.rocket.mass - HOP.rocket.dryMass;
    const fuelOut = out.rocket.mass - out.rocket.dryMass;
    expect(fuelOut).toBeCloseTo(fuelOriginal * 0.5);
    expect(out.rocket.dryMass).toBe(HOP.rocket.dryMass);
  });

  it("rotates initial heading by pitch (eastward = positive degrees)", () => {
    const out = applyTuning(HOP, { ...DEFAULT_TUNING, initialPitchDeg: 30 });
    expect(out.rocket.heading).toBeCloseTo(HOP.rocket.heading - (30 * Math.PI) / 180);
  });

  it("does not mutate the input level", () => {
    const before = JSON.stringify(HOP);
    applyTuning(HOP, { ...DEFAULT_TUNING, fuelMul: 0.1, thrustMul: 5 });
    expect(JSON.stringify(HOP)).toBe(before);
  });
});
