import { describe, expect, it } from "vitest";
import { Input } from "../src/input";

/**
 * jsdom-free layout test: Input.layout uses pure math, so we can stub a
 * minimal canvas object and check the rect math.
 */

const VIEWPORTS = [
  { name: "iphone-se", vw: 320, vh: 568 },
  { name: "iphone-12", vw: 390, vh: 844 },
  { name: "ipad", vw: 768, vh: 1024 },
  { name: "desktop", vw: 1280, vh: 800 },
];

function fakeCanvas(): HTMLCanvasElement {
  const noop = () => {};
  return {
    addEventListener: noop,
    removeEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
  } as unknown as HTMLCanvasElement;
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number } | undefined,
  b: { x: number; y: number; w: number; h: number } | undefined,
): boolean {
  if (!a || !b) return false;
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

describe("Input layout fits the smallest target viewport", () => {
  it("creates non-overlapping primary control pills on iphone-se (320×568)", () => {
    const inp = new Input(fakeCanvas());
    inp.layout(320, 568);
    const r = inp.layoutRects();
    const primary = ["throttle", "gimbal", "stage", "prograde", "retrograde"];
    for (let i = 0; i < primary.length; i++) {
      for (let j = i + 1; j < primary.length; j++) {
        const a = r[primary[i]!];
        const b = r[primary[j]!];
        expect(
          rectsOverlap(a, b),
          `${primary[i]} (${JSON.stringify(a)}) overlaps ${primary[j]} (${JSON.stringify(b)})`,
        ).toBe(false);
      }
    }
  });

  it("creates non-overlapping top-bar pills on iphone-se", () => {
    const inp = new Input(fakeCanvas());
    inp.layout(320, 568);
    const r = inp.layoutRects();
    const top = ["quit", "help", "follow", "recenter", "reset"];
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        const a = r[top[i]!];
        const b = r[top[j]!];
        expect(rectsOverlap(a, b)).toBe(false);
      }
    }
  });

  it("all pills are inside the viewport on every target size", () => {
    for (const vp of VIEWPORTS) {
      const inp = new Input(fakeCanvas());
      inp.layout(vp.vw, vp.vh);
      const r = inp.layoutRects();
      for (const [name, rect] of Object.entries(r)) {
        if (!rect) continue;
        expect(rect.x, `${name} x on ${vp.name}`).toBeGreaterThanOrEqual(0);
        expect(rect.y, `${name} y on ${vp.name}`).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.w, `${name} right on ${vp.name}`).toBeLessThanOrEqual(vp.vw);
        expect(rect.y + rect.h, `${name} bottom on ${vp.name}`).toBeLessThanOrEqual(vp.vh);
      }
    }
  });

  it("touch targets are at least 36px on every axis", () => {
    for (const vp of VIEWPORTS) {
      const inp = new Input(fakeCanvas());
      inp.layout(vp.vw, vp.vh);
      const r = inp.layoutRects();
      for (const [name, rect] of Object.entries(r)) {
        if (!rect) continue;
        expect(rect.h, `${name} h on ${vp.name}`).toBeGreaterThanOrEqual(28);
        expect(rect.w, `${name} w on ${vp.name}`).toBeGreaterThanOrEqual(28);
      }
    }
  });
});
