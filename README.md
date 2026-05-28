# 🎯 Neon Smash VR

A holodeck-style VR target-smashing arcade game built with [IWSDK](https://iwsdk.dev) 0.4.1.

**[▶ Play Now](https://ellyz2426.github.io/neon-smash/)** | [GitHub](https://github.com/ellyz2426/neon-smash)

## Overview

Neon Smash drops you into a glowing neon arena where targets pop up from pylons in a semicircular array. Strike them with dual-wielding mallets in VR or click to aim in browser mode. Build combos, dodge bombs, collect power-ups, and chase high scores across five game modes.

## Features

### Core Gameplay
- **6 target types**: Normal (cyan), Speed (yellow), Armored (orange, 2-hit), Bomb (red, avoid!), Golden (gold, rare bonus), Chain (green, sequence)
- **5 movement patterns**: Targets can zigzag, orbit, dive toward you, wobble erratically, or strafe — difficulty scales per wave
- **Combo scoring**: x1→x2→x3→x5→x10 multipliers at consecutive hit thresholds
- **Boss targets**: Giant icosahedron with orbiting weak points in Boss Wave mode

### Game Modes
| Mode | Description |
|------|-------------|
| **Classic** | 10 waves, 3 lives — survive the onslaught |
| **Speed Rush** | 60 seconds — how many can you smash? |
| **Precision** | 30 targets — accuracy is everything |
| **Endless** | Infinite waves — how long can you last? |
| **Boss Wave** | Giant boss targets with orbiting weak points |

### VR & Browser
- **Dual-wielding**: Both XR controllers fire independently with trigger
- **VR haptic feedback**: Intensity-scaled vibrations for hits, bombs, golden targets, armored cracks
- **Browser mode**: Mouse aim + click to strike, ESC to pause
- **Dual-runtime**: XR offer-once with full browser fallback (WASD not needed — stationary game)

### Power-Ups
- ⏱ **Time Slow** — 40% game speed for 8 seconds
- ✕2 **Double Points** — 2x scoring for 10 seconds
- 🧲 **Magnet Pull** — pulls targets toward you for 6 seconds
- 🛡 **Shield** — blocks one bomb hit for 12 seconds

### Progression
- **30 achievements** with localStorage persistence
- **Top 20 leaderboard** with score, mode, accuracy, max combo
- **Career statistics**: total games, play time, targets smashed, per-mode bests
- **Match history**: last 50 games with timestamps, relative dates, and detailed breakdowns
- **5 striker skins**: Neon, Flame, Ice, Void, Lightning — each with unique trail colors
- **Daily Challenges**: Seeded PRNG with 10 challenge modifiers (Bomb Storm, Glass Cannon, No Miss, etc.)

### Arena
- **8 arena themes**: Holodeck, Crimson Arena, Toxic Zone, Ultraviolet, Solar Blaze, Frost Cavern, Void Rift, Emerald Grid
- **Combo-responsive lighting**: Arena lights, floor grid, pylon glows, and ambient particles react to combo level
- **15 pylons** in a 3×5 semicircular arrangement with decorative wireframe shapes

### Audio
- **Procedural Web Audio**: 15+ SFX, hit pitch variations (ascending on consecutive hits, resets on miss)
- **Layered music**: Sub bass + LFO + triangle pad + bass fifth + A-minor arpeggiator
- **Ambient**: Low-pass noise floor, 60Hz electrical hum with LFO, tonal drone
- **Stingers**: Victory fanfare (ascending + harmony pad + cymbal), defeat (descending + dark bass + reverse cymbal)
- **Per-event SFX**: Power-up collect/expire, challenge complete, wave start, streak, life lost, perfect wave

### UI
- **21 PanelUI spatial panels** — all `.uikitml` templates, zero HTML DOM
- **Follower HUDs**: Score/lives, combo counter, power-up timers, streak indicator, wave announcements, toasts
- **World panels**: Title, mode select, difficulty, pause, game over, leaderboard, achievements, settings, stats, skins, challenge, tutorial, match history, help
- **6-step interactive tutorial**

## Tech Stack

- **IWSDK 0.4.1** — WebXR framework (Three.js/ECS)
- **PanelUI** — Spatial UI system (`.uikitml` → compiled JSON → 3D panels)
- **Vite** — Build tooling with `@iwsdk/vite-plugin-uikitml`
- **TypeScript** — Full type safety
- **Web Audio API** — All audio is procedurally generated

## Development

```bash
npm install
npx iwsdk dev up     # launches dev server with headless browser
npm run build        # production build to dist/
```

## Stats

- **34 source files** (13 TypeScript + 21 uikitml templates)
- **5,766 lines** of source code
- **21 compiled PanelUI panels**
- **Zero HTML DOM overlays**
- **4 build rounds**, 135 total minutes

---

Built with [IWSDK](https://iwsdk.dev) by the daily build pipeline.
