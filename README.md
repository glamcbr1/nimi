# FRACTURE CITY

> REALITY IS A STRUCTURE.

A production-grade cinematic interactive 3D WebGL experience — scroll-driven descent through a living brutalist megacity that collapses into impossible geometry, ending as a spherical city in space.

**Art direction:** deep blacks / indigos, cyan–magenta fracture energy, monumental scale. See `docs/art-direction.png`.

## Run

```bash
npm i
npm run dev
```

Open the local URL (default `http://localhost:5173`). Scroll to progress. Click **AUDIO** to enable the procedural score (requires a user gesture).

```bash
npm run build    # typecheck + production bundle → dist/
npm run preview  # serve dist/
```

## Controls

| Input | Action |
|--------|--------|
| Scroll | Advance cinematic timeline (0→1) |
| Mouse | Subtle camera parallax |
| AUDIO | Toggle Web Audio layers |
| Quality | Cycle ULTRA → HIGH → MEDIUM → LOW |
| `?debug=1` | Debug panel: FPS, scrub, phase jumps |

## Narrative phases

`INTRO → CITY_APPROACH → IMMERSION → INSTABILITY → FRACTURE → GRAVITY_FAILURE → FOLDING → DIMENSION_OVERLAP → NON_EUCLIDEAN → CORE_REVEAL → COLLAPSE → SILENCE → FINALE`

## Architecture

```
src/
  main.ts / App.ts          boot + frame loop
  core/                     Renderer, SceneManager, PerformanceManager, AssetManager
  camera/                   CameraDirector (scroll spline + mouse)
  timeline/                 TimelineManager + phase states
  city/                     CityGenerator, DistrictManager, BuildingFactory
  systems/                  Traffic, Weather, Particles, Fracture, Gravity, Portal, Collapse
  audio/                    procedural Web Audio
  post/                     EffectComposer stack (bloom, vignette, grain, grade)
  ui/                       cinematic loader + editorial HUD
  debug/                    ?debug=1 tools
  shaders/                  building / core / distort GLSL
```

**Districts:** Central Core, Industrial Canyon, Vertical Slums, Skyway Network, Fracture Zone, Collapse Core — seeded procedural instancing with distinct density and building families.

## Tech

Vite · TypeScript · Three.js · custom GLSL · postprocessing (EffectComposer) · GSAP · Web Audio API

## Notes

- Quality auto-adapts downward if FPS stays low.
- Mobile uses a reduced quality path by default.
- No external 3D/audio assets required — city, rain, traffic, score, and finale are procedural.
