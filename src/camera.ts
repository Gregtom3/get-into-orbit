/**
 * Camera controller. Adds user pan / pinch / wheel zoom on top of the
 * auto-fit camera. Pure logic + state — input plumbing lives in `input.ts`
 * and `main.ts`.
 *
 * Coordinate model: `Camera.center` is in world meters, `metersPerPx` is the
 * world distance one CSS pixel covers. The user's contributions are stored as
 * a position offset in meters and a zoom scale that multiplies metersPerPx.
 */

import type { Camera } from "./render";
import type { Vec2 } from "./vec2";

export interface CameraController {
  /** True when auto-fit camera drives the camera; false when user has taken over. */
  follow: boolean;
  /** User pan offset (world meters), applied on top of the auto-center. */
  panOffset: Vec2;
  /** User zoom multiplier; 1 = auto, >1 zoomed out, <1 zoomed in. */
  zoom: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 30;

export function makeController(): CameraController {
  return {
    follow: true,
    panOffset: { x: 0, y: 0 },
    zoom: 1,
  };
}

/** Reset to auto-follow. */
export function recenter(c: CameraController): void {
  c.follow = true;
  c.panOffset = { x: 0, y: 0 };
  c.zoom = 1;
}

/** Convert a delta in screen pixels into a world-meter pan and apply it. */
export function panByPixels(
  c: CameraController,
  cam: Camera,
  dxPx: number,
  dyPx: number,
): void {
  // Engaging the pan disables auto-follow.
  c.follow = false;
  c.panOffset = {
    x: c.panOffset.x - dxPx * cam.metersPerPx,
    y: c.panOffset.y + dyPx * cam.metersPerPx, // screen y down → world y up
  };
}

/** Multiply zoom by `factor`, optionally anchored to a screen-space pixel. */
export function zoomBy(
  c: CameraController,
  cam: Camera,
  factor: number,
  anchorPx?: { x: number; y: number },
): void {
  c.follow = false;
  const newZoom = clamp(c.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const realFactor = newZoom / c.zoom;
  c.zoom = newZoom;

  if (anchorPx) {
    // Keep the anchor world-point fixed under the cursor: shift panOffset to
    // compensate for the zoom-induced shift of that point.
    const dx = anchorPx.x - cam.vw / 2;
    const dy = anchorPx.y - cam.vh / 2;
    const beforeM = { x: dx * cam.metersPerPx, y: -dy * cam.metersPerPx };
    const afterM = { x: beforeM.x * realFactor, y: beforeM.y * realFactor };
    c.panOffset = {
      x: c.panOffset.x + (beforeM.x - afterM.x),
      y: c.panOffset.y + (beforeM.y - afterM.y),
    };
  }
}

/** Apply the controller's offsets to a freshly auto-fitted Camera. */
export function applyController(cam: Camera, c: CameraController): void {
  cam.metersPerPx = cam.metersPerPx * c.zoom;
  if (!c.follow) {
    cam.center = { x: cam.center.x + c.panOffset.x, y: cam.center.y + c.panOffset.y };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
