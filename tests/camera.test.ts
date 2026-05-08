import { describe, expect, it } from "vitest";
import { fitCamera, pointOnScreen, worldToScreen, type Camera } from "../src/render";
import { HOP, ASCENT, HEAVY_LIFT } from "../src/levels";
import type { Level } from "../src/levels";
import {
  applyController,
  makeController,
  panByPixels,
  recenter,
  zoomBy,
} from "../src/camera";

const VIEWPORTS = [
  { name: "iphone-se", vw: 320, vh: 568 },
  { name: "iphone-12", vw: 390, vh: 844 },
  { name: "ipad", vw: 768, vh: 1024 },
  { name: "desktop", vw: 1280, vh: 800 },
  { name: "ultra", vw: 2560, vh: 1440 },
];

function newCam(vw: number, vh: number): Camera {
  return { center: { x: 0, y: 0 }, metersPerPx: 1000, vw, vh };
}

/** Place the rocket at altitude `alt` above the planet, at angle `theta` around the planet center. */
function placedRocket(level: Level, alt: number, theta: number) {
  const r = level.planet.radius + alt;
  return {
    ...level.rocket,
    pos: { x: Math.cos(theta) * r, y: Math.sin(theta) * r },
    vel: { x: 0, y: 0 },
  };
}

describe("fitCamera — rocket is always on screen", () => {
  for (const level of [HOP, ASCENT, HEAVY_LIFT]) {
    for (const vp of VIEWPORTS) {
      for (const alt of [0, 1_000, 50_000, 200_000, 1_000_000]) {
        for (const theta of [
          Math.PI / 2, // launch site (+y)
          0, // +x
          Math.PI, // -x
          -Math.PI / 2, // -y
          Math.PI / 4, // diagonal
        ]) {
          it(`${level.id} alt=${alt}m θ=${theta.toFixed(2)} ${vp.name}`, () => {
            const cam = newCam(vp.vw, vp.vh);
            const r = placedRocket(level, alt, theta);
            fitCamera(cam, r, level.planet);
            expect(pointOnScreen(r.pos, cam, 4)).toBe(true);
          });
        }
      }
    }
  }
});

describe("fitCamera — rocket appears at sensible on-screen size", () => {
  it("rocket-to-edge distance is at least 5% of the smaller dimension", () => {
    const cam = newCam(390, 844);
    const r = placedRocket(HOP, 1, Math.PI / 2);
    fitCamera(cam, r, HOP.planet);
    const s = worldToScreen(r.pos, cam);
    const minDim = Math.min(cam.vw, cam.vh);
    // Rocket should not be jammed against any edge.
    expect(s.x).toBeGreaterThan(minDim * 0.05);
    expect(s.y).toBeGreaterThan(minDim * 0.05);
    expect(cam.vw - s.x).toBeGreaterThan(minDim * 0.05);
    expect(cam.vh - s.y).toBeGreaterThan(minDim * 0.05);
  });
});

describe("camera controller — pan, zoom, recenter", () => {
  it("recenter resets to follow with no offset and zoom=1", () => {
    const c = makeController();
    c.follow = false;
    c.zoom = 5;
    c.panOffset = { x: 100, y: -50 };
    recenter(c);
    expect(c.follow).toBe(true);
    expect(c.zoom).toBe(1);
    expect(c.panOffset).toEqual({ x: 0, y: 0 });
  });

  it("panByPixels disables follow and stores meter offset (screen y inverted)", () => {
    const c = makeController();
    const cam = { ...newCam(800, 600), metersPerPx: 1000 };
    panByPixels(c, cam, 10, -5);
    expect(c.follow).toBe(false);
    expect(c.panOffset.x).toBeCloseTo(-10_000); // dx>0 pans world content right → camera shifts left
    expect(c.panOffset.y).toBeCloseTo(-5_000); // dy<0 (finger up) pans content down → camera shifts down (world y down)
  });

  it("zoomBy changes zoom and clamps to bounds", () => {
    const c = makeController();
    const cam = newCam(800, 600);
    zoomBy(c, cam, 0.5); // zoom in by half
    expect(c.zoom).toBeCloseTo(0.5);
    expect(c.follow).toBe(false);
    // way out
    for (let i = 0; i < 100; i++) zoomBy(c, cam, 2);
    expect(c.zoom).toBeLessThanOrEqual(30);
    // way in
    for (let i = 0; i < 200; i++) zoomBy(c, cam, 0.5);
    expect(c.zoom).toBeGreaterThanOrEqual(0.1);
  });

  it("zoomBy with anchor keeps the anchor world-point under the cursor", () => {
    const c = makeController();
    const cam = newCam(800, 600);
    cam.metersPerPx = 1000;
    cam.center = { x: 0, y: 0 };
    // World point under (700,150) before zoom
    const before = {
      x: (700 - 400) * 1000,
      y: -(150 - 300) * 1000,
    };
    zoomBy(c, cam, 0.5, { x: 700, y: 150 });
    applyController(cam, c);
    // Recompute screen position of the same world point — should still be ~(700,150)
    const sx = cam.vw / 2 + (before.x - cam.center.x) / cam.metersPerPx;
    const sy = cam.vh / 2 - (before.y - cam.center.y) / cam.metersPerPx;
    expect(sx).toBeCloseTo(700, 0);
    expect(sy).toBeCloseTo(150, 0);
  });
});

describe("worldToScreen / pointOnScreen", () => {
  it("center maps to viewport center", () => {
    const cam = newCam(800, 600);
    cam.center = { x: 100, y: 200 };
    const s = worldToScreen({ x: 100, y: 200 }, cam);
    expect(s.x).toBeCloseTo(400);
    expect(s.y).toBeCloseTo(300);
  });
  it("y is flipped (world up = screen up)", () => {
    const cam = newCam(800, 600);
    cam.center = { x: 0, y: 0 };
    cam.metersPerPx = 1;
    const s = worldToScreen({ x: 0, y: 100 }, cam);
    expect(s.y).toBeCloseTo(200); // 300 - 100
  });
});
