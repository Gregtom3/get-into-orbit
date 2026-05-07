import { HOP } from "./levels";
import { step, type Planet, type Rocket } from "./physics";
import { elements, isStableOrbit } from "./orbit";
import { predict } from "./predict";
import {
  COLOR,
  clearFrame,
  drawApsisMarker,
  drawPlanet,
  drawRocket,
  drawStars,
  drawWorldPath,
  fitCamera,
  type Camera,
} from "./render";
import { Input } from "./input";
import { drawHud, drawPills, hudDataOf, type HudData } from "./hud";
import { len } from "./vec2";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

let cam: Camera = { center: { x: 0, y: 0 }, metersPerPx: 5000, vw: 0, vh: 0 };
let dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cam.vw = window.innerWidth;
  cam.vh = window.innerHeight;
  canvas.width = Math.floor(cam.vw * dpr);
  canvas.height = Math.floor(cam.vh * dpr);
  canvas.style.width = `${cam.vw}px`;
  canvas.style.height = `${cam.vh}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  input.layout(cam.vw, cam.vh);
}
const input = new Input(canvas);

window.addEventListener("resize", resize);

// --- game state ---
type Status = "FLY" | "WIN" | "CRASH";
let level = HOP;
let planet: Planet = level.planet;
let rocket: Rocket = cloneRocket(level.rocket);
let initialFuel = rocket.mass - rocket.dryMass;
let status: Status = "FLY";
let winHoldTime = 0; // require orbit to be stable for N seconds before win
let pitchFromVertical = 0; // 0=straight up, +π/2=tangent (east); player-controlled
let lastT = performance.now();
let physAccum = 0;
const PHYS_DT = 1 / 120; // 120 Hz physics
const TURN_RATE = 1.4; // rad/s when gimbal pinned

function cloneRocket(r: Rocket): Rocket {
  return {
    pos: { x: r.pos.x, y: r.pos.y },
    vel: { x: r.vel.x, y: r.vel.y },
    heading: r.heading,
    throttle: 0,
    mass: r.mass,
    dryMass: r.dryMass,
    thrust: r.thrust,
    isp: r.isp,
    area: r.area,
    cd: r.cd,
    crashed: false,
    t: 0,
  };
}

function reset() {
  rocket = cloneRocket(level.rocket);
  initialFuel = rocket.mass - rocket.dryMass;
  status = "FLY";
  winHoldTime = 0;
  pitchFromVertical = 0;
  input.state.throttle = 0;
  input.state.gimbal = 0;
}

resize();

// --- main loop ---
function frame(now: number) {
  const dtReal = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;

  // Edge inputs
  const edges = input.consumeEdges();
  if (edges.reset) reset();

  if (status === "FLY") {
    // Apply input -> rocket commands.
    // Gimbal pitches in the LOCAL frame: the rocket's heading is locked to its
    // current pitch from local vertical, so as it travels around the planet,
    // "straight up" stays "straight up" relative to the surface beneath it.
    rocket.throttle = input.state.throttle;
    pitchFromVertical += input.state.gimbal * TURN_RATE * dtReal;
    pitchFromVertical = Math.max(-Math.PI, Math.min(Math.PI, pitchFromVertical));
    const radial = Math.atan2(rocket.pos.y, rocket.pos.x);
    rocket.heading = radial - pitchFromVertical;

    // Fixed-step physics
    physAccum += dtReal;
    while (physAccum >= PHYS_DT) {
      step(rocket, planet, PHYS_DT);
      physAccum -= PHYS_DT;
    }

    // Win check (sustain for 4s)
    if (rocket.crashed) {
      status = "CRASH";
    } else if (
      isStableOrbit(rocket.pos, rocket.vel, planet) &&
      altitudeAbove(planet) >= level.minPeriAlt
    ) {
      const el = elements(rocket.pos, rocket.vel, planet);
      if (el.e <= level.maxEcc && el.periapsis - planet.radius >= level.minPeriAlt) {
        winHoldTime += dtReal;
        if (winHoldTime > 4) status = "WIN";
      } else {
        winHoldTime = 0;
      }
    } else {
      winHoldTime = 0;
    }
  }

  fitCamera(cam, rocket, planet);
  draw();
  requestAnimationFrame(frame);
}

function altitudeAbove(p: Planet) {
  return Math.hypot(rocket.pos.x, rocket.pos.y) - p.radius;
}

function draw() {
  clearFrame(ctx, cam);
  drawStars(ctx, cam, 7);
  drawPlanet(ctx, planet, cam);

  // Predicted ballistic trajectory (no thrust): show next ~1 orbit worth.
  const r = len(rocket.pos);
  // crude period for prediction window
  const predSec = Math.min(
    1200,
    Math.max(60, 2 * Math.PI * Math.sqrt((r * r * r) / planet.mu) || 600),
  );
  const pred = predict(rocket.pos, rocket.vel, planet, predSec, 1);
  drawWorldPath(ctx, pred.points, cam, { color: COLOR.predict, dash: [4, 6], width: 1 });
  if (pred.apoapsis) drawApsisMarker(ctx, pred.apoapsis, cam, "APO", COLOR.predict);
  if (pred.periapsis) drawApsisMarker(ctx, pred.periapsis, cam, "PER", COLOR.predict);
  if (pred.impact) drawApsisMarker(ctx, pred.impact, cam, "IMPACT", COLOR.warn);

  drawRocket(ctx, rocket, cam);

  // HUD
  const el = elements(rocket.pos, rocket.vel, planet);
  const fuelFrac = initialFuel === 0 ? 0 : Math.max(0, (rocket.mass - rocket.dryMass) / initialFuel);
  const data: HudData = hudDataOf(rocket, el, planet, fuelFrac, status, levelHint());
  drawHud(ctx, cam.vw, data);
  drawPills(ctx, input);
}

function levelHint(): string | undefined {
  if (status !== "FLY") return undefined;
  const el = elements(rocket.pos, rocket.vel, planet);
  const periAlt = el.periapsis - planet.radius;
  if (periAlt < 0) return `${level.name} — RAISE PERIAPSIS ABOVE ${(level.minPeriAlt / 1000).toFixed(0)} km`;
  if (periAlt < level.minPeriAlt) return `${level.name} — PERIAPSIS ${(periAlt / 1000).toFixed(1)} km, NEED ${(level.minPeriAlt / 1000).toFixed(0)} km`;
  if (el.e > level.maxEcc) return `${level.name} — CIRCULARIZE (ECC ${el.e.toFixed(2)})`;
  return `${level.name} — HOLD ORBIT ${(4 - winHoldTime).toFixed(1)}s`;
}

requestAnimationFrame(frame);
