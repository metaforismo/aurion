# Aurion — interface design

The game is played on a full-screen planet. Everything else is chrome that
floats over it, so the chrome has one job: be legible at a glance and get out
of the way.

## Language: "orbital glass"

| Role | Token / class | Use |
| --- | --- | --- |
| Surface | `.glass-panel` (or `<Glass>`) | Anything that floats over the planet |
| Inset card | `<Card tone>` | Groups inside a surface — never nest glass in glass |
| Player / primary action | `accent` (gold) | One primary button per view, the player's country |
| Space, intel, "in progress" | `info` (cyan `#5cc8ff`) | Megaprojects, covert ops, construction |
| Good / caution / bad | `success` / `warning` / `danger` | State only, never decoration |
| Text | `text-fg`, `text-fg-muted`, `text-fg-faint` | Three levels, no more |
| Numbers | `numeric-tabular font-mono` | Every number that changes |

Radii: 12px cards (`rounded-xl`), 16px surfaces (`rounded-2xl`), pills for
chips and segmented controls. Spacing steps: 4 / 8 / 12 / 16 / 24.

## Components

Build screens from `apps/web/components/ui`:

`Button` (one `primary` per view) · `IconButton` · `Glass` · `Card` ·
`SectionTitle` · `Stat` · `Meter` · `Chip` · `Row` · `Segmented` · `Slider` ·
`TextInput` · `EmptyState` · `Kbd`.

Number formatting lives in `apps/web/lib/format.ts` (`money`, `signed`,
`compactNumber`, `percent`). Do not hand-format numbers.

## Rules

1. **One big number first.** Each panel opens with the single figure the
   player cares about, then its trend, then the levers.
2. **Every action states its price and its payoff** before the click, and its
   reason when disabled. No bare disabled buttons.
3. **Say it like a person.** Short sentences, the player's vocabulary, no
   system names. Italian and English are both first-class.
4. **Nothing moves unless it means something.** Motion marks a change of
   state; honour `prefers-reduced-motion`.
5. **Keyboard and screen reader complete.** Real buttons, visible focus,
   labelled controls, `aria-live` for results.
6. **Sound confirms, never nags.** `useSfx()` on commit, not on hover.

## Screen map

- **Home** — the planet turning, the save you were playing, and five ways in.
- **New game** — pick a mode first (what am I trying to do?), then world,
  nation, difficulty.
- **Play** — HUD (top), dock + drawer (left), briefing (right), stage
  (Earth / Moon / Mars / System), overlays and the selected-country card
  (bottom).
