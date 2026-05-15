# Aurion — Fase 2 Design

> Spec **Fase 2** — Espansione contenuti dopo che la Fase 1 (engine + scenario "Ascesa di Aurion") è shipped e funzionante.
> Date: 2026-05-15. Spec Fase 1: `docs/SPEC.md` (frozen).

---

## Context

La Fase 1 ha consegnato un engine TS puro pienamente data-driven (`Scenario` come unica sorgente di verità) e un primo scenario completo, *Ascesa di Aurion* — ~25 nazioni inventate, ~30 nodi tech tree, ~20 eventi, 5 win condition, 1 sola difficoltà ("normal"). Sei sistemi (Economia, Ricerca, Militare, Spie, Diplomazia, Politica a fazioni) sono giocabili end-to-end, c'è autosave + import/export, IT+EN, e una sim headless per il bilanciamento. La build è verde su CI: typecheck, lint, test engine, e2e Playwright.

La Fase 2 attiva ciò che la Fase 1 ha lasciato esplicitamente in sospeso: **più scenari** (mondo contemporaneo, Guerra Fredda, una "Quick Start" come tutorial alternativo), **3 difficoltà reali** con modificatori che cambiano l'esperienza, **bilanciamento più profondo** sostenuto da nuove metriche di sim, e i **piccoli aggiustamenti di engine** che servono a far funzionare le ambientazioni non-fittizie (regioni geografiche reali, ruoli politici neutri, tech tree contestuali). Nessun salto di stack: tutto si appoggia all'engine già esistente — l'API pubblica non cambia, cambia solo cosa gli si passa in input.

Il "wow" visibile per il giocatore: aprire una nuova partita e poter scegliere fra **scenario** (4 opzioni) × **difficoltà** (3 + 1 opzionale) × **paese giocabile** × **win condition**. Lo stesso engine produce esperienze drasticamente diverse — partita lampo da 15 minuti su Quick Start in Easy, oppure 90 minuti di Guerra Fredda in Hard senza autosave.

---

## Goals (cosa cambia per il giocatore)

- **Scelta dello scenario** nel new-game wizard: 4 scenari distinti con tono, mappa e tech tree diversi (Ascesa di Aurion, Mondo Contemporaneo, Guerra Fredda, Quick Start).
- **Scelta della difficoltà** prima di iniziare: Easy / Normal / Hard, con descrizioni concrete di cosa cambia ("AI meno aggressiva, +30% reddito iniziale, eventi negativi attenuati").
- **Modalità Iron Man (opzionale, gated)**: niente autosave, niente save manuali, solo permadeath. Pensata per chi ha già finito Hard.
- **Quick Start** come on-ramp: 8 nazioni, una sola regione, ~15 min reali, win condition fissa (economica). È il sostituto del tutorial scriptato, non programmato per Fase 2.
- **Bilanciamento sensibilmente migliore**: la sim diventa lo strumento di tuning principale, le distribuzioni vittorie/sconfitte rispettano i target per ogni triple (scenario, difficoltà, win condition).

---

## Non-goals (cosa NON è in Fase 2)

Tutto ciò che la Fase 1 ha rinviato e non è qui sopra. Esplicitamente:

- ❌ Polish visivo profondo (palette finale, illustrazioni, motion design) — Fase 3
- ❌ Audio / musica / SFX — Fase 3
- ❌ Cloud sync, account, leaderboard, achievement — Fase 3
- ❌ AI ML / behavior tree veri — restano euristiche utility-style (espandibili, non riscritte)
- ❌ App mobile native — la web responsive non si rompe, nient'altro
- ❌ Editor di scenari in-game / mod system — Fase 3
- ❌ Tech tree di profondità Civ-like (>100 nodi) — restiamo ~30-50 per scenario
- ❌ Eventi dinamici cross-scenario o storia continua fra partite
- ❌ Replay / time-travel debug — c'è già il seed deterministico, basta
- ❌ Scenari con meccaniche radicalmente nuove (es. carestie, religioni come sistema separato) — Fase 3
- ❌ Tutorial guidato passo-passo — Quick Start lo sostituisce in Fase 2

Se un'idea non serve direttamente "più scenari + difficoltà significative + bilanciamento", va in Fase 3.

---

## Scenari in Fase 2 (concreti)

Quattro scenari totali. Uno esiste già; tre da scrivere.

### Riepilogo

| Scenario | Stato | # Nazioni | # Regioni | Tech tree | Eventi | Tono | Durata target |
|---|---|---|---|---|---|---|---|
| `ascesa-aurion` | esistente | ~25 | 5 | ~30 | ~20-30 | fantasy soft, geopolitica inventata | 30-60 min |
| `mondo-contemporaneo` | nuovo | ~30 | 6 (continenti) | ~40 | ~30 | tecnocratico, attuale, neutro | 45-75 min |
| `guerra-fredda` | nuovo | ~24 | 5 (blocchi) | ~35 | ~30 | drammatico anni '60, decolonizzazione | 45-90 min |
| `quick-start` | nuovo | 8 | 1 | ~12 | ~10 | tutorial-lite, vittoria veloce | 10-20 min |

### `ascesa-aurion` (esistente — base case)

Resta intoccato salvo:
- Il file scenario aggiunge gli altri due `DifficultyTuning` (easy, hard) — il validator viene aggiornato di conseguenza.
- Eventuali rebalance derivanti dai nuovi target di sim (vedi sezione Balancing) — modifiche numeriche, no struttura.

### `mondo-contemporaneo` (nuovo)

**Pitch.** Anno 2026 fittizio. Il giocatore eredita una potenza media reale (Italia, Brasile, Sud Africa, Indonesia, Polonia — paesi giocabili pensati per essere "sotto il livello superpotenza ma non microstati") e prova a portarla in cima al ranking globale entro 20-30 anni di gioco. ~30 nazioni che approssimano i player geopolitici reali, raggruppate in 6 regioni continentali (Europa, Nord America, Sud America, Africa, Asia, Oceania).

**Differenze da Ascesa di Aurion.**
- 30 nazioni invece di 25, distribuite su 6 regioni (vs 5).
- I "superpoteri di partenza" (USA, Cina, Russia, India, UE-aggregata) hanno GDP 8-15× quello del player → la win condition `military domination` è quasi impossibile, lo scenario inclina verso `economic` / `scientific` / `diplomatic`.
- Tech tree: stesso engine, ma i 40 nodi sono nominati in modo contemporaneo (`tech_renewable_grid`, `tech_quantum_compute`, `tech_lunar_base`) — niente "carri armati a vapore".
- Eventi narrativi a sapore attuale: crisi energetiche, pandemie, accordi climatici, escalation cyber. Nessun riferimento a eventi reali specifici (vedi "Sensitivity").
- AI: i 5 superpoteri usano archetipo `superpower`; le potenze regionali sono `regional_bully` o `pacifist_trader`; i piccoli stati `cold_isolationist` o `opportunist`.
- Win condition extra implicita: `economic` viene definita come "top 5 GDP" (rankAtMost: 5) invece di top 3 — è realisticamente raggiungibile.

### `guerra-fredda` (nuovo)

**Pitch.** 1962 fittizio. Il mondo è bipolare: blocco occidentale, blocco orientale, e un "movimento dei non allineati" che decolonizza. Il giocatore può scegliere fra una potenza media di entrambi i blocchi (es. Francia-stand-in, Polonia-stand-in) o un paese non allineato che cerca di trasformarsi (Egitto-stand-in, India-stand-in, Indonesia-stand-in). Il finale di partita arriva intorno al 1985 in tempo di gioco (~25 anni).

**Differenze da Ascesa di Aurion.**
- 24 nazioni, 5 regioni (Atlantico, Oriente sovietico, Asia, Africa, Sudamerica).
- Due "egemoni" hard-coded come `superpower` con GDP enorme e doctrineLevel alto. Le loro relazioni partono a -80, sono bloccate al "cold war" status (alleanza diretta impossibile, sanzioni reciproche permanenti).
- Tech tree con sapore '60-'80: `tech_icbm`, `tech_satellite_recon`, `tech_nuclear_submarine`, `tech_lunar_program`. Il ramo `space` è la corsa allo spazio vera e propria — vincere `scientific` significa arrivare prima alla luna o a una stazione orbitale.
- Eventi narrativi: missili in regioni vicine ("crisi missilistica generica"), colpi di stato sostenuti da agenzie d'intelligence (`spawnSpy` con `destabilize`), conferenze di disarmo, decolonizzazione (un evento periodico ogni ~50 tick spawna un nuovo paese non allineato — ma per Fase 2 lo modelliamo come "un paese AI cambia archetipo da `cold_isolationist` a `opportunist`", non spawnando dinamicamente nuove entries).
- Win condition: `domination` viene resa più stringente (controllare 25 paesi su 24 — di fatto disabilitata); enfasi su `scientific` (corsa spaziale), `diplomatic` (60% del mondo allineato con te), `economic` (top 2).
- Bias di partenza: relazioni iniziali clusterizzate per blocco; sanzioni preinstallate fra i due blocchi.

### `quick-start` (nuovo, opzionale ma raccomandato)

**Pitch.** 8 nazioni in un'unica regione fittizia (riusa il setting di Aurion, scelta una sola regione). Tech tree ridotto a 12 nodi. Win condition prefissata (`economic` con `rankAtMost: 1`). Pensato per nuovi giocatori e per smoke-test E2E.

**Differenze.**
- È quasi un sottoinsieme di Ascesa di Aurion: stessa palette di tipi di eventi, stessi archetipi AI, ma drasticamente meno entità.
- Selezione difficoltà disabilitata, hardcoded a `easy`.
- Disponibilità Iron Man: no.
- Durata: 10-20 min reali. Serve come tutorial "imparo facendo" in attesa che la Fase 3 produca un tutorial scriptato vero.

---

## Difficulty levels (modificatori concreti)

In Fase 1 il tipo `DifficultyTuning.modifiers` ha 4 campi: `aiAggression`, `aiResearchSpeed`, `playerIncome`, `eventDifficulty`. La Fase 2 propone di **estendere** il tipo con altri 4 modificatori, perché senza non si distinguono in modo significativo le tre curve di gioco.

### Estensioni proposte al tipo `DifficultyTuning`

```ts
// in packages/engine/src/types.ts (modifica additiva, retro-compat)
export type DifficultyTuning = {
  id: string;
  nameKey: string;
  /** Multipliers applied during balancing. */
  modifiers: {
    // — esistenti (Fase 1) —
    aiAggression: number;          // 1.0 baseline, >1 = AI più aggressiva
    aiResearchSpeed: number;       // 1.0 baseline, >1 = AI ricerca più rapidamente
    playerIncome: number;          // 1.0 baseline, >1 = bonus reddito player
    eventDifficulty: number;       // 1.0 baseline, >1 = scelte negative più dure

    // — nuovi (Fase 2) —
    aiAllianceBias: number;        // 0..2 — bias AI a coalizzarsi contro player leader
    spyDetectionAgainstPlayer: number; // 1.0 baseline; >1 = spie player rilevate più facilmente
    lossToleranceWeeks: number;    // moltiplicatore sui contatori di sconfitta (popolarità, treasury, fazioni)
    eventChanceMultiplier: number; // 1.0 baseline; <1 = meno eventi (Easy), >1 = più eventi (Hard)
  };

  // — nuovi opzionali (Fase 2) —
  /** Se true: niente autosave, niente save manuali, niente import; solo una partita in corso. */
  ironMan?: boolean;
  /** Etichetta opzionale per UI ("Insane"). Default: derivata da nameKey. */
  badgeKey?: string;
};
```

**Giustificazione per ciascun nuovo modificatore.**

- `aiAllianceBias` — senza questo, la "coalizione contro il leader" è invisibile. In Hard, quando il player diventa primo in qualsiasi metrica, vogliamo che le AI inizino a stringere alleanze contro di lui (effetto "civilizations gang up"). Implementazione: l'AI di diplomazia moltiplica il bonus a `proposeAlliance` verso paesi nemici-del-leader per questo coefficiente.
- `spyDetectionAgainstPlayer` — separa la pressione "le tue spie sono rischiose" dal generico `aiAggression`. In Easy 0.7, in Hard 1.3.
- `lossToleranceWeeks` — i contatori di sconfitta della Fase 1 (`lowPopularityWeeks`, `negativeTreasuryWeeks`, ecc.) sono hardcoded a 12/26/N settimane. Moltiplicarli con questo coefficiente è il singolo modo più efficace per rendere Easy "perdonante" e Hard "implacabile" senza toccare la logica.
- `eventChanceMultiplier` — il rate di eventi è già un tuning parameter del loop. Esplicitarlo nel `DifficultyTuning` evita scenari che riusano lo stesso `eventPool` ma vogliono più o meno eventi a difficoltà diversa.

`ironMan` come booleano opzionale è ortogonale ai numerici: si combina con qualunque preset (in pratica solo Hard nella UI, ma tecnicamente valido ovunque).

### I tre preset

| Modificatore | Easy | Normal | Hard | Iron Man (sopra Hard) |
|---|---:|---:|---:|---:|
| `aiAggression` | 0.70 | 1.00 | 1.35 | 1.50 |
| `aiResearchSpeed` | 0.85 | 1.00 | 1.20 | 1.30 |
| `playerIncome` | 1.30 | 1.00 | 0.85 | 0.80 |
| `eventDifficulty` | 0.80 | 1.00 | 1.25 | 1.40 |
| `aiAllianceBias` | 0.50 | 1.00 | 1.50 | 1.75 |
| `spyDetectionAgainstPlayer` | 0.70 | 1.00 | 1.30 | 1.40 |
| `lossToleranceWeeks` | 1.50 | 1.00 | 0.75 | 0.60 |
| `eventChanceMultiplier` | 0.90 | 1.00 | 1.15 | 1.20 |
| `ironMan` | false | false | false | **true** |

Letta come prosa:
- **Easy** = il giocatore comincia ricco (+30% reddito), perde più lentamente (50% in più di tempo per i contatori di sconfitta), le AI non si coalizzano contro di lui, gli eventi negativi mordono meno. Target: 50% di vittorie su sim random.
- **Normal** = baseline corrente Fase 1, intoccato. Target: 25-35%.
- **Hard** = AI più aggressiva e più veloce in ricerca, reddito player ridotto, contatori di sconfitta accelerati, le AI coalizzano contro il leader. Target: 8-12%.
- **Iron Man** = come Hard ma con autosave/save disabilitati e una manciata di percentuali peggiori. Pensato per i giocatori che hanno già finito Hard almeno una volta — l'opzione è gated nella UI (vedi Architettura).

### Difficoltà ↔ scenario

Non tutte le combinazioni hanno senso:
- **Quick Start** è hardcoded a `easy`, niente UI per cambiare.
- **Mondo Contemporaneo** e **Guerra Fredda** e **Ascesa di Aurion** offrono tutte e 3 le difficoltà.
- **Iron Man** appare solo se il giocatore ha completato almeno una vittoria a Hard sullo scenario corrente (flag persistito in `meta` di Dexie). Altrimenti il toggle è disabilitato con tooltip "completa una vittoria a Hard per sbloccare".

---

## Architecture changes

L'engine in Fase 1 è già scenario-driven, quindi tutti i cambiamenti sono additivi e localizzati. Niente refactoring strutturale.

### Engine (`packages/engine/`)

- **`src/types.ts`** — estendere `DifficultyTuning.modifiers` (aggiunta dei 4 campi sopra), aggiungere `ironMan?: boolean` e `badgeKey?: string`. Modifica retro-compatibile: i save Fase 1 con `difficultyId: "normal"` continuano a caricare; il loader applica defaults per i campi mancanti (`aiAllianceBias: 1.0`, `spyDetectionAgainstPlayer: 1.0`, `lossToleranceWeeks: 1.0`, `eventChanceMultiplier: 1.0`).
- **`src/tick.ts`** — punti dove leggere i nuovi modificatori:
  - calcolo del reddito (`playerIncome` già consumato in Fase 1).
  - rate di trigger eventi → moltiplicato per `eventChanceMultiplier`.
  - aggiornamento di `_loseStreaks` → soglie moltiplicate per `lossToleranceWeeks`.
  - calcolo `successProbability` / `detectionRisk` di `SpyOperation` quando `ownerCountryId === playerCountryId` → applicare `spyDetectionAgainstPlayer` su `detectionRisk`.
- **`src/ai/index.ts`** — bias diplomatico verso "alleanza contro leader" moltiplicato per `aiAllianceBias`. Aggressività AI già consumata via `aiAggression`.
- **`src/checkWinLoss.ts`** — già legge `_loseStreaks`; verifica che i confronti contro le soglie usino le soglie scalate (non valori hardcoded).
- **`src/createGame.ts`** — accetta `difficultyId` (già supportato in Fase 1 come opzionale). Recuperare il `DifficultyTuning` corretto dallo scenario; errore se l'id non esiste; default `"normal"` se non specificato.
- **Nuovo: `src/migrations/v1tov2.ts`** — funzione pura che prende un `GameState` v1 e ritorna v2 popolando i defaults dei nuovi modificatori. Wired in `apps/web/lib/persistence.ts` al load.

### Web app (`apps/web/`)

- **`app/new/page.tsx`** (esistente) — diventa un wizard a 4 step: scenario → difficoltà → paese → win condition. In Fase 1 era 3 step (scenario hardcoded). I componenti sono additivi.
- **Nuovo: `components/NewGame/ScenarioPicker.tsx`** — griglia di card scenario con titolo, descrizione, durata stimata, # nazioni, tag (es. "Quick Start", "Storico", "Contemporaneo"). I dati arrivano da un nuovo file di indice `content/scenarios/index.ts` (vedi sotto).
- **Nuovo: `components/NewGame/DifficultyPicker.tsx`** — 3 card (Easy/Normal/Hard) + toggle Iron Man (gated). Ogni card ha 3-5 bullet "cosa cambia".
- **`lib/store.ts`** — il setup state ora porta `{ scenarioId, difficultyId, ironMan, playerCountryId, victoryConditionId, seed? }`. Tutto serializzato nel save.
- **`lib/persistence.ts`** — `SaveEntry` aggiunge `difficultyId: string` (era implicito); il loader applica la migration v1→v2 sul `state` se `engineVersion === '1.x'`.
- **Nuovo: `content/scenarios/index.ts`** — registry esplicito (no autodiscovery filesystem in browser):
  ```ts
  export const scenarios = [
    { id: 'ascesa-aurion',       file: () => import('./ascesa-aurion.json'),       messagesIt: () => import('./ascesa-aurion.it.json'),       messagesEn: () => import('./ascesa-aurion.en.json'),       tags: ['fantasy'] },
    { id: 'mondo-contemporaneo', file: () => import('./mondo-contemporaneo.json'), messagesIt: () => import('./mondo-contemporaneo.it.json'), messagesEn: () => import('./mondo-contemporaneo.en.json'), tags: ['contemporary'] },
    { id: 'guerra-fredda',       file: () => import('./guerra-fredda.json'),       messagesIt: () => import('./guerra-fredda.it.json'),       messagesEn: () => import('./guerra-fredda.en.json'),       tags: ['historical'] },
    { id: 'quick-start',         file: () => import('./quick-start.json'),         messagesIt: () => import('./quick-start.it.json'),         messagesEn: () => import('./quick-start.en.json'),         tags: ['tutorial'] },
  ] as const;
  ```
  Il picker enumera questo array. Lazy load: il file scenario viene importato solo quando il giocatore conferma la scelta, non tutti all'avvio.
- **`lib/i18n.ts`** — il provider next-intl viene esteso per **fondere** le messages globali (UI chrome) con le messages dello scenario attivo. La key collision è prevenuta dalla convenzione di namespace (`country.*`, `tech.*`, `event.*`, `scenario.<id>.*` per scenario-specific; `ui.*`, `hud.*`, `panel.*` per globali). Il merge avviene nel layout di `/play/[saveId]`.
- **`components/Modals/EventModal.tsx`** — invariato, ma le i18n key sono risolte contro le messages dello scenario attivo (non più `ascesa-aurion.*` hardcoded).
- **`tests/e2e/`** — un nuovo test `pick-scenario.spec.ts` esercita il flusso full wizard su uno scenario non-default.

### File paths affetti (riepilogo)

```
packages/engine/src/types.ts                                  [edit]
packages/engine/src/tick.ts                                   [edit]
packages/engine/src/ai/index.ts                               [edit]
packages/engine/src/checkWinLoss.ts                           [edit]
packages/engine/src/createGame.ts                             [edit]
packages/engine/src/migrations/v1tov2.ts                      [new]
packages/engine/src/index.ts                                  [edit, export migration]
packages/engine/tests/difficulty.test.ts                      [new]
packages/engine/tests/migration.test.ts                       [new]
packages/engine/scripts/sim.ts                                [edit, take --scenario --difficulty]

apps/web/app/new/page.tsx                                     [edit, 4-step wizard]
apps/web/components/NewGame/ScenarioPicker.tsx                [new]
apps/web/components/NewGame/DifficultyPicker.tsx              [new]
apps/web/components/NewGame/SensitivityNotice.tsx             [new]
apps/web/lib/store.ts                                         [edit]
apps/web/lib/persistence.ts                                   [edit, run migration]
apps/web/lib/i18n.ts                                          [edit, scenario messages merge]
apps/web/content/scenarios/index.ts                           [new, registry]
apps/web/content/scenarios/mondo-contemporaneo.json           [new]
apps/web/content/scenarios/mondo-contemporaneo.it.json        [new]
apps/web/content/scenarios/mondo-contemporaneo.en.json        [new]
apps/web/content/scenarios/guerra-fredda.json                 [new]
apps/web/content/scenarios/guerra-fredda.it.json              [new]
apps/web/content/scenarios/guerra-fredda.en.json              [new]
apps/web/content/scenarios/quick-start.json                   [new]
apps/web/content/scenarios/quick-start.it.json                [new]
apps/web/content/scenarios/quick-start.en.json                [new]
apps/web/content/scenarios/validate.ts                        [edit, parametrizzato per id]
apps/web/tests/e2e/pick-scenario.spec.ts                      [new]
apps/web/tests/e2e/difficulty.spec.ts                         [new]

scripts/new-scenario.ts                                       [new, scaffolder]
package.json                                                  [edit, aggiungere `new-scenario` script]
```

---

## Sensitivity considerations

Mondo Contemporaneo e Guerra Fredda toccano geopolitica reale — il rischio è di scivolare in caricature offensive o di sembrare endorsare un punto di vista. Regole di design vincolanti:

1. **Niente nomi propri di figure politiche.** Mai "Putin", "Biden", "Castro". Sempre ruoli generici: "Presidente del paese X", "Premier", "Segretario Generale", "Capo dell'Intelligence". Questo vale anche negli eventi narrativi.
2. **Nomi delle nazioni: serializzati in i18n key, mai hardcoded.** I paesi nel JSON usano id neutri (`country.contemporary.it.name`, `country.coldwar.bloc_west_a.name`). I nomi visibili sono i18n key che il team può riformulare (es. usare "Repubblica Italiana" e "Italia" in IT/EN, oppure paese fittizio "Eritania" se preferito).
3. **Niente conflitti etnici o religiosi reali.** Nessun evento "guerra del [conflitto reale]" o "tensioni fra [gruppo A] e [gruppo B]". Gli eventi parlano di archetipi: "movimento separatista in regione X", "tensioni religiose generiche", senza ancorarli a eventi storici specifici.
4. **Niente genocidi, atrocità in corso, eventi recenti traumatici.** L'evento "epidemia globale" è ok come archetipo; un evento che si chiama "COVID-19" non lo è.
5. **Lo scenario storico (Guerra Fredda) è chiaramente passato.** Niente choice del tipo "autorizzi la Baia dei Porci come Presidente Kennedy?" — sostituito con "il tuo capo dell'intelligence chiede l'autorizzazione per un'operazione covert contro X". L'evento storico è riferito obliquamente, non rievocato come scelta.
6. **Disclaimer in-wizard.** Prima di confermare uno scenario "contemporaneo" o "storico", una modale legge:
   > *"Questo scenario usa nazioni e ambientazioni ispirate alla realtà. Tutti i personaggi, gli eventi e le scelte sono romanzati a fini di gioco e non rappresentano persone reali, opinioni politiche, o ricostruzioni storiche fedeli."*
   Il disclaimer è dismissibile ("Non mostrare più") e persiste in `meta`.
7. **Review manuale degli eventi.** Ogni evento dei due scenari sensibili deve essere riletto da almeno un secondo paio di occhi (manutentore o reviewer fidato) prima del merge — convenzione, non automatizzabile, ma da scrivere nel CONTRIBUTING per Fase 2.
8. **Niente bandiere o simbologie reali nella mappa Fase 2.** Le nazioni hanno solo un colore. La mappa SVG resta astratta. Bandiere → eventuale Fase 3 con review.

Questo set di regole è abbastanza restrittivo da escludere quasi tutte le scivolate plausibili senza castrare il gameplay.

---

## Content authoring workflow (NEW)

La Fase 2 triplica il volume di contenuti. Senza un workflow chiaro l'autore (umano o agent) impazzisce. Documentiamolo come parte dello spec.

### Layout dei file

```
apps/web/content/scenarios/
├── index.ts                              ← registry (vedi Architettura)
├── validate.ts                           ← validator parametrizzato per id
├── _template/                            ← scaffolding template
│   ├── scenario.json
│   ├── messages.it.json
│   └── messages.en.json
├── ascesa-aurion.json                    + .it.json + .en.json
├── mondo-contemporaneo.json              + .it.json + .en.json
├── guerra-fredda.json                    + .it.json + .en.json
└── quick-start.json                      + .it.json + .en.json
```

Convenzione: stesso prefisso (`<id>.json`, `<id>.it.json`, `<id>.en.json`).

### Authoring checklist (per ogni nuovo scenario)

1. **Scaffold:** `pnpm new-scenario <id>` — crea i 3 file da template, vuoti ma type-valid.
2. **Definisci le regioni** (in `i18n` keys + nei `regionId` dei country).
3. **Aggiungi i country**: per ognuno, decidi `population`, `economy`, `military`, `intelligence`, `politics`, `aiPersonality`. Il template ha defaults plausibili.
4. **Inizializza le `relations`** — almeno tutte le coppie inter-regionali fra superpoteri e una manciata di alleanze/sanzioni iniziali. Le coppie non specificate hanno attitude 0, no treaties, no war (default engine).
5. **Tech tree** — almeno 30 nodi su 4 rami; i `prereqs` devono formare DAG (validator lo verifica indirettamente non rilevando cicli; aggiungere check esplicito è un'estensione utile del validator).
6. **Event pool** — almeno 20 eventi; mix `periodic` (~30%), `condition` (~50%), `random` (~20%). Le `weight` vanno bilanciate (default 1.0; eventi catastrofici 0.2-0.3).
7. **Victory conditions** — di default i 5 della Fase 1, con `rule` adattata allo scenario (vedi Mondo Contemporaneo: `economic` con `rankAtMost: 5` invece di 3).
8. **Difficulties** — i 3 preset (easy/normal/hard) come definiti sopra. Iron Man è opzionale; per Quick Start non includerlo (`length: 1`, solo easy hardcoded).
9. **Aggiungi al registry** (`index.ts`).
10. **Aggiungi le messages** — riempire `<id>.it.json` e `<id>.en.json` per ogni `*Key` referenziato. Il validator stamperà la lista di chiavi mancanti.
11. **Validator must pass** — `pnpm --filter @aurion/web exec tsx content/scenarios/validate.ts <id>`. Errori → blocco merge.
12. **Sim balance pass** — `pnpm --filter @aurion/engine sim --scenario <id> --difficulty normal --runs 200`. Verifica che la distribuzione vittorie/sconfitte cada nei target (vedi Balancing).
13. **Manual smoke** — almeno 1 partita giocata davvero in Normal fino alla fine.
14. **Sensitivity review** — solo per scenari non-fittizi: secondo paio d'occhi sugli eventi.

### CLI proposta: `pnpm new-scenario <id>`

Implementazione: `scripts/new-scenario.ts`, eseguito via `tsx`.

```
$ pnpm new-scenario mondo-contemporaneo

Aurion scenario scaffolder
  id: mondo-contemporaneo
  Created: apps/web/content/scenarios/mondo-contemporaneo.json
  Created: apps/web/content/scenarios/mondo-contemporaneo.it.json
  Created: apps/web/content/scenarios/mondo-contemporaneo.en.json

Next steps:
  1. Edit the .json file (countries, tech tree, events).
  2. Add the entry to apps/web/content/scenarios/index.ts.
  3. Run: pnpm --filter @aurion/web exec tsx content/scenarios/validate.ts mondo-contemporaneo
  4. Run: pnpm --filter @aurion/engine sim --scenario mondo-contemporaneo --runs 200
```

Il template scenario è valido per il type-check ma volutamente minimale (3 country, 5 tech, 3 eventi, 1 win condition, 3 difficoltà). Questo permette di lanciare `validate` e `sim` immediatamente, dando al content author un feedback loop stretto.

### Test richiesti per nuovo scenario

- Validator pass (CI gate).
- Sim 200 partite a Normal con AI random per il player → distribuzione almeno 15% vittorie e 15% sconfitte (no auto-win, no impossibilità).
- Sim 200 partite per ognuna delle 3 difficoltà → distribuzione nei target (Balancing section).
- 1 E2E Playwright che picka quello scenario specifico nel wizard, conferma, vede tick avanzare. Stesso pattern del test E2E esistente per Ascesa di Aurion.

---

## Balancing methodology

Il bilanciamento in Fase 2 è il bottleneck. Definiamo il processo prima di tunare.

### Criteri di "bilanciato"

Per ogni triple `(scenario, difficulty)`, lanciamo 200 partite simulate (player random uniforme, AI con utility scoring) e misuriamo:

| Difficoltà | Target % vittorie player | Tolleranza | % sconfitte | % timeout (no fine in 1500 tick) |
|---|---:|---|---:|---:|
| Easy | 50% | ±10% | 30-40% | <10% |
| Normal | 30% | ±10% | 50-60% | <10% |
| Hard | 10% | ±5% | 80-85% | <10% |

Se la triple cade fuori dai target, il bilanciamento procede così:
1. Identifica l'outlier dominante: troppe vittorie? troppe sconfitte? troppi timeout?
2. Ipotizza la leva: AI troppo passiva (bumpa `aiAggression`)? player troppo ricco (riduci `playerIncome`)? eventi troppo frequenti (riduci `eventChanceMultiplier`)?
3. Modifica un solo parametro per iterazione, ri-sim, confronta.
4. Documenta nel commit la coppia (parametro, target raggiunto).

Per **win condition specific tuning**: oltre alla % vittorie aggregata, misuriamo la **distribuzione del tipo di vittoria** (% economic vs military vs scientific vs diplomatic vs domination). Una distribuzione sana ha tutte e 5 sopra il 5% — se nessun giocatore vince mai diplomaticamente, la win condition è troppo dura su quello scenario.

### "Fun moments" attesi (almeno 3-5 per scenario)

Lista di esperienze concrete che il bilanciamento dovrebbe permettere/produrre. Sono check qualitativi, non automatici, validati con playthrough manuali.

**Ascesa di Aurion**:
1. La spia rilevata che innesca sanzioni a catena.
2. La fazione religiosa ribelle che minaccia un golpe se non placata.
3. La corsa al Mars Colony con un'altra superpotenza al testa-a-testa.
4. L'alleanza inaspettata con un vicino sospettoso.
5. Una guerra evitata pagando una "concessione territoriale" via evento.

**Mondo Contemporaneo**:
1. Crisi energetica globale che ribalta i ranking PIL in 50 tick.
2. Cyber-attacco contro il giocatore quando supera un superpoter in tech.
3. Conferenza climatica che permette di guadagnare alleanze multiple in un colpo.
4. Spia colta in flagrante in un superpoter → escalation di tensione mondiale.
5. Pandemia che colpisce settori specifici (services tracollano).

**Guerra Fredda**:
1. Crisi missilistica generica con scelta proxy/escalation/diplomazia.
2. Decolonizzazione che cambia un alleato dei sovietici in non allineato corteggiabile.
3. Corsa allo spazio testa-a-testa con la superpotenza opposta.
4. Tentativo di destabilize coperto contro un alleato dell'altra superpotenza.
5. Disgelo improvviso (evento condizionale: tensione mondiale > 80 per 50 tick → scelta "summit di disarmo").

**Quick Start**:
1. Prima ricerca completata — sblocca un'azione visibile.
2. Prima spia di successo che ruba tech.
3. Vittoria in <20 minuti con scelte "ovvie" suggerite implicitamente.

### Strumenti

- `pnpm --filter @aurion/engine sim` esistente, esteso con `--scenario <id>`, `--difficulty <id>`, `--runs <n>`, `--out <path>` (jsonl). Output include per partita: seed, scenario, difficulty, win/loss, tipo vittoria, tick durata.
- Nuovo script di analisi `packages/engine/scripts/sim-report.ts` legge il jsonl e stampa una tabella per ogni triple con %vittorie / %sconfitte / mean ticks / win type breakdown.
- CI esegue una sim ridotta (50 runs per triple, 4 scenari × 3 difficoltà = 12 triples = 600 sim) come check non-blocking — alert su Slack/issue se la distribuzione devia oltre tolleranza per >2 PR consecutive. Per Fase 2 basta che il maintainer abbia il report in mano, l'alert automation è opzionale.

---

## Estimated scope

Stime best-effort, persona singola lavorando focalizzata. Ogni stima ha "realistic" e "optimistic" perché i contenuti scalano in modo non-lineare con la qualità voluta.

| Componente | Realistic | Optimistic | Note |
|---|---:|---:|---|
| Engine: extension `DifficultyTuning` + consumo nei tick/ai/checkWinLoss | 2 g | 1 g | Modifica additiva, ben localizzata |
| Engine: migration v1→v2 + test | 1 g | 0.5 g | Solo defaults, nessuna logica |
| Engine: estensione `sim.ts` + `sim-report.ts` | 2 g | 1 g | CLI flags + report JSONL |
| Scenario `mondo-contemporaneo` (countries + relations + tech + events + i18n) | 5 g | 3 g | 30 country e 40 tech sono il grosso |
| Scenario `guerra-fredda` | 5 g | 3 g | Simile, evento decolonizzazione richiede cura |
| Scenario `quick-start` | 1.5 g | 1 g | Sottoinsieme, derivato da Aurion |
| Difficoltà end-to-end (3 preset × 4 scenari, applicati nei JSON) | 1 g | 0.5 g | Solo data entry, una volta che engine consuma |
| New game wizard (ScenarioPicker + DifficultyPicker + SensitivityNotice) | 3 g | 2 g | Componenti shadcn, lazy import scenario |
| Persistence: difficulty in save + migration wired | 1 g | 0.5 g | Riusa pattern esistente |
| i18n: merge messages globali + per-scenario | 1 g | 0.5 g | Layer in `lib/i18n.ts` |
| `new-scenario` CLI scaffolder | 1 g | 0.5 g | Tre file da copia + sostituzione id |
| Validator parametrizzato per id + estensioni (DAG check, default modifiers) | 1 g | 0.5 g | Iterazione su file esistente |
| E2E test (pick-scenario, difficulty) | 1.5 g | 1 g | Pattern esistente |
| Bilanciamento (sim + tuning per ogni triple) | 5 g | 3 g | Dipende da quante iterazioni servono |
| Sensitivity pass + revisione eventi sensibili | 2 g | 1 g | Manuale, non scalabile |
| Documentazione (CONTRIBUTING aggiornato per scenari, README sezione Phase 2) | 1 g | 0.5 g | |
| **Totale** | **~33 g** | **~19 g** | ~6-7 settimane realistic, ~4 ottimistico |

Il rischio principale è il bilanciamento: se i target distribuzionali non si raggiungono in 5 giorni, raddoppiano. Mitigation: definire i target stretti (vedi tabella) ma accettare ±10% di tolleranza in Phase 2, demand più stretto in Phase 3.

---

## Out of scope per Phase 2 (deferred to Phase 3)

- ❌ Editor di scenari in-game (UI per creare/modificare scenari senza JSON)
- ❌ Mod system (caricare scenari da file utente locale o URL)
- ❌ Replay / time-travel debug (anche se il seed deterministico lo abilita)
- ❌ Achievement / progressione meta tra partite (oltre al gating Iron Man)
- ❌ Audio / musica / SFX
- ❌ Polish visivo finale (palette definitiva, illustrazioni, bandiere, motion)
- ❌ Tutorial scriptato passo-passo (Quick Start lo sostituisce parzialmente)
- ❌ Cloud sync, account, leaderboard, condivisione partite
- ❌ Mobile app native
- ❌ AI ML o behavior tree veri
- ❌ Tech tree >100 nodi per scenario
- ❌ Evoluzione dello scenario nel tempo (decolonizzazione vera con spawning di nuovi paesi mid-game)
- ❌ Localizzazioni oltre IT+EN
- ❌ Generazione procedurale di scenari

---

## Open questions

Domande reali su cui il maintainer deve decidere prima dell'implementazione, o che potrebbero ridefinire scope.

1. **Advanced mode nel difficulty picker?** Permettiamo al giocatore di tweakare singoli modificatori (`aiAggression`, `playerIncome`, ecc.) oltre i 3 preset? Pro: massima flessibilità per power user. Contro: combinazioni assurde, nightmare di test, dilui il significato dei preset. *Default proposto:* no, solo i 3 preset + Iron Man. Custom mode in Fase 3 se mai.

2. **Regioni geografiche reali in Mondo Contemporaneo?** Usiamo i 6 continenti veri (Europa, Asia, Americas-N, Americas-S, Africa, Oceania) o restiamo sull'astrazione a 5 regioni di Aurion? *Default proposto:* 6 continenti reali (rende lo scenario riconoscibile), ma solo come "regionId" string, niente bandiere/forme geografiche realistiche nella mappa SVG.

3. **Quick Start come scenario standalone o difficoltà di Aurion?** Concettualmente si sovrappone. Tenerlo come scenario separato (proposta corrente) duplica un po' di JSON; renderlo una difficoltà speciale ("Tutorial") dentro Aurion riduce il duplicato ma viola la convenzione "una difficoltà ≠ uno scenario diverso". *Default proposto:* scenario separato, accetta la duplicazione perché aiuta scoperta.

4. **Iron Man: gating o sempre disponibile?** Gating dietro "una vittoria a Hard" è gentile ma richiede di persistere uno stato cross-save. Più semplice: sempre disponibile con disclaimer pesante ("solo per veterani — niente save"). *Default proposto:* gating, perché protegge giocatori nuovi che cliccano per curiosità.

5. **Scenari sensibili: ammettiamo nomi reali di nazioni con disclaimer, o forziamo nomi fittizi (Eritania, Norvegia-stand-in)?** Realistici aiutano l'immersione; fittizi azzerano ogni rischio di sensibilità. *Default proposto:* nomi reali con disclaimer, **nessun nome di persona reale** mai.

6. **Migration v1→v2 dei save: silenziosa o opt-in?** Silenziosa = il giocatore non se ne accorge, ottimo. Opt-in = "il save è di una versione precedente, vuoi migrarlo?", più sicuro ma annoying. *Default proposto:* silenziosa, perché tutti i nuovi modificatori hanno default 1.0 (≡ Fase 1 behavior). Niente perdita semantica.

7. **CI: la sim balance fa parte del check che blocca PR, o è warning?** Bloccante = niente PR di contenuto va in main senza passare i target distribuzionali, ma rallenta tutto. Warning = i numeri vanno fuori spec senza che nessuno se ne accorga. *Default proposto:* warning in Fase 2 (niente blocco), bloccante in Fase 3 quando i target sono stabilizzati.

8. **i18n delle messages per-scenario: bundle separati o merge a build time?** Bundle separati (Fase 2 default) = lazy load, bundle iniziale piccolo. Merge a build = un singolo dictionary, più semplice ma cresce monoliticamente. *Default proposto:* separati, lazy via dynamic import nello `index.ts` registry.

---

## Verification (quando Phase 2 è "done")

Considero la Fase 2 "fatta" quando tutti questi check passano:

1. **CI green:** `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm test:e2e` tutti verdi.
2. **Validator per ogni scenario:** `pnpm --filter @aurion/web exec tsx content/scenarios/validate.ts <id>` per `ascesa-aurion`, `mondo-contemporaneo`, `guerra-fredda`, `quick-start` → 0 errori.
3. **Sim distribuzionale:** `pnpm --filter @aurion/engine sim --scenario <id> --difficulty <d> --runs 200` per ogni triple → distribuzione vittorie/sconfitte nei target ±tolleranza definita.
4. **Manual playthrough:** ognuno dei 4 scenari completato almeno una volta a Normal in modo "fluido" (no glitch, eventi sensati, una win condition raggiunta).
5. **E2E esteso:** il nuovo `pick-scenario.spec.ts` esercita il flusso wizard → scenario non-default → difficoltà non-default → conferma → tick avanzano → save → reload → state identico.
6. **Migration test:** un save Fase 1 (`engineVersion: '1.x'`) carica in Fase 2, applica defaults, gioca normalmente.
7. **Sensitivity pass:** ogni evento di Mondo Contemporaneo e Guerra Fredda è stato letto e approvato; il disclaimer wizard appare e si dismissa correttamente.
8. **Iron Man flow:** giocando una vittoria a Hard sblocca Iron Man nel picker; una partita Iron Man non produce save (verifica via DB inspection) e perdere chiude la partita senza possibilità di reload.
9. **Smoke i18n:** ogni scenario è giocabile sia in IT che in EN; nessuna chiave i18n mancante visibile a schermo (validator già lo verifica, ma double-check manuale).
10. **Scope respect:** nessun file fuori da quelli elencati in "Architecture changes" è stato toccato; lo SPEC.md di Fase 1 è invariato.

---

> Spec scritto contro lo stato del repo a `763845b feat(wave4): E2E suite, visual tokens, balance pass, CI, runtime fixes`. Se l'engine evolve fra spec e implementazione, prevalgono i tipi reali in `packages/engine/src/types.ts`.
