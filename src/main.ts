import { LEVELS, levelById, type Level } from "./levels";
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
import { slewHeading, targetHeading } from "./autopilot";
import { Menu } from "./menu";
import { applyOverrides, readParams } from "./params";
import { recordScore, bestScore } from "./scores";
import { ensureContext, sfx, setThrust, silence, applySettingsToAudio } from "./audio";
import { settings } from "./settings";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const params = readParams();

let cam: Camera = { center: { x: 0, y: 0 }, metersPerPx: 5000, vw: 0, vh: 0 };
let smoothMpp = 5000; // smoothed metersPerPx for the camera
let dpr = 1;

const input = new Input(canvas);
const menu = new Menu();

type Scene = "menu" | "play";
let scene: Scene = "menu";

type Status = "FLY" | "WIN" | "CRASH";
let level: Level = LEVELS[0]!;
let planet: Planet = level.planet;
let rocket: Rocket = cloneRocket(level.rocket);
let initialFuel = rocket.mass - rocket.dryMass;
let status: Status = "FLY";
let winHoldTime = 0;
let pitchFromVertical = 0;
let lastT = performance.now();
let physAccum = 0;
const PHYS_DT = 1 / 120;
const TURN_RATE_BASE = 1.4; // rad/s

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
  menu.layout(cam.vw, cam.vh);
}
window.addEventListener("resize", resize);
resize();

// Menu pointer handling: separate listener so it works even when game scene
// uses canvas pointer events for sliders. We forward-route on the scene.
canvas.addEventListener("pointerdown", (e) => {
  // First user gesture — boot audio.
  ensureContext();
  applySettingsToAudio();
  if (scene !== "menu") return;
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  const action = menu.hit(x, y);
  if (!action) return;
  e.preventDefault();
  if (action.kind === "play") {
    sfx.uiClick();
    startLevel(action.levelId);
  } else if (action.kind === "openSettings" || action.kind === "closeSettings") {
    sfx.uiClick();
    menu.apply(action);
  } else {
    sfx.uiClick();
    menu.apply(action);
  }
});

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
    shape: r.shape,
  };
}

function startLevel(id: string) {
  const base = levelById(id) ?? LEVELS[0]!;
  level = applyOverrides(base, params);
  planet = level.planet;
  rocket = cloneRocket(level.rocket);
  initialFuel = rocket.mass - rocket.dryMass;
  status = "FLY";
  winHoldTime = 0;
  pitchFromVertical = 0;
  input.state.throttle = 0;
  input.state.gimbal = 0;
  input.state.headingMode = "manual";
  // Initial camera so the first frame doesn't whip into place.
  fitCamera(cam, rocket, planet);
  smoothMpp = cam.metersPerPx;
  scene = "play";
}

function backToMenu() {
  silence();
  scene = "menu";
}

// If a ?level=… is present, skip the menu and launch straight in.
if (params.level) {
  const found = levelById(params.level);
  if (found) startLevel(found.id);
}

// --- main loop ---
function frame(now: number) {
  const dtReal = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;

  if (scene === "menu") {
    drawMenu();
  } else {
    update(dtReal);
    draw();
  }
  requestAnimationFrame(frame);
}

function update(dtReal: number) {
  const edges = input.consumeEdges();
  if (edges.reset) {
    if (status === "FLY") startLevel(level.id);
    else backToMenu();
  }

  if (status === "FLY") {
    rocket.throttle = input.state.throttle;
    setThrust(rocket.throttle);

    if (input.state.headingMode === "manual") {
      pitchFromVertical += input.state.gimbal * TURN_RATE_BASE * settings.sensitivity * dtReal;
      pitchFromVertical = Math.max(-Math.PI, Math.min(Math.PI, pitchFromVertical));
      const radial = Math.atan2(rocket.pos.y, rocket.pos.x);
      rocket.heading = radial - pitchFromVertical;
    } else {
      const want = targetHeading(input.state.headingMode, rocket.pos, rocket.vel, rocket.heading);
      rocket.heading = slewHeading(rocket.heading, want, TURN_RATE_BASE * settings.sensitivity, dtReal);
      const radial = Math.atan2(rocket.pos.y, rocket.pos.x);
      pitchFromVertical = radial - rocket.heading;
    }

    physAccum += dtReal;
    while (physAccum >= PHYS_DT) {
      step(rocket, planet, PHYS_DT);
      physAccum -= PHYS_DT;
    }

    if (rocket.crashed && status === "FLY") {
      status = "CRASH";
      silence();
      sfx.crash();
    } else if (
      isStableOrbit(rocket.pos, rocket.vel, planet) &&
      altitudeAbove(planet) >= level.minPeriAlt
    ) {
      const el = elements(rocket.pos, rocket.vel, planet);
      if (el.e <= level.maxEcc && el.periapsis - planet.radius >= level.minPeriAlt) {
        winHoldTime += dtReal;
        if (winHoldTime > 4) {
          status = "WIN";
          silence();
          sfx.win();
          recordScore(level.id, {
            seconds: rocket.t,
            fuelFrac: Math.max(0, (rocket.mass - rocket.dryMass) / Math.max(initialFuel, 1)),
            ecc: el.e,
            ts: Date.now(),
          });
        }
      } else {
        winHoldTime = 0;
      }
    } else {
      winHoldTime = 0;
    }
  } else {
    silence();
  }

  // Smooth camera zoom: target via fitCamera, ease metersPerPx toward it.
  fitCamera(cam, rocket, planet);
  const k = 1 - Math.exp(-dtReal * 3); // smoothing factor
  smoothMpp = smoothMpp + (cam.metersPerPx - smoothMpp) * k;
  cam.metersPerPx = smoothMpp;
}

function altitudeAbove(p: Planet) {
  return Math.hypot(rocket.pos.x, rocket.pos.y) - p.radius;
}

function draw() {
  clearFrame(ctx, cam);
  drawStars(ctx, cam, 7);
  drawPlanet(ctx, planet, cam);

  const r = len(rocket.pos);
  const predSec = Math.min(
    1500,
    Math.max(60, 2 * Math.PI * Math.sqrt((r * r * r) / planet.mu) || 600),
  );
  const pred = predict(rocket.pos, rocket.vel, planet, predSec, 1);
  drawWorldPath(ctx, pred.points, cam, { color: COLOR.predict, dash: [4, 6], width: 1 });
  if (pred.apoapsis) drawApsisMarker(ctx, pred.apoapsis, cam, "APO", COLOR.predict);
  if (pred.periapsis) drawApsisMarker(ctx, pred.periapsis, cam, "PER", COLOR.predict);
  if (pred.impact) drawApsisMarker(ctx, pred.impact, cam, "IMPACT", COLOR.warn);

  drawRocket(ctx, rocket, cam);

  const el = elements(rocket.pos, rocket.vel, planet);
  const fuelFrac = initialFuel === 0 ? 0 : Math.max(0, (rocket.mass - rocket.dryMass) / initialFuel);
  const data: HudData = hudDataOf(rocket, el, planet, fuelFrac, status, hint());
  drawHud(ctx, cam.vw, data);
  drawPills(ctx, input);

  // Best-score badge at top center
  const best = bestScore(level.id);
  if (best) {
    ctx.fillStyle = COLOR.hudDim;
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      `${level.name}  BEST ${best.seconds.toFixed(1)}s  FUEL ${(best.fuelFrac * 100).toFixed(0)}%`,
      cam.vw / 2,
      cam.vh - 14,
    );
    ctx.textAlign = "left";
  }
}

function drawMenu() {
  clearFrame(ctx, cam);
  drawStars(ctx, cam, 11);
  menu.draw(ctx);
}

function hint(): string | undefined {
  if (status !== "FLY") return undefined;
  const el = elements(rocket.pos, rocket.vel, planet);
  const periAlt = el.periapsis - planet.radius;
  if (periAlt < 0) return `${level.name} — RAISE PERIAPSIS ABOVE ${(level.minPeriAlt / 1000).toFixed(0)} km`;
  if (periAlt < level.minPeriAlt)
    return `${level.name} — PERIAPSIS ${(periAlt / 1000).toFixed(1)} km, NEED ${(level.minPeriAlt / 1000).toFixed(0)} km`;
  if (el.e > level.maxEcc) return `${level.name} — CIRCULARIZE (ECC ${el.e.toFixed(2)})`;
  return `${level.name} — HOLD ORBIT ${(4 - winHoldTime).toFixed(1)}s`;
}

requestAnimationFrame(frame);
