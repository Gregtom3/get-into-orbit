import { describe, expect, it } from "vitest";
import { applyOverrides, readParams } from "../src/params";
import { HOP } from "../src/levels";

describe("readParams", () => {
  it("parses defaults to nulls", () => {
    const p = readParams("");
    expect(p.level).toBe(null);
    expect(p.gravity).toBe(null);
    expect(p.debug).toBe(false);
  });
  it("parses values", () => {
    const p = readParams("?level=hop&gravity=2.5&fuel=0.8&thrust=1.5&atmo=0&debug=1");
    expect(p.level).toBe("hop");
    expect(p.gravity).toBe(2.5);
    expect(p.fuel).toBe(0.8);
    expect(p.thrust).toBe(1.5);
    expect(p.atmo).toBe(false);
    expect(p.debug).toBe(true);
  });
  it("ignores garbage numbers", () => {
    const p = readParams("?gravity=cats");
    expect(p.gravity).toBe(null);
  });
});

describe("applyOverrides", () => {
  it("scales thrust", () => {
    const out = applyOverrides(HOP, { ...readParams(""), thrust: 2 });
    expect(out.rocket.thrust).toBeCloseTo(HOP.rocket.thrust * 2);
  });
  it("scales fuel mass", () => {
    const out = applyOverrides(HOP, { ...readParams(""), fuel: 0.5 });
    const fuel = out.rocket.mass - out.rocket.dryMass;
    const original = HOP.rocket.mass - HOP.rocket.dryMass;
    expect(fuel).toBeCloseTo(original * 0.5);
  });
  it("recomputes mu from gravity override", () => {
    const out = applyOverrides(HOP, { ...readParams(""), gravity: 5 });
    expect(out.planet.mu).toBeCloseTo(5 * HOP.planet.radius * HOP.planet.radius);
  });
  it("disables atmosphere with atmo=0", () => {
    const out = applyOverrides(HOP, { ...readParams(""), atmo: false });
    expect(out.planet.atmoTop).toBe(0);
  });
});
