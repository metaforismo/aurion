# Aurion

> **Real-time pausable strategy game** — guide a small nation to global power through research, espionage, military, diplomacy, and internal politics.

[![CI](https://github.com/metaforismo/aurion/actions/workflows/ci.yml/badge.svg)](https://github.com/metaforismo/aurion/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Aurion is a single-player browser game inspired by the pacing of *Plague Inc.* and the depth of *Civilization*, set in a fictional world of ~25 nations. You start small. You win by outsmarting, outbuilding, or outlasting everyone else — five distinct victory conditions, each playable from the same starting point.

**Status:** active development — Phase 1 (core engine + first scenario *Ascesa di Aurion*).

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

- **Six interlocking systems** — Economy, Research, Military, Spies, Diplomacy, Internal Politics (5 factions per nation).
- **Five selectable victory conditions** — Economic, Military, Scientific (incl. space program), Diplomatic, Total Domination.
- **Real-time, pausable** — pause / 1× / 2× / 4× speeds. Auto-pauses on narrative events and tab switch.
- **Deterministic & seeded** — every game has a `rngSeed`; same seed + same actions → same outcome. Saves are reproducible bug reports.
- **Save / export / import** — IndexedDB persistence with autosave, multi-slot, and JSON export/import.
- **IT + EN** out of the box (`next-intl`).
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
│       ├── app/                   # Routes: /, /new, /play/[saveId]
│       ├── components/            # Map, Hud, Panels (6 systems), Modals
│       ├── content/scenarios/     # Data-driven scenarios (JSON)
│       ├── lib/                   # store, ticker, persistence, i18n
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

- **Phase 1 (in progress)** — engine + 1 scenario (*Ascesa di Aurion*), 6 systems, 5 victory conditions, IT + EN.
- **Phase 2 (planned)** — additional scenarios (modern world, Cold War, etc.), 3 difficulty levels, deeper balancing.
- **Phase 3 (planned)** — polish, deeper tech tree, advanced narrative events, audio, achievements, optional cloud sync.

Detailed scope and out-of-scope items per phase are documented in [`docs/SPEC.md`](./docs/SPEC.md).

---

## Contributing

PRs welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup, conventions, and how to add a new scenario.

If you're using an AI coding assistant (Claude/Cursor/etc.), point it at [`apps/web/AGENTS.md`](./apps/web/AGENTS.md) and [`docs/SPEC.md`](./docs/SPEC.md) before letting it touch code.

---

## License

[MIT](./LICENSE) — © 2026 Francesco Giannicola and Aurion contributors.
