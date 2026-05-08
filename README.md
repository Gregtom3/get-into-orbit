# APOAPSIS

Wireframe orbital launch game. Get into orbit, no app install. Plays in any
mobile or desktop browser.

## Play it

**Live:** https://gregtom3.github.io/get-into-orbit/

The site is built with a relative base path, so the same bundle also works at
the repo root or under any custom domain without rebuilding.

### Quick links

Skip the menu and jump straight into a tuned scenario:

- https://gregtom3.github.io/get-into-orbit/?level=hop
- https://gregtom3.github.io/get-into-orbit/?level=ascent
- https://gregtom3.github.io/get-into-orbit/?level=heavy
- https://gregtom3.github.io/get-into-orbit/?level=ascent&fuel=0.6&thrust=0.9 — harder
- https://gregtom3.github.io/get-into-orbit/?level=heavy&atmo=0 — vacuum heavy

URL params (all optional):

| Param      | Effect                                              |
| ---------- | --------------------------------------------------- |
| `level`    | Skip menu and load `hop`, `ascent`, or `heavy`      |
| `gravity`  | Override surface gravity (m/s²); recomputes `mu`    |
| `fuel`     | Fraction of original fuel mass (0..1)               |
| `thrust`   | Thrust multiplier                                   |
| `atmo`     | `0` to disable atmosphere                           |
| `debug`    | `1` to enable debug overlays (reserved)             |

## How to play

- **Throttle** — vertical pill, left edge.
- **Gimbal** — horizontal pill, bottom right. Rotates the rocket in the local
  frame (so "straight up" stays straight up as you fly around the planet).
- **PRO / RET** — heading locks. Tap to slew toward prograde (along velocity)
  or retrograde. Touching the gimbal breaks the lock.
- **STAGE** — center button (reserved).
- **RESET** — top right. Restarts the level while flying; returns to the menu
  after a win or crash.

Win condition: hold an orbit with periapsis above the level's threshold and
eccentricity below the cap for **4 seconds**. Best time-to-orbit (with fuel
remaining as tiebreak) is saved per level in localStorage.

## Develop

```bash
npm install
npm run dev      # local dev server, opens on phone via the network URL
npm test         # vitest, ~45 unit/integration tests
npm run build    # tsc + vite, produces dist/
```

### Repo layout

```
src/
  main.ts        scene loop (menu / play), camera smoothing
  physics.ts     gravity, drag, thrust, semi-implicit Euler
  orbit.ts       Keplerian elements from state vector
  predict.ts     forward-integrated trajectory line
  autopilot.ts   prograde/retrograde heading targeting + slew
  render.ts      wireframe planet, rocket, stars, paths
  rockets.ts     three rocket silhouettes (SCOUT/LIFTER/HEAVY)
  levels.ts      three levels (HOP/ASCENT/HEAVY)
  input.ts       touch + keyboard pills
  hud.ts         readouts and pill rendering
  menu.ts        title, level cards, settings overlay
  audio.ts       WebAudio synth (no assets)
  scores.ts      localStorage best scores
  settings.ts    localStorage user settings
  params.ts      URL query parsing + level overrides
tests/           vitest suites
.github/workflows/pages.yml   builds + deploys to GitHub Pages
```

### Deploy

The GitHub Pages workflow runs on pushes to `main` and the active feature
branch. It runs `npm test` and `npm run build`, then publishes `dist/` to
Pages. Enable Pages once in repo Settings → Pages → Source: GitHub Actions.

### Playtest workflow

1. Push a branch.
2. Workflow deploys to Pages preview.
3. Open the URL on a phone, share screen-recordings back as feedback.
4. Use URL params to A/B specific tunings without rebuilding.
