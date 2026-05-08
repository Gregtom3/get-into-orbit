import { describe, expect, it } from "vitest";
import { HOP } from "../src/levels";
import { step, type Rocket } from "../src/physics";
import { elements, isStableOrbit } from "../src/orbit";
import { len } from "../src/vec2";

/**
 * End-to-end: prove the level is winnable. Drives the rocket via a simple
 * gravity-turn flight plan and verifies a stable orbit is reached. If this
 * test fails, the level is not solvable with the configured rocket.
 */
describe("HOP level: scripted launch reaches orbit", () => {
  it("achieves a stable orbit within fuel budget", () => {
    const r0 = HOP.rocket;
    const rocket: Rocket = {
      pos: { x: r0.pos.x, y: r0.pos.y },
      vel: { x: r0.vel.x, y: r0.vel.y },
      heading: r0.heading,
      throttle: 1,
      mass: r0.mass,
      dryMass: r0.dryMass,
      thrust: r0.thrust,
      isp: r0.isp,
      area: r0.area,
      cd: r0.cd,
      crashed: false,
      t: 0,
    };
    const planet = HOP.planet;

    const dt = 0.05;
    const maxTime = 300; // s — game pacing target
    let t = 0;

    while (t < maxTime) {
      const r = len(rocket.pos);
      const alt = r - planet.radius;

      // Express heading as pitch from local vertical (radial). 0 = straight up,
      // π/2 = locally horizontal (prograde tangent to surface).
      // Convert pitch -> world heading using current radial direction.
      const radialAngle = Math.atan2(rocket.pos.y, rocket.pos.x);
      let pitchFromVertical: number;
      // Scaled gravity turn for the 60 km HOP planet.
      if (alt < 800) pitchFromVertical = 0;
      else if (alt < 6_000) {
        const f = (alt - 800) / 5_200;
        pitchFromVertical = f * (Math.PI / 2);
      } else pitchFromVertical = Math.PI / 2;
      rocket.heading = radialAngle - pitchFromVertical;

      const el = elements(rocket.pos, rocket.vel, planet);
      const apoAlt = el.apoapsis - planet.radius;
      const periAlt = el.periapsis - planet.radius;
      const targetApo = HOP.minPeriAlt + 500;

      const haveApo = el.e < 1 && apoAlt < targetApo;
      const notBoundYet = el.e >= 1;
      if (notBoundYet || haveApo) {
        rocket.throttle = 1;
      } else if (periAlt < HOP.minPeriAlt) {
        const nearApo = Math.abs(r - el.apoapsis) < 400;
        rocket.throttle = nearApo ? 1 : 0;
      } else {
        rocket.throttle = 0;
      }

      step(rocket, planet, dt);
      t += dt;

      if (rocket.crashed) break;
      if (
        isStableOrbit(rocket.pos, rocket.vel, planet) &&
        periAlt >= HOP.minPeriAlt &&
        el.e <= HOP.maxEcc
      ) {
        break;
      }
    }

    expect(rocket.crashed).toBe(false);
    const el = elements(rocket.pos, rocket.vel, planet);
    expect(el.e).toBeLessThan(1); // bound
    expect(el.periapsis - planet.radius).toBeGreaterThan(HOP.minPeriAlt);
    expect(rocket.mass).toBeGreaterThan(rocket.dryMass); // didn't run dry
    // Game pacing: a competent flight reaches orbit in under 3 minutes.
    expect(rocket.t).toBeLessThan(180);
  }, 10_000);
});
