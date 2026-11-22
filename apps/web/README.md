# @aurion/web

The Aurion interface: Next.js 16 (App Router), React 19, Tailwind 4, Three.js.
See the [root README](../../README.md) for what the game is and how to run it,
and [`docs/DESIGN.md`](../../docs/DESIGN.md) for the interface rules.

```bash
pnpm --filter @aurion/engine build
```

```bash
pnpm --filter @aurion/web dev
```

Where things live:

- `app/[locale]/` — routes: title screen, new game, play, codex, trophies, settings.
- `components/ui/` — the UI kit. Build screens from it; do not restyle ad hoc.
- `components/Globe/` + `lib/globe/` — the planet renderer and everything drawn on it.
- `components/Panels/` — the eight game systems.
- `lib/store.ts` — the Zustand store that wraps the engine.
- `messages/` — generated from `scripts/i18n/*.py`; never edit by hand.

This Next.js version has breaking changes from older releases: read
[`AGENTS.md`](./AGENTS.md) before changing framework-level code.
