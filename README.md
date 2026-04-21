# 3DGS Ball Gyro Playground

A static web prototype that lets you roll a ball with mobile tilt or touch input over a 3D Gaussian Splatting background. It is built on top of the existing Spark 2.0 / Three.js viewer.

## Status

- Phase 1–6 style prototype implemented
- `npm test`, `npm run build`, and `npm run check` pass
- **Real-device browser testing has not been completed yet**
- Treat the repo and the published pages as **unverified until tested on actual iPhone / Android devices**
- Real-device testing is intended to happen after pushing to GitHub

## Playable HTML

- Main game page: [index.html](https://mistral-yu.github.io/3dgs-ball-gyro-playground/)
- Sensor smoke test: [sensor-smoke-test.html](https://mistral-yu.github.io/3dgs-ball-gyro-playground/sensor-smoke-test.html)

If you run the project locally, the same pages are available at:

- `http://127.0.0.1:4173/`
- `http://127.0.0.1:4173/sensor-smoke-test.html`

## Features

- 3DGS background rendering
- Simple physics for one ball
- `deviceorientation`-based tilt control
- iPhone motion permission flow
- Touch fallback when sensors are denied, unavailable, or time out
- Calibration
- Goal, obstacles, reset, and timer
- Dedicated sensor smoke test page

## Main files

- `index.html` — main game page
- `viewer.js` / `viewer.bundle.js` — viewer and gameplay integration
- `viewer.css` — UI, HUD, and mobile layout styles
- `ball-game.mjs` — simplified physics and stage progression
- `motion-controls.mjs` — sensor normalization, smoothing, and calibration
- `touch-controls.mjs` — touch fallback input
- `game-ui-state.mjs` — HUD state assembly
- `sensor-smoke-test.html` / `sensor-smoke-test.js` — sensor verification page
- `tests/` — regression tests built on Node's test runner

## Local run

```bash
npm install
npm run build
npm run dev
```

After the dev server starts:

- Main game: `http://127.0.0.1:4173/`
- Sensor smoke test: `http://127.0.0.1:4173/sensor-smoke-test.html`

## GitHub Pages

- Published URL: `https://mistral-yu.github.io/3dgs-ball-gyro-playground/`
- Pages source: `main` / repository root
- The project is designed to be served as static HTML
- Because Pages is HTTPS, the iPhone motion permission flow also works there

## Verification commands

```bash
npm test
npm run build
npm run check
```

## What to check on a real device

- Whether iPhone Safari allows motion permission from `Enable Motion`
- Whether Android Chrome receives stable `deviceorientation` values
- Whether touch fallback is used naturally when sensors are denied
- Whether calibration reduces idle jitter
- Whether the goal, obstacles, reset, and timer behave correctly

## Notes

- The project does **not** try to derive high-precision collision directly from 3DGS splats
- Stage collision is separated into lightweight colliders
- Visual polish is secondary to input flow and stable behavior for the first version

## License / references

- See `THIRD_PARTY_NOTICES.md` for third-party information from the base viewer
- The `Bunny` / `dragon` primitives follow the same notice file
