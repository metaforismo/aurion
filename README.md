# Aurion

> Real-time pausable strategy game — guide a small nation to global power through research, espionage, military, diplomacy, and internal politics.

**Status:** in active development (Fase 1 — core engine + first scenario).

Aurion is a single-player browser game inspired by the pacing of *Plague Inc.* and the depth of *Civilization*, set in a fictional world of ~25 nations. You start small. You can win in many ways: economic dominance, military conquest, diplomatic supremacy, scientific (including a space program), or total domination.

## Architecture

Monorepo (`pnpm` + `turbo`) with two main packages:

- **`packages/engine`** — pure TypeScript game engine. Zero React/DOM dependencies. Pure functions over an immutable `GameState`. Seedable PRNG for deterministic playthroughs. Reusable in mobile, CLI, or simulation contexts.
- **`apps/web`** — Next.js 16 (App Router) UI. Tailwind, Zustand store wrapping the engine, SVG world map, IndexedDB save (Dexie), `next-intl` for IT/EN.

Full design spec: see `docs/SPEC.md` (or the planning file referenced in commits).

## Development

```bash
pnpm install
pnpm dev              # starts apps/web on :3000
pnpm test             # engine tests
pnpm typecheck        # all packages
```

## Phases

- **Phase 1** *(in progress)* — engine + 1 scenario (Ascesa di Aurion), 6 systems (Economy / Research / Military / Spies / Diplomacy / Internal Politics with factions), 5 selectable victory conditions, IT+EN.
- **Phase 2** *(planned)* — additional scenarios, multiple difficulties, balancing.
- **Phase 3** *(planned)* — polish, deeper tech tree, narrative events, audio, achievements.

## License

TBD.
