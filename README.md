# Aurion

> **Real-time pausable strategy game** — guide a small nation to global power through research, espionage, military, diplomacy, and internal politics.

[![CI](https://github.com/metaforismo/aurion/actions/workflows/ci.yml/badge.svg)](https://github.com/metaforismo/aurion/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Aurion is a single-player browser game inspired by the pacing of *Plague Inc.* and the depth of *Civilization*. You start small and lead a nation to global power across fictional worlds and real-world scenarios. You win by outsmarting, outbuilding, or outlasting everyone else — five distinct victory conditions, each playable from the same starting point — or you play on forever in Eternal mode.

**Status:** playable. Core engine, four scenarios, seven interlocking systems, four game modes, an interactive flat/globe world map, audio, achievements, and a guided onboarding flow are all in place. Runs entirely in the browser — no backend, no account.

---

## Table of contents

- [Screenshots](#screenshots)
- [Features](#features)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Running tests](#running-tests)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Screenshots

> Screenshots coming soon — see [`assets/README-IMAGES-TODO.md`](./assets/README-IMAGES-TODO.md) for the shot list.

| Home | New game wizard | Play screen |
|:---:|:---:|:---:|
| _placeholder_ | _placeholder_ | _placeholder_ |

---

## Features

**Gameplay**

- **Seven interlocking systems** — Economy, Research, Military, Spies, Diplomacy, Internal Politics (5 factions per nation), and a United Nations world stage.
- **Five selectable victory conditions** — Economic, Military, Scientific (incl. space program), Diplomatic, Total Domination.
- **Four game modes** — Classic (win once), Eternal (open-ended, victories become milestones), Era-paced (chapter-driven, for scenarios with an era schedule), and Dethrone (reach #1 and hold it).
- **Four scenarios** — *Ascesa di Aurion* and *Quick Start* (fictional worlds) plus *Mondo Contemporaneo* and *Guerra Fredda* (real-world maps, with blocs and nuclear arsenals).
- **Difficulty presets** — Easy / Normal / Hard, plus an Iron Man permadeath mode (no saves, one shot).
- **Real-time, pausable** — pause / 1× / 2× / 4× speeds. Auto-pauses on narrative events and tab switch.
- **Cross-game achievements** — a trophy catalogue that persists across runs.

**Experience**

- **Quick Play** — a one-click starter run with sensible defaults, or the full five-step new-game wizard when you want to choose.
- **Interactive world map** — flat atlas or a drag-to-rotate orthographic globe (real-world scenarios), with zoom, keyboard camera, tension/alliance/intel/bloc overlays, and animated war arcs.
- **Guided onboarding** — an in-game advisor that surfaces your most urgent next moves, a first-objectives checklist, and a one-line explainer on every panel.
- **In-game settings** — audio mix, replay recording, tutorial reset, and language, all reachable from the home screen.
- **Save management** — rename, delete, export and import saves directly from the home screen; IndexedDB persistence with autosave.

**Foundations**

- **Deterministic & seeded** — every game has a `rngSeed`; same seed + same actions → same outcome. Saves are reproducible bug reports.
- **Accessible by default** — keyboard-navigable map and panels, focus management, screen-reader labels, and full `prefers-reduced-motion` support.
- **IT + EN** out of the box (`next-intl`), with the two locale bundles kept in strict key parity.
- **Pure-TS engine** with zero React/DOM coupling — portable to mobile, CLI, headless simulation.

---

## Quick start

You'll need [Node.js](https://nodejs.org/) ≥ 20 and [pnpm](https://pnpm.io/installation) 10.

```bash
git clone https://github.com/metaforismo/aurion.git
cd aurion
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and start playing.

No env vars, no backend, no account — the game runs entirely client-side.

---

## Architecture

A pnpm + Turborepo monorepo with a strict boundary between game logic and UI.

- **`packages/engine`** — pure TypeScript game engine. No React, no DOM, no Next.js. `tick()` and `applyAction()` are pure functions over an immutable `GameState`. Uses a seedable PRNG (mulberry32) so playthroughs are deterministic. Reusable in mobile, CLI, or simulation contexts.
- **`apps/web`** — Next.js 16 (App Router) UI. Tailwind 4, Zustand store wrapping the engine, SVG world map, IndexedDB save (Dexie), `next-intl` for IT/EN.

The engine boundary is enforced by ESLint and a tsconfig without `lib: ["dom"]`. This is what makes the engine fast to test, easy to reason about, and ready to drop into a React Native shell or a Web Worker without rewriting it.

Full design spec: see [`docs/SPEC.md`](./docs/SPEC.md).

---

## Project structure

```
aurion/
├── apps/
│   └── web/                       # Next.js 16 App Router (@aurion/web)
│       ├── app/                   # Routes: /, /new, /play/[saveId], /trofei, /settings
│       ├── components/            # Map (flat + globe), Hud, Panels (7 systems), Modals, Onboarding
│       ├── content/scenarios/     # Data-driven scenarios (JSON)
│       ├── lib/                   # store, ticker, persistence, geo, i18n
│       ├── messages/              # IT + EN translations
│       └── tests/                 # Playwright E2E
│
├── packages/
│   └── engine/                    # Pure-TS engine (@aurion/engine)
│       ├── src/
│       │   ├── types.ts           # GameState, Action, Country, etc.
│       │   ├── createGame.ts      # factory
│       │   ├── tick.ts            # tick() — pure
│       │   ├── actions/           # one reducer per action
│       │   ├── ai/                # non-player nation decisions
│       │   ├── checkWinLoss.ts
│       │   └── rng.ts             # seedable mulberry32 PRNG
│       ├── tests/                 # Vitest + fast-check
│       └── scripts/sim.ts         # headless simulation runner
│
├── docs/SPEC.md                   # Phase 1 design spec — source of truth
├── assets/                        # README screenshots (TODO)
├── .github/                       # CI workflows, PR + issue templates
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
└── package.json
```

---

## Running tests

```bash
pnpm typecheck                              # TypeScript across the workspace
pnpm lint                                   # ESLint
pnpm test                                   # all unit tests (engine + web)

pnpm --filter @aurion/engine test           # engine only — fast
pnpm --filter @aurion/engine test:watch     # engine in watch mode
pnpm --filter @aurion/engine sim            # headless simulation runner

pnpm --filter @aurion/web test:e2e          # Playwright E2E (run `pnpm exec playwright install` first)
```

CI runs typecheck, lint, engine tests, and the web build on every PR. See [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

---

## Roadmap

- **Phase 1 (done)** — engine + first scenario (*Ascesa di Aurion*), 7 systems, 5 victory conditions, IT + EN.
- **Phase 2 (done)** — additional scenarios (*Quick Start*, *Mondo Contemporaneo*, *Guerra Fredda*), difficulty presets, deeper balancing.
- **Phase 3 (done)** — game modes (Classic / Eternal / Era-paced / Dethrone), blocs, nuclear warfare, narrative events, audio, achievements.
- **UX & graphics polish (done)** — guided onboarding (advisor, objectives, panel explainers), Quick Play, interactive flat/globe world map with war arcs, settings page, save management, cinematic endgame.
- **Next** — optional cloud sync, a replay viewer for recorded action logs, and deeper engine-side variety (event cadence, rival storylines).

Detailed scope and out-of-scope items per phase are documented in [`docs/SPEC.md`](./docs/SPEC.md).

---

## Contributing

PRs welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup, conventions, and how to add a new scenario.

If you're using an AI coding assistant (Claude/Cursor/etc.), point it at [`apps/web/AGENTS.md`](./apps/web/AGENTS.md) and [`docs/SPEC.md`](./docs/SPEC.md) before letting it touch code.

---

## License

[MIT](./LICENSE) — © 2026 Francesco Giannicola and Aurion contributors.
