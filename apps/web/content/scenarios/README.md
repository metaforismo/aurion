# Scenarios

This folder contains the data-driven scenarios shipped with Aurion. The engine
is scenario-agnostic: a scenario is just a JSON file conforming to the
`Scenario` type exported by `@aurion/engine`, plus parallel i18n string files
(one per supported locale).

## Files in this folder

For every scenario `<id>` you author three files:

```
<id>.json          # the scenario data, conforming to Scenario type
<id>.it.json       # Italian i18n strings
<id>.en.json       # English i18n strings
```

The current scenarios are:

- `ascesa-aurion.json` (+ `.it.json`, `.en.json`) — Phase 1, fictional world,
  the player leads the small republic of Aurion.

Plus a single `validate.ts` that type-checks any scenario JSON against the
engine's `Scenario` type and verifies cross-references and i18n coverage.

## How to add a new scenario

1. **Pick an id.** Kebab-case, unique across all scenarios — it doubles as the
   filename prefix and as `Scenario.id`. Example: `guerra-fredda`.

2. **Create `<id>.json`.** Mirror the structure of `ascesa-aurion.json`. The
   minimum surface area is:
   - `id`, `nameKey`, `descriptionKey`, `version`, `startTick`
   - `playableCountries: CountryId[]` — the small/medium nations the human
     player may pick at game setup
   - `countries: CountryInit[]` — every country in the world with its
     economy/military/intelligence/politics initial state. **Every country's
     `economy.sectors` must sum to 1.0 (± 0.001).** Non-player countries must
     have an `aiPersonality`; the player country must not.
   - `relations: RelationInit[]` — only include pairs that diverge from the
     default `attitude: 0`. Each relation must reference real country IDs and
     the two IDs must differ.
   - `techTree: TechDefinition[]` — branches are `civil | military | intelligence | space`.
     Tech IDs are conventionally prefixed by branch (e.g. `tech_civil_irrigation`,
     `tech_space_mars_colony`). `prereqs` must reference real tech IDs.
   - `eventPool: EventDefinition[]` — narrative events with `trigger` (one of
     `periodic | condition | random`) and 2–4 `choices`, each with effects.
     Event IDs are conventionally prefixed by category (e.g.
     `event_diplomacy_border_incident`).
   - `victoryConditions: VictoryConditionDef[]` — composable `VictoryRule`s
     evaluated by the engine. The five canonical conditions (`economic`,
     `military`, `scientific`, `diplomatic`, `domination`) are documented in
     the engine's type file.
   - `difficulties: DifficultyTuning[]` — Phase 1 scenarios ship with exactly
     one entry (`{ id: "normal", ... }`); Phase 2 will introduce three.

3. **Add the i18n files `<id>.it.json` and `<id>.en.json`.** Every key
   referenced by a `*Key` field in the scenario JSON (e.g. `nameKey`,
   `descriptionKey`, `capitalKey`, `labelKey`) must exist in **both** locale
   files. The two files share an identical key set; only the values differ.
   Italian copy should sound natural and immersive; English should be
   idiomatic, not a literal transliteration of the Italian.

   The validator emits a warning for any orphan keys (entries present in the
   locale files but not referenced anywhere in the scenario), so it is easy
   to keep the locale files trim.

4. **Run the validator.**

   ```bash
   pnpm --filter @aurion/engine exec tsx ../../apps/web/content/scenarios/validate.ts
   ```

   Equivalently, from the repo root:

   ```bash
   pnpm --filter @aurion/web exec tsx content/scenarios/validate.ts
   ```

   The script:

   - imports the scenario JSON with `with { type: 'json' }` and assigns it to
     a `Scenario`-typed variable, so any structural mismatch fails at compile
     time;
   - walks the scenario tree and ensures every `*Key` value has translations
     in both `.it.json` and `.en.json`;
   - checks that `economy.sectors` sums to 1.0 for every country;
   - checks that `playableCountries`, `relations`, `eventPool` effects, and
     `victoryConditions` reference only real country / tech IDs;
   - exits 0 on success, 1 on any validation failure;
   - prints summary stats (number of countries, techs, events, i18n keys, AI
     archetype distribution).

   The script intentionally lives next to the scenario data so authors can
   re-run it as part of their normal edit loop without touching the engine
   or web app.

5. **(Optional) extend the validator.** If a future scenario adds new
   referencing patterns (e.g. a new `EventEffect` variant, or a victory rule
   referring to another scenario object), update `validate.ts` with the
   matching cross-reference check. The script's structure is one explicit
   block per check.

## Conventions

- **Numbers** in the JSON are integers or have at most 4 decimals — keep
  floating-point junk out of the data.
- **Country IDs** are kebab-case (`aurion`, `federazione-borea`). They must
  not contain `::` (the engine uses `A::B` as a stable relation key).
- **Tech IDs** are prefixed by branch: `tech_civil_…`, `tech_military_…`,
  `tech_intel_…`, `tech_space_…`.
- **Event IDs** are prefixed by category: `event_diplomacy_…`,
  `event_economy_…`, `event_social_…`, `event_military_…`, `event_spy_…`,
  `event_space_…`, `event_intel_…`.
- **i18n keys** mirror the data hierarchy with dots:
  `tech.civil.irrigation.name`, `event.diplomacy.border_incident.choice.protest`,
  `country.aurion.capital`, etc. Stick to the same scheme so the locale file
  diffs stay small and reviewable.
- **No real-world country names**, alphabets, religions, or politicians.
  Every name in the world is invented.
