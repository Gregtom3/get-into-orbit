import { describe, expect, it } from "vitest";
import { isBetter, type ScoreRecord } from "../src/scores";

const make = (overrides: Partial<ScoreRecord> = {}): ScoreRecord => ({
  seconds: 100,
  fuelFrac: 0.4,
  ecc: 0.05,
  ts: 0,
  ...overrides,
});

describe("isBetter", () => {
  it("any score beats nothing", () => {
    expect(isBetter(make(), null)).toBe(true);
    expect(isBetter(make(), undefined)).toBe(true);
  });
  it("lower seconds wins", () => {
    expect(isBetter(make({ seconds: 90 }), make({ seconds: 100 }))).toBe(true);
    expect(isBetter(make({ seconds: 110 }), make({ seconds: 100 }))).toBe(false);
  });
  it("on a time tie, more fuel wins", () => {
    expect(isBetter(make({ fuelFrac: 0.5 }), make({ fuelFrac: 0.4 }))).toBe(true);
    expect(isBetter(make({ fuelFrac: 0.3 }), make({ fuelFrac: 0.4 }))).toBe(false);
  });
});
