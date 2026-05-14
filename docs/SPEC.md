# Design: Gioco strategico-politico "tipo Plague Inc."

> Spec **Fase 1** — Core engine giocabile + 1 scenario completo end-to-end.
> Date: 2026-05-14. Plan path: `/Users/francescogiannicola/.claude/plans/voglio-creare-un-gioco-cozy-milner.md`.

---

## Context

L'utente vuole creare un gioco strategico in stile Plague Inc. ma con tema **politico-geopolitico**: si parte da un piccolo paese e si fa crescere investendo in ricerca, esercito, intelligence (spie), economia, diplomazia e politica interna, fino a raggiungere una *win condition* (es. diventare prima superpotenza, dominare militarmente, completare un programma spaziale).

Il gioco completo è ambizioso (scenari multipli, difficoltà multiple, tech tree profondo, eventi, polish). È stato deciso esplicitamente di **decomporre in 3 fasi** per evitare uno spec gigante e lavorare iterativamente:

- **Fase 1 (questo spec):** core engine giocabile + 1 scenario completo, 1 difficoltà, mondo fittizio.
- **Fase 2 (spec futuro):** scenari aggiuntivi (mondo contemporaneo, Guerra Fredda, ecc.), 3 difficoltà, framework data-driven già pronto.
- **Fase 3 (spec futuro):** polish, tech tree profondo, eventi narrativi avanzati, audio, achievements, eventuale cloud sync.

**Outcome atteso della Fase 1:** un'app web giocabile in cui in 30-60 min si può completare una partita end-to-end (vittoria o sconfitta), con tutti e 6 i sistemi di gioco funzionanti, e un'engine pulita testabile/portabile.

## Vincoli e decisioni chiave

| # | Decisione | Scelta |
|---|---|---|
| 1 | Scope iniziale | Engine + 1 scenario completo |
| 2 | Stack | Next.js 16 (App Router) + TS, **logica di gioco isolata** in package senza React (mobile-ready) |
| 3 | Tempo di gioco | **Real-time pausabile**, velocità 1x/2x/4x + pausa |
| 4 | Fantasia centrale | Ascesa di una piccola potenza, spie come strumento centrale |
| 5 | Win conditions | **Multiple selezionabili** dal giocatore (Economica, Militare, Scientifica/Spaziale, Diplomatica, Dominio totale) |
| 6 | Setting Fase 1 | Mondo **fittizio**, ~25 nazioni inventate |
| 7 | Sistemi | **6**: Economia, Ricerca, Militare, Spie, Diplomazia, **Politica interna a fazioni** |
| 8 | Programma spaziale | Ramo del tech tree Ricerca |
| 9 | Lingua UI | Italiano + Inglese da subito (next-intl) |
| 10 | Persistenza | **IndexedDB locale** (Dexie), multi-slot + autosave + esporta/importa JSON |
| 11 | Backend | Nessuno (single-player puro, deploy statico/SSR su Vercel) |
| 12 | Durata partita | 30-60 min reali, ~30-50 nodi tech tree, ~200-800 tick (numero esatto e intervallo reale per tick saranno tunati nel bilanciamento) |
| 13 | Architettura | **Monorepo** con `packages/engine` (TS puro) + `apps/web` (Next.js) |
| 14 | RNG | Seedabile (mulberry32) per partite riproducibili e save deterministici |
| 15 | Game state | Immutabile, `tick()` e `applyAction()` sono pure functions |

---

## Architettura

### Struttura del repository

```
gioco/
├── packages/
│   └── engine/                    ← TypeScript puro, NO React, NO DOM
│       ├── src/
│       │   ├── types.ts
│       │   ├── createGame.ts
│       │   ├── tick.ts
│       │   ├── actions/           ← un reducer per azione
│       │   ├── ai/                ← decisioni nazioni non-player
│       │   ├── checkWinLoss.ts
│       │   ├── rng.ts             ← mulberry32 seedato
│       │   └── index.ts
│       ├── tests/                 ← Vitest
│       ├── scripts/sim.ts         ← simulation runner headless
│       ├── package.json
│       └── vitest.config.ts
│
├── apps/
│   └── web/                       ← Next.js 16
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx           ← home
│       │   ├── new/page.tsx       ← setup partita
│       │   └── play/[saveId]/page.tsx
│       ├── components/
│       │   ├── Map/               ← SVG mappa + interazioni
│       │   ├── Hud/               ← barra superiore
│       │   ├── Panels/            ← 6 pannelli sistemi
│       │   ├── Notifications/
│       │   └── Modals/
│       ├── lib/
│       │   ├── store.ts           ← Zustand wrapper sopra l'engine
│       │   ├── ticker.ts          ← rAF loop
│       │   ├── persistence.ts     ← Dexie/IndexedDB
│       │   └── i18n.ts            ← next-intl
│       ├── content/
│       │   ├── scenarios/
│       │   │   └── ascesa-aurion.json     ← scenario Fase 1
│       │   └── messages/
│       │       ├── it.json
│       │       └── en.json
│       ├── tests/                 ← Playwright E2E
│       └── package.json
│
├── package.json                   ← workspace root
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

### Stack

- **Package manager:** pnpm
- **Build orchestrator:** Turborepo
- **Engine:** TypeScript 5.x puro, Vitest, fast-check
- **Web:** Next.js 16 App Router, React 19, Tailwind 4, shadcn/ui per primitivi
- **State management:** Zustand (wrapper sopra l'engine)
- **Mappa:** SVG inline + React (~25 nazioni, performance ok, facile da animare)
- **Persistenza:** Dexie su IndexedDB
- **i18n:** next-intl
- **E2E:** Playwright
- **Deploy:** Vercel

### Boundary critico

`packages/engine` **non importa nulla di React/DOM/Next.js**. Questo è enforced da:
- ESLint rule `no-restricted-imports` su react/next/dom-related modules
- tsconfig dell'engine senza `lib: ["dom"]`

Questo vincolo è la chiave per:
- testare l'engine in isolamento (fast unit test, niente jsdom)
- riusare l'engine in futuro per app mobile (React Native/Expo) senza riscriverlo
- eventualmente girare l'engine in un Web Worker in Fase 3 senza refactoring

---

## Modello dati (`packages/engine/src/types.ts`)

```ts
// Stato globale di una partita
type GameState = {
  tick: number                          // 1 tick = 1 settimana
  scenarioId: string
  playerCountryId: string
  countries: Record<CountryId, Country>
  relations: Record<RelationKey, Relation>
  techTreeProgress: Record<CountryId, ResearchProgress>
  spyOperations: SpyOperation[]
  events: GameEvent[]                   // ultimi N eventi narrativi
  worldTension: number                  // 0-100
  winLoss: 'playing' | 'won' | 'lost'
  selectedVictoryCondition: VictoryConditionId
  rngSeed: string
}

type Country = {
  id: CountryId
  name: string                          // chiave i18n
  color: string
  regionId: string
  capital: string

  economy: {
    treasury: number
    gdp: number
    weeklyIncome: number
    taxRate: number                     // 0-100
    sectors: {                          // share del PIL, somma = 1.0
      agriculture: number
      industry: number
      services: number
      tech: number
    }
  }

  military: {
    armySize: number
    navy: number
    airforce: number
    doctrineLevel: number
    deployedUnits: Deployment[]
  }

  science: {
    researchOutput: number              // punti/settimana
    activeResearch: TechId | null
    completedTechs: TechId[]
  }

  intelligence: {
    spyCount: number
    counterIntelLevel: number
    knownIntel: Record<CountryId, IntelLevel>
  }

  politics: {
    popularity: number                  // 0-100
    factions: Record<FactionId, FactionState>  // 5 fazioni: 'army' | 'business' | 'religious' | 'populist' | 'reformist'
    governmentType: GovernmentType
  }
  // FactionState = { satisfaction: number /* 0-100 */, influence: number /* 0-100, peso politico */ }

  isPlayer: boolean
  aiPersonality?: AiPersonality         // solo non-player
}

type SpyOperation = {
  id: string
  type: 'steal_tech' | 'sabotage' | 'propaganda' | 'destabilize' | 'assassinate'
  ownerCountryId: CountryId
  targetCountryId: CountryId
  payload: SpyPayload
  progressTicks: number
  durationTicks: number
  successProbability: number            // calcolata al lancio
  detectionRisk: number
  status: 'active' | 'completed' | 'detected' | 'failed'
}

type Action =
  | { type: 'invest', target: 'economy'|'research'|'military'|'intel'|'infra', amount: number }
  | { type: 'deploySpy', op: Omit<SpyOperation, 'id'|'status'|'progressTicks'> }
  | { type: 'startResearch', techId: TechId }
  | { type: 'setTaxRate', rate: number }
  | { type: 'diplomacy', target: CountryId, kind: 'proposeAlliance'|'breakAlliance'|'imposeSanction'|'liftSanction'|'tradeDeal'|'declareWar'|'sueForPeace' }
  | { type: 'deployArmy', target: RegionId, units: number }
  | { type: 'placateFaction', factionId: FactionId }

// API pubblica dell'engine
function createGame(scenario: Scenario, options: { seed?: string, victory: VictoryConditionId, playerCountryId: string }): GameState
function tick(state: GameState): GameState                                  // pure
function applyAction(state: GameState, action: Action): { state: GameState, errors: string[] }
function getAvailableActions(state: GameState, countryId: string): Action[]
function checkWinLoss(state: GameState): GameState['winLoss']
```

### Scenario file (data-driven)

`apps/web/content/scenarios/ascesa-aurion.json`:

```ts
type Scenario = {
  id: string
  nameKey: string
  descriptionKey: string
  version: string
  startTick: number
  countries: CountryInit[]              // ~25
  relations: RelationInit[]
  techTree: TechDefinition[]            // ~30-50 nodi, 4 rami: militare/civile/intel/spaziale
  eventPool: EventDefinition[]          // ~20-30 eventi narrativi
  victoryConditions: VictoryConditionDef[]   // 5 selezionabili
  difficultyTuning: { /* Fase 1: 1 set; Fase 2: 3 */ }
}
```

L'engine non sa nulla di un mondo specifico: è solo input data. Aggiungere scenari in Fase 2 = nuovi file JSON.

---

## Game loop e simulazione

### UI ticker (`apps/web/lib/ticker.ts`)

- Loop con `requestAnimationFrame`
- Velocità (valori indicativi, finalizzati nel bilanciamento): pause | 1x (~2000ms/tick) | 2x (~1000ms/tick) | 4x (~500ms/tick)
- Pausa automatica quando: tab non visibile, modale evento aperto, fine partita
- Le **azioni del giocatore** sono istantanee. Le entità "in corso" (ricerca, spie, deploy) avanzano nel `tick()`.
- **Target durata partita:** 30-60 min reali. Il tempo di gioco attivo (tick effettivamente eseguiti) è una frazione del totale: la maggior parte del tempo il giocatore passa in pausa per leggere eventi, pianificare azioni, navigare pannelli. Ordine di grandezza: 200-800 tick attivi per partita completa.

### Ciclo di un tick (`packages/engine/src/tick.ts`)

```
tick(state):
  1. Economia: weeklyIncome → treasury per ogni country
  2. Ricerca: avanza activeResearch, completa tech se raggiunge cost
  3. Spy operations: avanza, rolla success/detection se completa
  4. Military: avanza deployment, risolvi battaglie
  5. Politica: aggiorna popolarità (drift verso baseline + modifiers)
  6. Fazioni: aggiorna soddisfazione in base a investimenti recenti
  7. AI turn: ogni country non-player decide azioni (scaglionato per perf)
  8. Eventi: trigger eventi narrativi se condizioni
  9. World tension: ricalcola
  10. checkWinLoss(): aggiorna winLoss
  return new GameState
```

### AI delle altre nazioni (Fase 1: euristiche pesate per archetipo)

Ogni nazione non-player ha:
- **Profilo numerico:** `aggressiveness`, `expansionism`, `paranoia`, `pragmatism` (0-1)
- **Archetipo:** `pacifist_trader`, `regional_bully`, `cold_isolationist`, `opportunist`, `superpower`

Decisione (utility-style, semplice):
```
score(action) = base_value(archetype, action.type)
              + situational_modifier(state, action)
              + relationship_modifier(target, attitude)
              + seeded_random_noise()
choose argmax con ε-greedy exploration
```

Nessun ML. Espandibile a behavior tree o utility-AI vero in Fase 3.

### Sistema eventi narrativi (~20-30 in Fase 1)

Ogni evento è una definizione data-driven:
```ts
{
  id, nameKey, descriptionKey,
  trigger: { type: 'periodic'|'condition'|'random', params },
  conditions: [...],
  cooldownTicks: number,
  weight: number,
  choices: [{ labelKey, effects: [{ type:'modifyStat', target, stat, delta }, ...] }]
}
```

Quando triggera, il loop si auto-pausa, modal evento appare, il giocatore sceglie, effetti applicati, loop riparte.

### Win/Loss (`checkWinLoss`)

Vittoria: regola del `selectedVictoryCondition` soddisfatta.
Sconfitta (hardcoded):
- popularity < 10 per 12 settimane → rovesciamento
- treasury < 0 per 26 settimane → fallimento
- capitale occupata da nemico → conquista
- tutte le fazioni a soddisfazione < 20 → colpo di stato

---

## UI/UX

### Schermate

1. **Home (`/`)**: logo, "Nuova partita", "Continua" (mostra slot di save), selettore lingua.
2. **Setup nuova partita (`/new`)**: 3 step → scenario → paese di partenza (5 paesi giocabili) → win condition.
3. **Partita (`/play/[saveId]`)**: schermata principale (vedi layout sotto).

### Layout schermata di gioco

```
┌─────────────────────────────────────────────────────────────────┐
│ HUD TOP                                                          │
│ [📅 Sett 12, Anno 2]  [💰 5.2B]  [😊 67%]  [⏸ ▶ ▶▶ ▶▶▶]  [💾☰] │
├──────────────┬──────────────────────────────────┬────────────────┤
│              │                                  │                │
│  PANNELLO    │                                  │   NOTIFICHE    │
│  SINISTRO    │       MAPPA SVG                  │   STREAM       │
│  (azioni)    │       (~70% spazio)              │   (eventi)     │
│              │                                  │                │
│ • Economia   │   - Click nazione → seleziona    │ • Tech X       │
│ • Ricerca    │   - Hover → tooltip              │   completata   │
│ • Militare   │   - Player evidenziato           │ • Sanzioni     │
│ • Spie       │   - Heat overlay opzionale       │   da Borealis  │
│ • Diplomazia │                                  │ • Spia rilev.  │
│ • Politica   │                                  │                │
└──────────────┴──────────────────────────────────┴────────────────┘
```

### Pannelli (6 sistemi)

Ognuno mostra **stato** + **azioni**:
- **Economia**: treasury, weeklyIncome, breakdown sectors, slider tasse, investimenti infra
- **Ricerca**: tech tree visualizzato a 4 rami, tech attivo, completed
- **Militare**: forze, doctrine, deployment, addestra/deploy
- **Spie**: spy count, op attive con barra progresso, "lancia operazione" (modal con tipo/target/payload/probabilità)
- **Diplomazia**: lista nazioni con relazione, trattati, azioni per nazione selezionata
- **Politica**: 5 fazioni con barre soddisfazione, popolarità, eventi recenti

### Mappa (interazioni)
- Click nazione → seleziona, apre dettaglio (relazione, intel, azioni dirette)
- Hover → tooltip rapido
- Toggle overlay: tensione, alleanze, intelligence noto

### Modali
- Conferma azioni costose/irreversibili
- Eventi narrativi (auto-pausa loop)
- Vittoria/sconfitta (summary stats)
- Tutorial steps minimi (Fase 1: tooltip; tutorial vero in Fase 3)

### Mobile-readiness
La UI Fase 1 è ottimizzata desktop, ma **non rompe mobile**: pannelli laterali → bottom drawer su <1024px, mappa pinch-zoom, layout stack.

> **Visual polish (palette, font, stile mappa)** sarà definito in un workshop visivo separato col Visual Companion appena usciamo da plan mode. Lo spec definisce struttura e flussi, non lo skin.

---

## Testing strategy

### `packages/engine` (priorità alta)

- **Unit test (Vitest)** per ogni reducer in `actions/`: input → expected output
- **Property-based (fast-check)** per invarianti: "treasury non va negativa senza azione che la riduca", "tick aumenta sempre di 1", "applyAction è pura"
- **Determinismo:** stesso seed + stesse azioni → hash stato finale identico (regression test)
- **Headless simulation** (`scripts/sim.ts`): N partite con AI random per ogni ruolo → verifica che almeno X% completi e Y% siano vinte
- **Coverage target:** ≥80% su reducer e tick

### `apps/web`

- **Component test leggeri** (Vitest + testing-library) per Map, TechTree
- **E2E smoke (Playwright):**
  1. Nuova partita → vedi tick avanzare
  2. Apri pannello ricerca → start research → tick → tech sbloccata
  3. Salva → ricarica → continua → stato uguale
  4. Vinci con cheat (helper test-only) → vedi schermata vittoria

---

## Error handling

- **Engine:** non lancia mai per input invalido del giocatore. `applyAction` ritorna `{ state, errors: string[] }` (chiavi i18n).
- **UI:** errori engine → toast. Errori inattesi → React Error Boundary salva snapshot in IndexedDB e mostra "scarica report".
- **Persistenza:** save fail → modale che chiede di esportare e liberare spazio. **Mai perdere dati silenziosamente.**
- **Save corrotto/incompatibile:** ogni save ha `engineVersion`. Al load, prova migrazione (Fase 1: tabella vuota, struttura pronta) o blocca con messaggio chiaro + opzione esporta vecchio.

---

## Persistenza (Dexie / IndexedDB)

```ts
const db = new Dexie('giocoPolitico')
db.version(1).stores({
  saves: '&id, name, scenarioId, savedAt',
  meta:  '&key',
})

type SaveEntry = {
  id: string                            // uuid
  name: string                          // user-given o auto
  scenarioId: string
  engineVersion: string
  state: GameState
  savedAt: number                       // ts
  thumbnailColor: string
}
```

- **Autosave** ogni 30 tick di gioco su slot `__autosave`
- **Manual save** dal menu HUD
- **Esporta** come `.json`
- **Importa** drag&drop, valida, carica

---

## File critici da creare

### Engine (`packages/engine/`)
- `src/types.ts` — tutti i tipi
- `src/createGame.ts` — factory
- `src/tick.ts` — funzione di tick principale
- `src/actions/*.ts` — un file per tipo di azione
- `src/ai/index.ts` — decisioni AI (utility scoring per archetipo)
- `src/checkWinLoss.ts`
- `src/rng.ts` — PRNG seedato (mulberry32)
- `src/index.ts` — API pubblica
- `tests/*.test.ts` — Vitest
- `scripts/sim.ts` — simulation runner headless

### Web app (`apps/web/`)
- `app/layout.tsx`, `app/page.tsx`, `app/new/page.tsx`, `app/play/[saveId]/page.tsx`
- `components/Map/` — mappa SVG con overlay
- `components/Hud/` — barra superiore
- `components/Panels/{Economy,Research,Military,Spies,Diplomacy,Politics}.tsx`
- `components/Notifications/Stream.tsx`
- `components/Modals/{Event,Confirm,WinLoss,Tutorial}.tsx`
- `lib/store.ts` — Zustand store (wrapper engine)
- `lib/ticker.ts` — rAF loop
- `lib/persistence.ts` — Dexie wrapper
- `lib/i18n.ts` — next-intl setup
- `content/scenarios/ascesa-aurion.json` — scenario completo Fase 1
- `content/messages/it.json`, `content/messages/en.json`
- `tests/e2e/*.spec.ts` — Playwright

### Root
- `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `package.json`

---

## Verifica end-to-end della Fase 1

Considero la Fase 1 "fatta" quando tutti questi check passano:

1. `pnpm --filter engine test` → tutti verdi, coverage ≥80%
2. `pnpm --filter engine sim` → 100 partite simulate finiscono in ≤60 min di gioco-equivalente, distribuzione ragionevole vittorie/sconfitte
3. `pnpm dev` parte senza errori, `localhost:3000` carica
4. `pnpm test:e2e` → tutti i flussi smoke verdi
5. **Smoke manuale (golden path) in browser:**
   - Home → Nuova partita → scegli paese → scegli win condition economica → play
   - Partita reale: investi economia, ricerca tech civile, lancia spia (steal_tech) → fallisce → vedi notifica e popolarità in calo
   - Passano ~50 tick fluidi a 4x
   - Tab switch → pausa auto; ritorno → resume
   - Modale evento → scegli → effetto applicato
   - Salva → ricarica pagina → continua → stato uguale
   - Esporta JSON → cancella IndexedDB → importa → riprende
   - Vinci → schermata vittoria con stat finali
6. **Lighthouse / Web Vitals**: nessun frame drop sotto 60fps fuori dal tick, FCP < 2s
7. **Bilanciamento manuale**: 5 partite reali completate dall'utente → almeno 1 vittoria e 1 sconfitta plausibili (non auto-vincenti né impossibili)

---

## Out of scope per questa Fase 1 (esplicitamente)

Tutto questo arriva in Fase 2 o 3. Non implementarlo ora:

- ❌ Scenari multipli (oltre "Ascesa di Aurion")
- ❌ Difficoltà multiple (solo 1 in Fase 1)
- ❌ Tutorial completo guidato (solo tooltip minimi)
- ❌ Audio / musica / SFX
- ❌ Achievements / progressione meta tra partite
- ❌ Cloud sync / account / leaderboard
- ❌ AI sofisticata (behavior tree, ML)
- ❌ Eventi narrativi oltre i ~20-30 base
- ❌ Tech tree oltre i ~30-50 nodi
- ❌ Mobile-app native (solo: la web responsive non si rompe)
- ❌ Politica interna avanzata (es. elezioni, cambi di governo) — solo fazioni a 5 con soddisfazione

---

## Prossimi passi

1. **Review utente di questo spec** (lettura e conferma o richiesta modifiche)
2. **ExitPlanMode** quando approvato
3. In una nuova sessione: invocare la skill `writing-plans` per creare il piano di implementazione dettagliato (task per task) basato su questo spec
4. Iniziare l'implementazione (con il visual companion attivo per le decisioni di stile UI quando arriviamo a quella parte)
