# APOAPSIS — Prototype Requirements

Living checklist. Each item is binary done/not-done so progress is unambiguous.

## P0 — Critical (must work to be playable)

- [x] Rocket and planet visible on any viewport ≥ 320 × 568 (camera framing)
- [x] On-screen indicator pointing toward the rocket if it ever leaves the view
- [x] Touch input responds on mobile Safari + Chrome (no install required)
- [x] Pan with one-finger drag in play
- [x] Pinch zoom (two-finger) in play
- [x] Mouse-wheel zoom on desktop
- [x] FOLLOW toggle pill — when on, auto-frames; when off, manual cam stays
- [x] Quit-to-menu button always accessible during play
- [x] Camera tests: rocket projects inside viewport at multiple altitudes,
      planet positions, screen sizes, and DPRs
- [x] Layout tests: input pills don't overlap on the smallest target viewport
- [x] Bundle works at any URL base (relative `./` paths)

## P1 — Core gameplay

- [x] Throttle slider, gimbal slider, prograde / retrograde lock pills
- [x] Predicted ballistic trajectory line with apo / peri / impact markers
- [x] Win on stable orbit (peri above threshold, ecc below cap, sustained 4s)
- [x] Crash on hard surface impact
- [x] Per-level high scores in localStorage (time + fuel + ecc)
- [x] Three levels with distinct planets and rockets
- [x] Three rocket silhouettes (SCOUT / LIFTER / HEAVY)
- [x] Pre-launch tuning screen — sliders for fuel %, thrust %, gravity ×,
      initial pitch
- [x] Tunable parameters also exposed via URL params for share-link playtest

## P1 — Menu / shell

- [x] Title screen: APOAPSIS heading
- [x] Level picker with best score per card and rocket preview
- [x] Settings overlay: audio on/off, volume, sensitivity, clear scores
- [x] Tutorial / help overlay accessible from the menu and during play
- [x] Animated wireframe planet on the menu background
- [x] Scoreboard view summarizing best across all levels

## P2 — Visuals

- [x] Wireframe planet rendered with lat/lon grid for a 3D feel (rotates)
- [x] Surface terrain: radial spikes / mountain silhouette
- [x] Launch pad marker at the start position
- [x] Atmosphere visible as a faint dashed ring at its top altitude
- [x] Stars in the background

## P2 — Audio

- [x] Engine rumble whose pitch tracks throttle
- [x] UI click bleeps
- [x] Win fanfare, crash burst
- [x] All synthesized via WebAudio — no asset files

## Testing

- [x] Physics core: gravity, drag, thrust, integrator, mass flow, crash
- [x] Orbit math: Keplerian elements, stable-orbit predicate
- [x] Autopilot: angle math, prograde / retrograde / radial targeting, slew
- [x] Score comparator
- [x] URL params parser + level overrides
- [x] Camera framing: rocket inside viewport at altitudes, angles, sizes, DPRs
- [x] Pill layout: non-overlap on the smallest target viewport
- [x] Scripted launch achieves stable orbit on at least one level

## P3 — Future (not blocking prototype)

- [ ] Multi-stage rockets (drop empty stages)
- [ ] Smooth-following second body (moon)
- [ ] Atmospheric heating visualization on reentry
- [ ] Replay / ghost of best run
- [ ] Daily seed / shared challenge link

---

## How requirements get checked

Code paths:
- Camera + layout invariants → `tests/camera.test.ts`, `tests/layout.test.ts`
- Physics + orbit → `tests/physics.test.ts`, `tests/orbit.test.ts`
- Win condition → `tests/launch.test.ts`
- UX: smoke-tested on a mobile browser via the GitHub Pages preview URL

Anything not covered by automated tests is called out as a manual playtest
step in the README.
