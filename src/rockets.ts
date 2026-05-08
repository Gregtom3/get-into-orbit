/**
 * Wireframe rocket silhouettes. Each shape is a list of polylines in a local
 * coordinate frame where +y is the direction of thrust ("down" out of the
 * nozzle), and the nose points in -y. Units are arbitrary — the renderer
 * scales by the chosen size.
 */

export interface RocketShape {
  id: RocketKind;
  /** Display name. */
  name: string;
  /** Polylines (lists of [x, y] points) drawn as connected line strokes. */
  lines: Array<Array<[number, number]>>;
  /** Where the flame attaches (engine bell origin), in shape units. */
  flameOrigin: [number, number];
  /** Half-width of the flame base. */
  flameHalfWidth: number;
  /** Bounding half-extent used to scale to a target on-screen pixel size. */
  extent: number;
}

export type RocketKind = "scout" | "lifter" | "heavy";

/** Small two-fin sounding rocket — the HOP rocket. */
export const SCOUT: RocketShape = {
  id: "scout",
  name: "SCOUT",
  extent: 1,
  flameOrigin: [0, 0.7],
  flameHalfWidth: 0.35,
  lines: [
    // body outline
    [
      [0, -1.0],
      [0.35, -0.5],
      [0.35, 0.55],
      [-0.35, 0.55],
      [-0.35, -0.5],
      [0, -1.0],
    ],
    // belt
    [
      [-0.35, 0.0],
      [0.35, 0.0],
    ],
    // fins
    [
      [-0.35, 0.55],
      [-0.65, 0.85],
      [-0.35, 0.35],
    ],
    [
      [0.35, 0.55],
      [0.65, 0.85],
      [0.35, 0.35],
    ],
    // nozzle
    [
      [-0.2, 0.55],
      [-0.3, 0.7],
      [0.3, 0.7],
      [0.2, 0.55],
    ],
  ],
};

/** Medium two-stage lifter with a gridfin look. */
export const LIFTER: RocketShape = {
  id: "lifter",
  name: "LIFTER",
  extent: 1.1,
  flameOrigin: [0, 0.95],
  flameHalfWidth: 0.45,
  lines: [
    // capsule
    [
      [0, -1.1],
      [0.25, -0.85],
      [0.25, -0.55],
      [-0.25, -0.55],
      [-0.25, -0.85],
      [0, -1.1],
    ],
    // shoulder
    [
      [-0.25, -0.55],
      [-0.45, -0.4],
      [-0.45, 0.85],
      [0.45, 0.85],
      [0.45, -0.4],
      [0.25, -0.55],
    ],
    // belts
    [
      [-0.45, -0.1],
      [0.45, -0.1],
    ],
    [
      [-0.45, 0.4],
      [0.45, 0.4],
    ],
    // grid fins
    [
      [-0.45, -0.4],
      [-0.65, -0.4],
      [-0.65, -0.15],
      [-0.45, -0.15],
    ],
    [
      [0.45, -0.4],
      [0.65, -0.4],
      [0.65, -0.15],
      [0.45, -0.15],
    ],
    // nozzle cluster
    [
      [-0.4, 0.85],
      [-0.45, 0.95],
      [-0.15, 0.95],
      [-0.1, 0.85],
    ],
    [
      [0.4, 0.85],
      [0.45, 0.95],
      [0.15, 0.95],
      [0.1, 0.85],
    ],
  ],
};

/** Heavy three-core lifter (Falcon Heavy / Energia silhouette). */
export const HEAVY: RocketShape = {
  id: "heavy",
  name: "HEAVY",
  extent: 1.4,
  flameOrigin: [0, 1.05],
  flameHalfWidth: 0.85,
  lines: [
    // center core
    [
      [0, -1.25],
      [0.3, -0.95],
      [0.3, 0.95],
      [-0.3, 0.95],
      [-0.3, -0.95],
      [0, -1.25],
    ],
    // left booster
    [
      [-0.3, -0.55],
      [-0.55, -0.3],
      [-0.55, 0.85],
      [-0.3, 0.85],
    ],
    [
      [-0.55, -0.3],
      [-0.4, -0.5],
      [-0.4, -0.65],
    ],
    // right booster
    [
      [0.3, -0.55],
      [0.55, -0.3],
      [0.55, 0.85],
      [0.3, 0.85],
    ],
    [
      [0.55, -0.3],
      [0.4, -0.5],
      [0.4, -0.65],
    ],
    // belts
    [
      [-0.3, 0.0],
      [0.3, 0.0],
    ],
    [
      [-0.55, 0.4],
      [0.55, 0.4],
    ],
    // nozzles
    [
      [-0.55, 0.85],
      [-0.55, 1.05],
      [-0.3, 1.05],
      [-0.3, 0.85],
    ],
    [
      [-0.2, 0.95],
      [-0.2, 1.05],
      [0.2, 1.05],
      [0.2, 0.95],
    ],
    [
      [0.55, 0.85],
      [0.55, 1.05],
      [0.3, 1.05],
      [0.3, 0.85],
    ],
  ],
};

export const SHAPES: Record<RocketKind, RocketShape> = {
  scout: SCOUT,
  lifter: LIFTER,
  heavy: HEAVY,
};

export const SHAPE_LIST: RocketShape[] = [SCOUT, LIFTER, HEAVY];
