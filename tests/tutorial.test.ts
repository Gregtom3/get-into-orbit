import { beforeEach, describe, expect, it } from "vitest";
import { Tutorial } from "../src/tutorial";

// Provide a minimal localStorage for node tests
beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
});

const baseCtx = (overrides: Partial<any> = {}) => ({
  rocket: { t: 0, pos: { x: 0, y: 1 }, vel: { x: 0, y: 0 } } as any,
  el: { apoapsis: 0, periapsis: -1000, e: 1, a: 0, energy: 0, h: 0 } as any,
  altAbove: 0,
  input: { throttle: 0, gimbal: 0, headingMode: "manual" } as any,
  level: { minPeriAlt: 20_000, maxEcc: 0.2 },
  ...overrides,
});

describe("Tutorial", () => {
  it("starts on first run; doesn't auto-start after finish", () => {
    const t = new Tutorial();
    t.maybeStart();
    expect(t.active).toBe(true);
    t.finish();
    const t2 = new Tutorial();
    t2.maybeStart();
    expect(t2.active).toBe(false);
  });

  it("advances steps as their conditions are met", () => {
    const t = new Tutorial();
    t.start();
    expect(t.stepIdx).toBe(0); // welcome
    t.tick(baseCtx({ input: { throttle: 0.5, gimbal: 0, headingMode: "manual" } }));
    expect(t.stepIdx).toBe(1); // ignite
    t.tick(baseCtx({ input: { throttle: 1, gimbal: 0, headingMode: "manual" } }));
    expect(t.stepIdx).toBe(2); // pitch
    t.tick(baseCtx({
      altAbove: 6_000,
      input: { throttle: 1, gimbal: 0.5, headingMode: "manual" },
    }));
    expect(t.stepIdx).toBe(3); // build apoapsis (waits for orbit element growth)
  });

  it("force start resets to step 0", () => {
    const t = new Tutorial();
    t.start();
    t.tick(baseCtx({ input: { throttle: 1, gimbal: 0, headingMode: "manual" } }));
    expect(t.stepIdx).toBeGreaterThan(0);
    t.start();
    expect(t.stepIdx).toBe(0);
    expect(t.active).toBe(true);
  });
});
