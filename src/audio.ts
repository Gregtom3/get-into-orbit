/**
 * Tiny WebAudio synth. No assets — every sound is generated on the fly so the
 * whole game stays a single tiny bundle. Browsers require a user gesture before
 * audio can play; ensureContext() must be called from a user input handler.
 */

import { settings } from "./settings";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let thrustOsc: OscillatorNode | null = null;
let thrustGain: GainNode | null = null;
let thrustTarget = 0;

export function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor() as AudioContext;
    masterGain = ctx.createGain();
    masterGain.gain.value = settings.audioOn ? settings.volume : 0;
    masterGain.connect(ctx.destination);
  } catch {
    return null;
  }
  return ctx;
}

export function setMasterVolume(v: number) {
  if (masterGain) masterGain.gain.value = v;
}

export function applySettingsToAudio() {
  if (!masterGain) return;
  masterGain.gain.value = settings.audioOn ? settings.volume : 0;
}

function blip(freq: number, duration: number, type: OscillatorType, vol = 0.4) {
  const c = ensureContext();
  if (!c || !masterGain) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  o.connect(g);
  g.connect(masterGain);
  o.start();
  o.stop(c.currentTime + duration + 0.05);
}

export const sfx = {
  uiClick() {
    blip(660, 0.06, "square", 0.18);
  },
  uiBack() {
    blip(330, 0.07, "square", 0.18);
  },
  stage() {
    blip(180, 0.18, "sawtooth", 0.4);
    setTimeout(() => blip(120, 0.22, "sawtooth", 0.35), 60);
  },
  win() {
    const c = ensureContext();
    if (!c) return;
    blip(523, 0.18, "sine", 0.35);
    setTimeout(() => blip(659, 0.18, "sine", 0.35), 130);
    setTimeout(() => blip(784, 0.32, "sine", 0.4), 260);
  },
  crash() {
    const c = ensureContext();
    if (!c) return;
    // noise burst via short detuned saws
    blip(120, 0.4, "sawtooth", 0.45);
    setTimeout(() => blip(80, 0.5, "square", 0.35), 40);
    setTimeout(() => blip(60, 0.6, "sawtooth", 0.3), 100);
  },
};

/** Continuous engine rumble whose volume tracks throttle. */
export function setThrust(throttle: number) {
  thrustTarget = Math.max(0, Math.min(1, throttle));
  const c = ensureContext();
  if (!c || !masterGain) return;
  if (!thrustOsc) {
    thrustOsc = c.createOscillator();
    thrustGain = c.createGain();
    thrustOsc.type = "sawtooth";
    thrustOsc.frequency.value = 70;
    thrustGain.gain.value = 0;
    thrustOsc.connect(thrustGain);
    thrustGain.connect(masterGain);
    thrustOsc.start();
  }
  if (thrustGain) {
    thrustGain.gain.linearRampToValueAtTime(thrustTarget * 0.18, c.currentTime + 0.05);
  }
  if (thrustOsc) {
    thrustOsc.frequency.linearRampToValueAtTime(60 + thrustTarget * 80, c.currentTime + 0.1);
  }
}

export function silence() {
  if (thrustGain && ctx) thrustGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
  thrustTarget = 0;
}
