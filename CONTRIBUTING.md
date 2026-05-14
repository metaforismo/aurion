# Contributing to Aurion

Thanks for your interest in contributing! Aurion is a single-player, real-time pausable strategy game built as a TypeScript monorepo. This guide covers everything you need to land your first PR.

If anything here is wrong, missing, or out of date, that itself is worth a PR.

---

## Table of contents

- [Project goals and roadmap](#project-goals-and-roadmap)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Common commands](#common-commands)
- [Working on the engine vs the web app](#working-on-the-engine-vs-the-web-app)
- [Adding a new scenario (Phase 2 prep)](#adding-a-new-scenario-phase-2-prep)
- [Code style and conventions](#code-style-and-conventions)
- [Commit messages](#commit-messages)
- [Branch naming](#branch-naming)
- [Pull requests](#pull-requests)
- [Where to ask questions](#where-to-ask-questions)

---

## Project goals and roadmap

Aurion is decomposed into three phases. The full spec lives in [`docs/SPEC.md`](./docs/SPEC.md) — read it before doing any non-trivial work.

- **Phase 1 (in progress)** — core engine, one scenario (*Ascesa di Aurion*), six systems (Economy, Research, Military, Spies, Diplomacy, Internal Politics), five selectable victory conditions, IT + EN.
- **Phase 2 (planned)** — additional scenarios, multiple difficulties, deeper balancing.
- **Phase 3 (planned)** — polish, deeper tech tree, advanced narrative events, audio, achievements.

Issues and PRs targeting Phase 2/3 work are welcome but won't be merged until Phase 1 is feature-complete unless they're trivial fixes.

---

## Repository layout

```
aurion/
├── apps/
│   └── web/                # Next.js 16 App Router UI (@aurion/web)
├── packages/
│   └── engine/             # Pure-TS game engine (@aurion/engine) — zero React/DOM
├── docs/SPEC.md            # Phase 1 design spec — source of truth
├── .github/                # CI workflows, PR + issue templates
├── pnpm-workspace.yaml
├── turbo.json
└── package.json            # root scripts
```

The engine boundary is **enforced**: `packages/engine` must not import anything from React, Next.js, or the DOM. That's what makes it portable to mobile/CLI/simulation later.

---

## Prerequisites

- **Node.js** ≥ 20 (CI uses 24)
- **pnpm** 10 — install via [`corepack enable`](https://pnpm.io/installation#using-corepack) or `npm i -g pnpm@10`
- A modern browser for manual smoke testing

---

## Setup

```bash
git clone https://github.com/metaforismo/aurion.git
cd aurion
pnpm install
pnpm dev          # starts apps/web on http://localhost:3000
```

That's it. No env vars are required for local development — the game runs fully client-side with IndexedDB persistence.

---

## Common commands

Run from the repo root unless noted.

| Command | What it does |
|---|---|
| `pnpm dev` | Start the Next.js dev server (`apps/web` on `:3000`) |
| `pnpm build` | Build all packages via Turborepo |
| `pnpm typecheck` | TypeScript across the whole workspace |
| `pnpm lint` | ESLint across packages that define a `lint` script |
| `pnpm test` | Run all `test` tasks (engine unit tests, web component tests) |
| `pnpm format` | Prettier write across the repo |
| `pnpm clean` | Clear Turborepo + per-package build outputs |
| `pnpm --filter @aurion/engine test` | Engine unit tests only (fast) |
| `pnpm --filter @aurion/engine sim` | Headless simulation runner (`scripts/sim.ts`) |
| `pnpm --filter @aurion/web build` | Production build of the web app |
| `pnpm --filter @aurion/web test:e2e` | Playwright E2E smoke tests (requires `pnpm exec playwright install` first) |

The engine tests are the fastest signal — run them in watch mode with `pnpm --filter @aurion/engine test:watch` while iterating on reducers or balancing.

---

## Working on the engine vs the web app

**`packages/engine`** is pure TypeScript. Rules:

- No `react`, `react-dom`, `next`, or DOM globals (`window`, `document`, etc.).
- `tick(state)` and `applyAction(state, action)` must remain **pure functions** — no mutation, no side effects.
- Randomness goes through the seedable PRNG in `src/rng.ts`. Two runs with the same seed and same actions must produce identical state.
- Add a Vitest unit test for every new reducer, and a property-based test (fast-check) for any new invariant.

**`apps/web`** wraps the engine with React + Zustand:

- `lib/store.ts` is the only place that calls `applyAction` / `tick`.
- UI components read from the store, dispatch actions, and never mutate engine state directly.
- Persistence (Dexie/IndexedDB) lives in `lib/persistence.ts`. Every save records `engineVersion` so future migrations are possible.
- Visual styling tokens live in `app/globals.css` and `lib/theme.ts` — touch with care, those are coordinated with the visual polish pass.

When adding a new reducer or action, the typical flow is:

1. Extend the `Action` union and any payload types in `packages/engine/src/types.ts`.
2. Implement the reducer in `packages/engine/src/actions/<actionName>.ts`.
3. Wire it into `applyAction` in `src/index.ts`.
4. Add a unit test in `packages/engine/tests/`.
5. Expose a UI affordance in the relevant panel under `apps/web/components/Panels/`.

---

## Adding a new scenario (Phase 2 prep)

Scenarios are **data-driven** JSON files under `apps/web/content/scenarios/`. The schema is `Scenario` from `packages/engine/src/types.ts` (see `docs/SPEC.md` § "Scenario file" for the field-by-field breakdown).

Rough recipe:

1. Copy `apps/web/content/scenarios/ascesa-aurion.json` as a starting point.
2. Define your countries, relations, tech tree, event pool, and victory conditions.
3. Add the new scenario id to whatever scenario registry exists in `apps/web/content/`.
4. Add i18n strings in `apps/web/messages/it.json` and `apps/web/messages/en.json` for any name/description keys you reference.
5. Run `pnpm --filter @aurion/engine sim` against your scenario (you may need to extend the sim runner to take a scenario id) to sanity-check pacing.

The engine should **not** need any changes to support a new scenario. If it does, that's a missing data primitive — open an issue first.

---

## Code style and conventions

- **Formatting** is enforced by Prettier — config lives in [`.prettierrc.json`](./.prettierrc.json). Run `pnpm format` before committing, or set up an editor integration.
- **Linting** is ESLint (Next.js preset for the web app, lightweight config for the engine). Lint must pass in CI.
- **TypeScript** is strict everywhere. No `any` unless you've left a comment explaining why.
- **No new dependencies** without a clear justification in the PR description. The engine especially should stay lean.
- **i18n**: never hardcode user-facing strings. Use the `t()` helper and add keys to both `it.json` and `en.json`.
- **Determinism**: any randomness inside the engine must go through the seeded PRNG.

---

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/) loosely. Look at `git log --oneline` for the existing style. Examples from the repo:

```
feat(wave2+3): UI components + play screen integration
fix(balance): rescale scenario monetary fields, raise loss thresholds
chore: bootstrap Aurion monorepo
```

Common prefixes:

- `feat:` — new feature or capability
- `fix:` — bug fix
- `chore:` — tooling, deps, repo housekeeping
- `docs:` — documentation only
- `refactor:` — code change without behavior change
- `test:` — adding or fixing tests
- `perf:` — performance improvements

Scopes are optional but useful — `feat(engine):`, `fix(web):`, `chore(ci):`, etc.

---

## Branch naming

- `feat/<short-description>` — new features
- `fix/<short-description>` — bug fixes
- `chore/<short-description>` — tooling, deps, refactors
- `docs/<short-description>` — documentation

Keep branches short-lived. Rebase onto `main` before opening a PR if it's been a few days.

---

## Pull requests

1. Fork (or push a branch if you have write access).
2. Make your change. Keep the diff focused — one concern per PR.
3. Run `pnpm typecheck && pnpm lint && pnpm test` locally before pushing.
4. Open a PR. The template will prompt you for the things reviewers care about.
5. CI will run typecheck, lint, engine tests, and the web build. All four must be green to merge.

Smaller PRs land faster. If a change feels big, consider splitting it.

---

## Where to ask questions

- **Open an issue** for bugs, feature ideas, or anything you want to discuss publicly.
- **Design context for AI agents** working on this repo lives in [`apps/web/AGENTS.md`](./apps/web/AGENTS.md) and [`docs/SPEC.md`](./docs/SPEC.md). If you're using Claude/Cursor/etc., point them there first.

Welcome aboard.
