/**
 * Lightweight 3D wireframe sphere. Generates lat/lon great-circle segments,
 * rotates them around Y, and projects to 2D using a simple orthographic
 * projection (cheap, works fine for our top-down camera).
 *
 * Output is a list of 2D polylines in unit-sphere coordinates; the caller
 * scales to the planet radius and translates to screen space. Back-facing
 * segments are culled.
 */

export interface Sphere3DPolyline {
  /** Each point is [x, y] in unit-sphere screen coords (z>0 is "toward viewer"). */
  pts: Array<[number, number]>;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Pre-built unit-sphere wireframe (computed once). */
const PARALLELS = 7; // not counting equator
const MERIDIANS = 12;
const SEGS_PER_LINE = 48;

interface BuiltSegment {
  pts: Vec3[];
}

const PARALLEL_SEGS: BuiltSegment[] = [];
const MERIDIAN_SEGS: BuiltSegment[] = [];

(function build() {
  // Parallels (lines of latitude). Latitudes from -75° to +75° spaced evenly.
  for (let i = 1; i <= PARALLELS; i++) {
    const lat = -Math.PI / 2 + (i * Math.PI) / (PARALLELS + 1);
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const seg: Vec3[] = [];
    for (let j = 0; j <= SEGS_PER_LINE; j++) {
      const lon = (j / SEGS_PER_LINE) * Math.PI * 2;
      seg.push({ x: cosLat * Math.cos(lon), y: sinLat, z: cosLat * Math.sin(lon) });
    }
    PARALLEL_SEGS.push({ pts: seg });
  }
  // Meridians (lines of longitude).
  for (let i = 0; i < MERIDIANS; i++) {
    const lon = (i / MERIDIANS) * Math.PI * 2;
    const cosLon = Math.cos(lon);
    const sinLon = Math.sin(lon);
    const seg: Vec3[] = [];
    for (let j = 0; j <= SEGS_PER_LINE; j++) {
      const lat = -Math.PI / 2 + (j / SEGS_PER_LINE) * Math.PI;
      seg.push({ x: Math.cos(lat) * cosLon, y: Math.sin(lat), z: Math.cos(lat) * sinLon });
    }
    MERIDIAN_SEGS.push({ pts: seg });
  }
})();

/**
 * Project the wireframe to 2D, rotating around Y by `yawRad` and tilting
 * around X by `pitchRad`. Returns front-facing line segments (z>=0 in camera
 * space) as polylines in unit-sphere screen coordinates.
 */
export function projectSphere(yawRad: number, pitchRad = 0.35): Sphere3DPolyline[] {
  const cy = Math.cos(yawRad);
  const sy = Math.sin(yawRad);
  const cp = Math.cos(pitchRad);
  const sp = Math.sin(pitchRad);

  const out: Sphere3DPolyline[] = [];

  const project = (segs: BuiltSegment[]) => {
    for (const seg of segs) {
      let current: Array<[number, number]> = [];
      for (const p of seg.pts) {
        // Yaw around Y
        const x1 = p.x * cy + p.z * sy;
        const z1 = -p.x * sy + p.z * cy;
        const y1 = p.y;
        // Pitch around X (tilt the globe so the equator isn't dead-on)
        const y2 = y1 * cp - z1 * sp;
        const z2 = y1 * sp + z1 * cp;
        if (z2 >= -0.05) {
          current.push([x1, y2]);
        } else if (current.length > 0) {
          out.push({ pts: current });
          current = [];
        }
      }
      if (current.length > 0) out.push({ pts: current });
    }
  };

  project(PARALLEL_SEGS);
  project(MERIDIAN_SEGS);
  return out;
}
