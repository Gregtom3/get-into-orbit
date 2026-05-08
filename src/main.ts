import { LEVELS, levelById, type Level } from "./levels";
import { step, type Planet, type Rocket } from "./physics";
import { elements, isStableOrbit } from "./orbit";
import { predict } from "./predict";
import {
  COLOR,
  clearFrame,
  drawApsisMarker,
  drawOffscreenIndicator,
  drawPlanet,
  drawRocket,
  drawStars,
  drawTerrain,
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
import { applyController, makeController, panByPixels, recenter, zoomBy } from "./camera";
import { applyTuning, SetupScreen } from "./setup";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const params = readParams();

let cam: Camera = { center: { x: 0, y: 0 }, metersPerPx: 5000, vw: 0, vh: 0, rotation: 0 };
let smoothMpp = 5000;
let dpr = 1;

const input = new Input(canvas);
const menu = new Menu();
const setup = new SetupScreen();
const cameraCtrl = makeController();

// Time warp: physics steps per real second multiplier. Cycles 1×→2×→4×→8×→16×.
const WARP_LEVELS = [1, 2, 4, 8, 16] as const;
let warpIdx = 0;
const warpFactor = () => WARP_LEVELS[warpIdx]!;
const cycleWarp = () => {
  warpIdx = (warpIdx + 1) % WARP_LEVELS.length;
};

input.onCamera = (intent) => {
  if (scene !== "play") return;
  if (intent.panPx) panByPixels(cameraCtrl, cam, intent.panPx.dx, intent.panPx.dy);
  if (intent.zoomFactor) zoomBy(cameraCtrl, cam, intent.zoomFactor, intent.zoomAnchor);
};

type Scene = "menu" | "setup" | "play";
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
const TURN_RATE_BASE = 1.4;
let planetYaw = 0; // accumulates over time for the rotating wireframe globe

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
  setup.layout(cam.vw, cam.vh);
}
window.addEventListener("resize", resize);
resize();

// Menu / setup pointer routing.
canvas.addEventListener(
  "pointerdown",
  (e) => {
    ensureContext();
    applySettingsToAudio();
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (scene === "menu") {
      const action = menu.hit(x, y);
      if (!action) return;
      e.preventDefault();
      sfx.uiClick();
      if (action.kind === "play") {
        const lvl = levelById(action.levelId);
        if (lvl) {
          setup.setLevel(lvl);
          scene = "setup";
        }
      } else {
        menu.apply(action);
      }
    } else if (scene === "setup") {
      const a = setup.hit(x, y);
      if (a?.kind === "back") {
        sfx.uiClick();
        scene = "menu";
        e.preventDefault();
      } else if (a?.kind === "launch") {
        sfx.uiClick();
        startLevel(setup.level!.id, true);
        e.preventDefault();
      }
    }
  },
  { capture: true }, // run before Input's listener so menu clicks aren't treated as pan
);

// Drag on setup sliders.
canvas.addEventListener(
  "pointermove",
  (e) => {
    if (scene !== "setup") return;
    if (!(e.buttons & 1) && e.pointerType !== "touch") return;
    const r = canvas.getBoundingClientRect();
    setup.drag(e.clientX - r.left, e.clientY - r.top);
  },
  { capture: true },
);

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

function startLevel(id: string, useSetupTuning = false) {
  const base = levelById(id) ?? LEVELS[0]!;
  let configured = applyOverrides(base, params);
  if (useSetupTuning && setup.level?.id === id) {
    configured = applyTuning(configured, setup.tuning);
  }
  level = configured;
  planet = level.planet;
  rocket = cloneRocket(level.rocket);
  initialFuel = rocket.mass - rocket.dryMass;
  status = "FLY";
  winHoldTime = 0;
  pitchFromVertical = 0;
  input.state.throttle = 0;
  input.state.gimbal = 0;
  input.state.headingMode = "manual";
  recenter(cameraCtrl);
  fitCamera(cam, rocket, planet);
  smoothMpp = cam.metersPerPx;
  warpIdx = 0;
  scene = "play";
}

function backToMenu() {
  silence();
  scene = "menu";
}

if (params.level) {
  const found = levelById(params.level);
  if (found) {
    setup.setLevel(found);
    startLevel(found.id, false);
  }
}

function frame(now: number) {
  const dtReal = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;

  // The planet always rotates slowly (visual only — no effect on physics).
  planetYaw += dtReal * 0.04;

  if (scene === "menu") drawMenu();
  else if (scene === "setup") drawSetup();
  else {
    update(dtReal);
    draw();
  }
  requestAnimationFrame(frame);
}

function update(dtReal: number) {
  const edges = input.consumeEdges();
  if (edges.recenter) recenter(cameraCtrl);
  if (edges.followToggle) cameraCtrl.follow = !cameraCtrl.follow;
  if (edges.warpCycle) {
    cycleWarp();
    sfx.uiClick();
  }
  if (edges.quit) {
    backToMenu();
    return;
  }
  if (edges.reset) {
    if (status === "FLY") startLevel(level.id, true);
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

    // Time warp: scale simulated time by the current warp factor while
    // keeping each integration step at PHYS_DT for accuracy. This means more
    // physics steps per render frame at higher warp.
    physAccum += dtReal * warpFactor();
    let safety = 0;
    while (physAccum >= PHYS_DT && safety++ < 4096) {
      step(rocket, planet, PHYS_DT);
      physAccum -= PHYS_DT;
      if (rocket.crashed) {
        physAccum = 0;
        break;
      }
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
        // Hold-time accumulates in REAL seconds at warp 1, but in simulated
        // time as warp increases — using simulated seconds keeps the win
        // criterion fair regardless of warp factor.
        winHoldTime += dtReal * warpFactor();
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

  // Camera: auto-fit only if FOLLOW is on. Manual mode preserves user pan/zoom.
  if (cameraCtrl.follow) {
    fitCamera(cam, rocket, planet);
    const k = 1 - Math.exp(-dtReal * 3);
    smoothMpp = smoothMpp + (cam.metersPerPx - smoothMpp) * k;
    cam.metersPerPx = smoothMpp;
  } else {
    fitCamera(cam, rocket, planet);
    applyController(cam, cameraCtrl);
    smoothMpp = cam.metersPerPx;
  }
}

function altitudeAbove(p: Planet) {
  return Math.hypot(rocket.pos.x, rocket.pos.y) - p.radius;
}

function draw() {
  clearFrame(ctx, cam);
  drawStars(ctx, cam, 7);
  drawPlanet(ctx, planet, cam, planetYaw);
  drawTerrain(ctx, planet, cam, level.id.charCodeAt(0));

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
  drawOffscreenIndicator(ctx, rocket, cam);

  const el = elements(rocket.pos, rocket.vel, planet);
  const fuelFrac = initialFuel === 0 ? 0 : Math.max(0, (rocket.mass - rocket.dryMass) / initialFuel);
  const data: HudData = hudDataOf(rocket, el, planet, fuelFrac, status, hint());
  drawHud(ctx, cam.vw, data);
  drawPills(ctx, input, cameraCtrl, warpFactor());

  // Best-score badge — only shown when there's room above the bottom pill row.
  const best = bestScore(level.id);
  if (best && cam.vh > 540) {
    ctx.fillStyle = COLOR.hudDim;
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      `BEST ${best.seconds.toFixed(1)}s  FUEL ${(best.fuelFrac * 100).toFixed(0)}%`,
      8,
      cam.vh - 14,
    );
  }
}

function drawMenu() {
  clearFrame(ctx, cam);
  drawStars(ctx, cam, 11);
  // Animated background: a small wireframe globe centered behind the title.
  drawMenuPlanet();
  menu.draw(ctx);
}

function drawMenuPlanet() {
  // Render an oversized planet in the background using a temporary camera.
  const tmpCam: Camera = {
    center: { x: 0, y: 0 },
    metersPerPx: 1,
    vw: cam.vw,
    vh: cam.vh,
    rotation: 0,
  };
  // Pretend the planet has a fixed 120-pixel radius regardless of size.
  const fakePlanet: Planet = {
    mu: 1,
    radius: 120,
    atmoTop: 0,
    atmoScaleHeight: 0,
    atmoSeaLevelDensity: 0,
  };
  // Translate so the globe sits behind the title (top center).
  ctx.save();
  ctx.translate(0, -cam.vh * 0.18);
  drawPlanet(ctx, fakePlanet, tmpCam, planetYaw);
  ctx.restore();
}

function drawSetup() {
  setup.draw(ctx);
}

function hint(): string | undefined {
  if (status !== "FLY") return undefined;
  const el = elements(rocket.pos, rocket.vel, planet);
  const periAlt = el.periapsis - planet.radius;
  const need = (level.minPeriAlt / 1000).toFixed(0);
  if (periAlt < 0) return `RAISE PER >${need}km`;
  if (periAlt < level.minPeriAlt)
    return `PER ${(periAlt / 1000).toFixed(1)}km / ${need}km`;
  if (el.e > level.maxEcc) return `CIRCULARIZE  ECC ${el.e.toFixed(2)}`;
  return `HOLD  ${(4 - winHoldTime).toFixed(1)}s`;
}

requestAnimationFrame(frame);
