# Aurion — Fase 3 Design

> Spec **Fase 3** — La fase in cui Aurion smette di essere "uno strategico generico" e prende la sua identità: percorsi multipli verso lo status di superpotenza, istituzioni internazionali (ONU), opinione pubblica per blocco, deterrenza nucleare, e un sandbox endless in cui *mantenere* la posizione conta quanto raggiungerla.
> Date: 2026-05-15. Spec Fase 1: `docs/SPEC.md` (frozen). Spec Fase 2: `docs/SPEC-PHASE-2.md` (frozen).

---

## Context

La Fase 1 ha consegnato un engine TS puro pienamente data-driven con sei sistemi giocabili, mappa SVG, autosave, IT+EN, e una sim deterministica per il bilanciamento. La Fase 2 ha aggiunto i contenuti che rendono il gioco "rigiocabile": tre scenari nuovi (`mondo-contemporaneo`, `guerra-fredda`, `quick-start`), tre difficoltà reali con otto modificatori distinti, gating Iron Man, sensitivity rules, sim distribuzionale come strumento di tuning. Lo stato attuale (`ee78a80 feat(wave7): Mondo Contemporaneo, Iron Man, Tutorial, sim balance`) è una base solida: il giocatore può avviare quattro scenari, scegliere fra cinque vittorie, vincere o perdere — ma le partite si assomigliano, e l'esperienza "diventare superpotenza" è astratta.

La Fase 3 attiva la **fantasia di gioco vera**: il giocatore dichiara *come* vuole arrivare al vertice (guerra aperta, ricerca + spionaggio coperto, diplomazia di blocco, deterrenza atomica, prestigio spaziale) e il mondo reagisce di conseguenza. Per farlo non basta aggiungere azioni: serve un sistema di reputazione che misuri come ti vedono i tre blocchi del mondo, un'istituzione internazionale (l'**ONU-equivalent**) che voti risoluzioni con conseguenze materiali, una **politica di blocchi** che modelli NATO-vs-anti-NATO non come stringa ma come entità con leader e affinità, le **armi nucleari** con il loro modello a tre livelli (deterrente passivo, strike tattico, strike strategico con MAD), una **modalità endless** che renda interessante "mantenere" il primato, e i **programmi spaziali come power projection** (non solo come ramo di tech tree). Più tre sistemi di lungo respiro (replay, mod, achievement) di cui la maggior parte è marcata come *deferred* alle Wave 11+.

Il "wow" visibile per il giocatore: la stessa partita giocata "via guerra" e "via diplomazia" produce due esperienze drasticamente diverse. Nel primo caso la reputazione occidentale crolla, l'ONU vota condanne, le coalizioni si formano contro di te, e arrivare a #1 PIL costa più di quanto valga. Nel secondo caso costruisci pazientemente un blocco di alleati, vinci tre risoluzioni in fila, e quando finalmente proponi un trattato di limitazione armi nucleari sei tu il leader morale del mondo. Stesso engine, stessi sistemi base — l'identità emerge dalle scelte tra i nuovi sistemi che la Fase 3 introduce.

---

## Goals (cosa cambia per il giocatore)

- **Cinque percorsi alla superpotenza**, ognuno con costi reputazionali diversi: *guerra aperta* (Western crolla, Eastern flirta), *ricerca + spionaggio* (tutti si insospettiscono), *diplomazia di blocco* (lento ma stabile), *deterrenza nucleare* (paura dei vicini, condanna ONU), *prestigio spaziale* (boost reputazione gratuito ma costoso in ricerca).
- **Reputazione per blocco** visibile in HUD: "Western: +24 / Eastern: −18 / Non-Aligned: +5". Sostituisce in parte il `worldTension` come metrica di feedback geopolitico.
- **Istituzione internazionale (ONU-equivalent)** che vota risoluzioni periodiche: sanzioni, peacekeeping, accordi climatici, condanne, non-proliferazione. Il giocatore vota; se è membro permanente del consiglio può anche porre veto.
- **Blocchi politici** con identità: Western Alliance, Eastern Alliance, Non-Aligned Movement. Ogni blocco ha un *leader* (la nazione più forte fra i membri), affinità interna, summit periodici, patti di difesa che attivano guerre automatiche.
- **Armi nucleari a tre livelli**: deterrente passivo (basta possederle perché l'AI ci pensi due volte), strike tattico (distrugge l'esercito in una regione, condanna mondiale), strike strategico (devasta una nazione; se il bersaglio ha nukes scatta la MAD — Mutual Assured Destruction — con effetti catastrofici globali).
- **Modalità endless / sandbox** con tre sub-modalità a scelta: *Eternal* (la partita non finisce mai, vinci milestones), *Era-paced* (avanzi attraverso ere storiche con summary screens), *Dethrone-loss* (game over se cadi fuori dalla top-3 PIL per 5 anni in-game — la pressione di "mantenere" il primato).
- **Programmi spaziali come prestige**: ogni milestone (primo satellite, prima base lunare, prima missione su Marte) dà reputazione mondiale al primo che lo fa, meno al secondo, niente al terzo. Lo spazio diventa una corsa visibile e narrativamente carica.
- **Achievement cross-partita** (~25-30) come progressione meta leggera, persistiti globalmente.

---

## Non-goals (cosa NON è in Fase 3)

Tutto ciò che non concorre direttamente alle nove aree elencate sopra. Esplicitamente:

- ❌ Multiplayer (sincrono o async) — Fase 4
- ❌ App mobile native (la web responsive non si rompe e basta) — Fase 4
- ❌ VR / mappa 3D / motore di rendering custom — Fase 4
- ❌ Cloud sync, account utente, leaderboard online — Fase 4
- ❌ Audio / musica / SFX (rimane scoperto da Fase 1) — Fase 4
- ❌ Editor di scenari in-game con UI completa — Fase 4 (qui solo il *mod system* data-only, comunque deferred)
- ❌ Behavior tree / ML reali per l'AI — restiamo su utility scoring, esteso ma non riscritto
- ❌ Tech tree >100 nodi — restiamo ~40-60 per scenario anche con le aggiunte spazio/nucleari
- ❌ Scenari nuovi oltre i quattro Fase 2 — la Fase 3 espande in *meccaniche*, non in setting (eccezione: `cold-war` riceve gli upgrade meccanici, non un nuovo file)
- ❌ Localizzazioni oltre IT+EN
- ❌ Dynamic spawning di nuove nazioni a runtime (decolonizzazione "vera") — il pattern è già stato deferito in Fase 2, resta deferito
- ❌ Generazione procedurale di scenari, mappe, eventi
- ❌ Streamer mode / observer mode / replay-condivisibile-online (il replay locale è in scope ma deferred a Wave 11+)
- ❌ Politica interna avanzata "tipo Crusader Kings" (linea di successione, intrighi personali, dinastie) — restiamo sulle 5 fazioni a soddisfazione

Se un'idea non concorre direttamente a "identità + path multipli + ONU + blocchi + nukes + endless + spazio + achievement", va in Fase 4 o oltre.

---

# SISTEMI DELLA FASE 3

I nove sistemi della Fase 3 sono numerati e descritti a parte. I primi sei sono *core* (Wave 9-10), gli ultimi tre (replay, mod, achievement) hanno scope e timing diversi (achievement in Wave 9-10, replay e mod *deferred* a Wave 11+).

---

## SYSTEM 1 — World Reputation (per-blocco)

### Mechanics

- Tre blocchi politici espliciti in Fase 3: **Western** (analogo NATO/G7), **Eastern** (analogo BRICS/SCO), **Non-Aligned** (movimento dei non allineati). C'è anche una categoria implicita **`unaligned`** — nazioni che non appartengono ad alcun blocco — usata internamente per default.
- Ogni nazione appartiene **al massimo a un blocco**, oppure è `unaligned`. La membership è visibile sulla mappa via colore di bordo (Western = blu, Eastern = rosso, Non-Aligned = verde, unaligned = grigio).
- La **reputazione** è il numero che misura quanto la *tua* nazione è ben vista *in* un certo blocco. Range: −100..+100.
- È un valore **derivato**: ogni tick l'engine somma una rolling-window di delta reputazione applicati dalle azioni recenti del giocatore (azioni dirette + conseguenze di eventi + voti ONU + risultati di operazioni spia rilevate).
- Decay naturale: ogni tick la reputazione tende verso 0 con un coefficiente piccolo (`-0.5` se positiva, `+0.5` se negativa, per blocco). Senza azioni, in ~26 settimane si torna a metà.

### Type sketch

```ts
// in packages/engine/src/types.ts (additivo, retro-compat)
export type BlocId = 'western' | 'eastern' | 'non-aligned' | 'unaligned';

export type ReputationByBloc = Record<BlocId, number>; // -100..+100

/** Singolo delta applicato in un tick passato. Manteniamo gli ultimi N. */
export type ReputationDelta = {
  appliedAtTick: number;
  bloc: BlocId;
  amount: number;        // -X..+X
  reasonKey: string;     // i18n: "rep.reason.declareWar.westernNation"
  source: 'action' | 'event' | 'unVote' | 'spyDetected' | 'spaceMilestone';
};

/** Aggregata in GameState.reputation. */
export type ReputationState = {
  /** Finestra rolling delle delta degli ultimi REPUTATION_WINDOW_TICKS tick. */
  deltas: ReputationDelta[];
  /** Valore corrente derivato — ricomputato ogni tick dal rolling window. */
  current: ReputationByBloc;
};
```

`REPUTATION_WINDOW_TICKS = 104` (due anni in-game). Oltre questa finestra le delta vengono potate (bound al ring buffer per evitare crescita infinita del save).

### Reputation deltas (tabella di riferimento)

I numeri qui sono i valori "Phase 3 baseline"; il bilanciamento dei target per scenario può scalarli in modo uniforme. Tutte le delta sono per-singola-occorrenza, non per-tick.

| Azione del giocatore | Western | Eastern | Non-Aligned | Note |
|---|---:|---:|---:|---|
| Dichiara guerra a nazione Western | −30 | +10 | −5 | rep.reason.warOnWestern |
| Dichiara guerra a nazione Eastern | +10 | −30 | −5 | |
| Dichiara guerra a nazione Non-Aligned | −5 | −5 | −20 | |
| Sigli alleanza con Western | +10 | −5 | 0 | |
| Sigli alleanza con Eastern | −5 | +10 | 0 | |
| Sigli alleanza con Non-Aligned | +1 | +1 | +5 | |
| Rompi alleanza esistente con Western | −15 | +3 | 0 | |
| Imponi sanzioni a nazione Western | −10 | +5 | 0 | |
| Imponi sanzioni a nazione Eastern | +5 | −10 | 0 | |
| Sigli trattato commerciale con Non-Aligned | +2 | +2 | +5 | |
| Spia rilevata in nazione Western | −12 | 0 | −2 | applica solo se status='detected' |
| Spia rilevata in nazione Eastern | 0 | −12 | −2 | |
| Sabotaggio (rilevato) contro qualsiasi | −8 | −8 | −5 | aggrava la sanzione di rilevamento |
| Assassinio (rilevato) contro qualsiasi | −20 | −20 | −15 | è il peggior crime |
| Voto ONU "yes" su peacekeeping | +5 | +5 | +5 | |
| Voto ONU "yes" su sanzioni a Western | −8 | +5 | 0 | |
| Voto ONU "yes" su sanzioni a Eastern | +5 | −8 | 0 | |
| Voto ONU "yes" su humanitarian aid | +3 | +3 | +5 | |
| Voto ONU "no" su humanitarian aid | −3 | −3 | −8 | |
| Voto ONU "yes" su climate accord | +6 | +4 | +6 | Western valuta di più green |
| Veto ONU (membro permanente) | −10 | −10 | −5 | indipendentemente dal target |
| Lanci strike nucleare tattico | −50 | −50 | −50 | crollo universale |
| Lanci strike nucleare strategico | −100 | −100 | −100 | clamping a min, vedi sotto |
| Costruisci primo warhead nucleare | −5 | −5 | −10 | rumor diffuso, intel >= 'partial' |
| Aiuti vittime di evento naturale (humanitarian event) | +3 | +3 | +5 | |
| Rifiuti di estradare spia catturata | −10 | +10 | 0 | doppio standard occidentale |
| Estradi spia catturata | +5 | −5 | 0 | |
| Ospiti summit di blocco (come leader) | +10 leader | −5 rivale | 0 | |
| Lanci primo satellite (Sputnik-equivalent) | +5 | +5 | +5 | space milestone, vedi System 6 |
| Costruisci moon base | +8 | +8 | +5 | |
| Completi missione su Marte | +15 | +15 | +10 | |
| Annetti regione di nazione conquistata | −20 | −20 | −15 | |
| Concedi indipendenza a regione occupata | +8 | +8 | +12 | |
| Non rispetti trattato climate (firma+rompi) | −15 | −10 | −15 | |

La tabella viene serializzata in `packages/engine/src/reputation/deltas.ts` come dictionary `Record<ReasonKey, Partial<ReputationByBloc>>`. Aggiungere nuove cause = aggiungere una entry, niente codice.

**Clamping.** Ogni `current[bloc]` è clampato in [−100, +100] ad ogni ricalcolo. Lanci uno strike strategico quando sei a −60 con Western: la delta è −100 ma il valore finale è −100 (saturo, non −160).

### Come i blocchi ti vedono (UI)

- Nuovo componente HUD: `ReputationBadges`, tre pillole compatte fra il treasury e la velocità: `🟦 W: +24  🟥 E: −18  🟢 NA: +5`. Click apre un modal con storico recente delle delta (ultimi 20).
- Colore della pillola:
  - rep < −30 → rosso saturo
  - −30 ≤ rep < −10 → rosso tenue
  - −10 ≤ rep ≤ +10 → grigio neutro
  - +10 < rep ≤ +30 → verde tenue
  - rep > +30 → verde saturo
- La reputazione influenza concretamente:
  - **Reazioni AI**: la matrice di score di `proposeAlliance` / `declareWar` / `tradeDeal` legge `reputation.current[targetBloc]` per il giocatore e modifica il bias.
  - **Voto ONU delle altre nazioni**: vedi System 2.
  - **Probabilità di successo proposta alleanza/trattato**: `baseProb * (1 + reputation/200)`. A −100 la probabilità è dimezzata.
  - **Disponibilità trade deal**: nazioni con reputazione < −50 col tuo blocco rifiutano automaticamente (errore "rep.errors.bloc_hostile").
  - **Bloc transitions**: vedi sotto.

### Bloc membership transitions

- Una nazione AI **entra in un blocco** quando per ≥ 50 tick consecutivi:
  - la sua attitude media verso tutti i membri del blocco è ≥ +40, **e**
  - la sua reputazione presso quel blocco è ≥ +25.
- Una nazione AI **esce da un blocco** (defezione) quando per ≥ 50 tick consecutivi:
  - la sua attitude media verso i membri del blocco è ≤ −20, **oppure**
  - la sua reputazione presso il blocco rivale è > +50 e quella del blocco corrente è < +10.
- Le transizioni triggerano un evento narrativo `event_bloc_join_<id>` / `event_bloc_leave_<id>` visibile nello stream notifiche.
- Il **giocatore non controlla mai direttamente la membership** (né la propria né quella altrui). La cambia indirettamente attraverso reputazione, alleanze, eventi.
- La membership iniziale è data dallo scenario: ogni `CountryInit` riceve un campo opzionale `bloc?: BlocId` (default `'unaligned'`).

### Tick step (engine)

Aggiunto come **step 7.5** nel ciclo di tick (subito dopo "Politica" e prima di "AI turn"):

```
7.5. Reputation:
  - per ogni delta applicato in questo tick (da actions/eventi precedenti), pushala in reputation.deltas
  - prune deltas più vecchie di REPUTATION_WINDOW_TICKS
  - applica decay (-0.5 verso 0 per blocco)
  - ricomputa reputation.current sommando le delta nella finestra + decay
  - clamp in [-100, +100]
```

### File affetti

```
packages/engine/src/types.ts                                    [edit, +ReputationState]
packages/engine/src/reputation/                                 [new]
  ├── computeReputation.ts
  ├── deltas.ts                          ← tabella deltas
  ├── decay.ts
  └── index.ts
packages/engine/src/tick.ts                                     [edit, step 7.5]
packages/engine/src/actions/diplomacy.ts                        [edit, push delta on success]
packages/engine/src/actions/launchNuclear.ts                    [new, vedi System 4]
packages/engine/src/checkWinLoss.ts                             [edit, opzionale: dethrone]

apps/web/components/Hud/ReputationBadges.tsx                    [new]
apps/web/components/Modals/ReputationDetailModal.tsx            [new]
```

---

## SYSTEM 2 — United Nations / International Body

### Mechanics

- L'**ONU-equivalent** esiste solo negli scenari che lo specificano. Per Fase 3 lo abilitiamo in `mondo-contemporaneo` (ovvio) e `guerra-fredda` (Consiglio di Sicurezza con i 5 permanenti reali del periodo). Lo lasciamo *opzionale* per `ascesa-aurion` (mondo fittizio: solo se lo scenario lo include esplicitamente). `quick-start` non lo usa.
- L'organizzazione triggera **risoluzioni** periodicamente (ogni 12-26 settimane in modo seedato) e in risposta a eventi specifici (es. una guerra dichiarata triggera potenzialmente una `peacekeeping`, uno strike nucleare triggera *automaticamente* una `condemnation`).
- Ogni risoluzione ha:
  - un **proposer** (la nazione che la propone — può essere il giocatore o un'AI)
  - un **target** opzionale (paese o regione)
  - un **kind** dalla taxonomy chiusa (vedi sotto)
  - una **finestra di voto** di 4 tick (4 settimane). In quella finestra il loop NON si auto-pausa (a differenza degli eventi narrativi): il giocatore vede una notifica persistente nel notification stream e può aprire il modal di voto in qualsiasi momento. Se non vota entro la finestra, l'AI assume `'abstain'`.
  - **effetti on-pass** e **effetti on-fail**, tipizzati come `EventEffect[]` (riusiamo il sistema esistente)
- Ogni nazione AI vota deterministicamente in funzione di: archetipo, reputazione del proposer presso il proprio blocco, target del voto, e un piccolo noise seedato. Vedi "AI voting" sotto.
- I **5 (o 6) membri permanenti** del Consiglio di Sicurezza hanno **veto**: anche un singolo veto blocca il passaggio della risoluzione (status: `'vetoed'`). Negli scenari della Fase 3:
  - `mondo-contemporaneo`: 6 permanenti (USA-stand-in, China-stand-in, Russia-stand-in, UK-stand-in, France-stand-in, India-stand-in).
  - `guerra-fredda`: 5 permanenti (USA, USSR, UK, Francia, Cina).
  - I permanenti sono dichiarati nello scenario JSON, non hardcoded.

### Resolution types (taxonomy chiusa)

| `kind` | Cosa fa se passa | Cosa fa se fallisce |
|---|---|---|
| `sanctions` | Tutti gli "yes" voters cessano trade con `targetCountryId`; target perde 20% weeklyIncome per 52 tick | Reputazione del proposer presso target e suo blocco: −5 |
| `peacekeeping` | Se proposer e target sono in guerra: la guerra termina (cease-fire forzato per 52 tick); se nessuna guerra: nothing happens semantica, solo evento | Reputazione del proposer: 0 (proposta neutrale); guerra continua |
| `recognition` | Riconosce un nuovo soggetto (placeholder: cambia attitude di tutti gli yes-voters verso target a +10 minimum) | Niente |
| `humanitarian` | Pool fondi: ogni yes-voter paga 5% treasury; target riceve la somma totale; +reputazione a tutti i partecipanti | Reputazione del proposer: −3 universale (apparso egoista) |
| `climate` | Modifier permanente: tutti gli yes-voters subiscono cap su sector `industry` (max 0.45) ma ricevono +5 reputazione universale | Niente di applicato; mondiale +1 worldTension |
| `nonProliferation` | Restrizione sui non-permanenti: chi non è permanente non può iniziare ricerca su `tech_*_nuclear_arsenal` per 200 tick | Niente |
| `condemnation` | Simbolico: target subisce -10 popolarità una tantum, e tutti gli yes-voters guadagnano +2 reputazione presso il blocco rivale del target | Niente di tangibile, solo evento |

Le trigger condizioni sono descritte in `packages/engine/src/un/triggers.ts`. Ad esempio:
- `sanctions` viene proposta automaticamente quando una nazione subisce uno stato di guerra dichiarato e una potenza non in guerra ha attitude < −40 verso l'aggressore.
- `condemnation` viene proposta automaticamente in risposta a strike nucleare (qualsiasi tipo).
- `climate` è proposta periodicamente (ogni 100 tick) da un permanente random.
- `peacekeeping` viene proposta in risposta a guerre attive da > 30 tick.
- Il **giocatore può proporre** qualsiasi kind se è membro permanente, pagando un costo: 50 unità di "political capital" (vedi sotto). Se non è permanente, può proporre solo `humanitarian` e `climate` (proposte "soft").

### Political capital

- Nuovo scalare in `Country.politics`: `politicalCapital: number` (0..100, default 50).
- Cresce di +0.2 per tick per ogni alleato attivo, +0.1 per ogni trattato commerciale, +1 per ogni voto ONU "yes" che è passato.
- Si spende per: proporre risoluzioni ONU (50), invocare un summit di blocco (30, vedi System 3), proporre un voto di blocco (20).
- Se < 0 (mai ammissibile in Fase 3, ma per safety): nessuna proposta ammissibile.

### AI voting

```
voteScore(country, resolution) =
    archetype_baseline(country.aiPersonality.archetype, resolution.kind)
  + bloc_alignment(country.bloc, proposer.bloc, resolution)
  + reputation_modifier(country.reputation_with_proposer)
  + target_relation_modifier(country, resolution.targetCountryId)
  + seeded_noise(0..0.3)

vote = voteScore > +0.5 ? 'yes'
     : voteScore < -0.5 ? 'no'
     : 'abstain'
```

Per i membri permanenti, se `voteScore < -1.5` l'AI considera `'veto'`. Il veto è caro per la reputazione del vetonte (−10 universale, vedi tabella System 1) — l'AI lo usa solo se il danno percepito di passaggio della risoluzione supera la perdita reputazionale.

### Type sketch

```ts
export type UNResolutionKind =
  | 'sanctions'
  | 'peacekeeping'
  | 'recognition'
  | 'humanitarian'
  | 'climate'
  | 'nonProliferation'
  | 'condemnation';

export type UNVote = 'yes' | 'no' | 'abstain' | 'veto';

export type UNResolution = {
  id: string;                                 // uuid
  proposerCountryId: CountryId;
  kind: UNResolutionKind;
  targetCountryId?: CountryId;
  targetRegionId?: RegionId;
  proposedAtTick: number;
  votingClosesAtTick: number;                 // proposedAtTick + 4
  votes: Record<CountryId, UNVote>;           // popolato man mano (player può tardare)
  status: 'voting' | 'passed' | 'failed' | 'vetoed';
  effectsOnPass: EventEffect[];
  effectsOnFail: EventEffect[];
  /** Auto-generated i18n key for the resolution title shown in the modal. */
  titleKey: string;
};

export type UNState = {
  /** True if the scenario has UN at all. */
  active: boolean;
  /** Country IDs of permanent council members, with veto power. */
  permanentMembers: CountryId[];
  /** Currently open resolutions (window not closed). */
  activeResolutions: UNResolution[];
  /** Historical record (ring buffer, last 50). */
  history: UNResolution[];
};
```

`GameState` riceve un nuovo campo opzionale `un?: UNState`. Se assente o `active: false`, lo step ONU del tick è no-op.

### UN UI

- **Nuovo pannello: ONU (settimo PanelTab).** Mostra:
  - Lista risoluzioni attive con: titolo, proposer, target, deadline (in tick rimanenti), pulsante "Vota".
  - Lista cronologica risoluzioni passate (ultime 50).
  - Counter `politicalCapital` del giocatore.
  - Se membro permanente: pulsante "Proponi risoluzione" che apre un wizard.
- **Nuovo modal: `UNResolutionModal`.** Si apre cliccando "Vota" su una risoluzione attiva, oppure automaticamente alla prima volta che una risoluzione viene proposta in cui il giocatore è coinvolto come target. Mostra:
  - Titolo, descrizione, proposer, target.
  - Effetti potenziali on-pass e on-fail (concretamente — "−20% reddito per 52 settimane").
  - Voti correnti delle altre nazioni (visibili in tempo reale durante la finestra).
  - Tre pulsanti: "Yes" / "No" / "Abstain". Quattro se membro permanente: "Veto" in colore rosso con tooltip che spiega il costo reputazionale.
- **Notification stream:**
  - "Risoluzione proposta: <kind> contro <target>" → click apre il modal.
  - "Risoluzione passata: <kind>" → click apre il dettaglio.
  - "Risoluzione vetata da <country>".
- Quando il giocatore è target di una sanzione passata, una notifica persistente rimane nello stream per 10 tick.

### Tick step (engine)

Aggiunto come **step 8.5** (subito dopo "Eventi"):

```
8.5. UN:
  - se !state.un.active: skip
  - per ogni risoluzione in activeResolutions con tick == votingClosesAtTick:
      - per ogni AI che non ha votato: assegnale vote (deterministico via voteScore)
      - se almeno un permanente ha votato 'veto' → status = 'vetoed', skip effetti
      - else conteggia: yes >= no → 'passed', applica effectsOnPass
              else 'failed', applica effectsOnFail
      - sposta da activeResolutions a history
      - emetti GameEvent narrativo
  - check trigger: nuove risoluzioni proposte automaticamente (vedi triggers.ts)
```

### File affetti

```
packages/engine/src/types.ts                                    [edit, +UNState, +UNResolution]
packages/engine/src/un/                                         [new]
  ├── computeAIVote.ts
  ├── triggers.ts                        ← regole di proposta automatica
  ├── applyResolution.ts                 ← applica effectsOnPass/Fail
  └── index.ts
packages/engine/src/tick.ts                                     [edit, step 8.5]
packages/engine/src/actions/proposeUNResolution.ts              [new]
packages/engine/src/actions/voteUNResolution.ts                 [new]

apps/web/components/Panels/UN.tsx                               [new]
apps/web/components/Panels/PanelTabs.tsx                        [edit, +ONU tab]
apps/web/components/Modals/UNResolutionModal.tsx                [new]
apps/web/components/Modals/UNProposeResolutionModal.tsx         [new]
```

---

## SYSTEM 3 — Bloc Politics

### Mechanics

- Tre blocchi nominati con identità: **Western Alliance**, **Eastern Alliance**, **Non-Aligned Movement**. C'è un quarto blocco implicito `unaligned` per nazioni non in alcuno (gestito come default; non ha leader, non ha summit, non ha effetti aggregati).
- Ogni blocco ha:
  - **leader**: la nazione membro con il punteggio più alto in `gdp + military.armySize * 1000`. Ricomputato ogni 13 tick (un trimestre). Cambio leader → notifica + evento narrativo `event_bloc_leader_change_<bloc>`.
  - **affinità interna**: media delle attitude pairwise fra membri. Se scende sotto +20 per 50 tick, scatta un `event_bloc_fragmentation_<bloc>` con scelta narrativa per il leader.
  - **memberCountryIds**: lista (ridondante con `country.bloc`, ma utile per evitare lookup ricorsivi).
  - **foundedAtTick**: per analytics/UI.
- Le **rivalità di blocco**: Western-vs-Eastern hanno una "permanent friction" — un decay reputazionale +1/tick verso negativo fra membri dei due blocchi rivali, indipendentemente dalle azioni. Modella la "guerra fredda strutturale". Non si applica vs Non-Aligned.

### Player interactions

Il giocatore non può **né creare** un nuovo blocco né **dissolvere** un blocco esistente. Può però:

| Azione | Disponibile a | Costo | Effetto |
|---|---|---|---|
| `applyToJoinBloc` | Sempre | 30 political capital | Triggera valutazione: i membri del blocco votano (modal-like, ma in 8 tick); se ≥ 60% yes → giocatore entra nel blocco |
| `leaveBloc` | Solo se in un blocco | Gratuita | Effetto immediato: −30 reputazione presso ex-blocco, +10 presso rivale, quattro tick di "fluctuating bloc" status (no benefits) |
| `proposeBlocSummit` | Solo se leader del proprio blocco | 30 political capital | Triggera un evento narrativo speciale "summit" che aggrega le attitude dei membri verso un target choice (es. "summit straordinario contro X") — boost coordinato di reputazione anti-X |
| `defensePactProposal` | Solo se leader | 20 political capital | Propone agli altri membri un patto di difesa: se uno è attaccato, tutti entrano in guerra automaticamente. Voto interno di blocco, 60% yes → patto attivo |

I patti di difesa sono **opt-in per blocco e per evento**. Quando un membro viene attaccato, l'engine controlla `bloc.activeDefensePact === true`; se sì, dichiara guerra automatica all'aggressore per tutti i membri (notifica esplicita al giocatore, niente confirm — è la conseguenza del patto).

### Type sketch

```ts
export type BlocAffinity = number; // -100..+100, media pairwise

export type Bloc = {
  id: BlocId;                                   // 'western' | 'eastern' | 'non-aligned'
  nameKey: string;
  /** Country with highest gdp+military among members. Null if bloc has 0 members. */
  leaderCountryId: CountryId | null;
  memberCountryIds: CountryId[];
  /** Tick of bloc founding. Negative for blocs that exist at scenario start. */
  foundedAtTick: number;
  /** Cached affinity, recomputed every 5 ticks. */
  affinity: BlocAffinity;
  /** True if the bloc currently has an active mutual-defense pact. */
  activeDefensePact: boolean;
  /** Tick of last leader change, for UI flourish. */
  lastLeaderChangeAtTick: number;
};

export type BlocsState = Record<BlocId, Bloc>;
```

`GameState` riceve `blocs?: BlocsState`. Anche se lo scenario non li menziona esplicitamente, l'engine inizializza i tre blocchi standard a startup (memberCountryIds = countries con `bloc === <id>` da scenario).

### Tick step (engine)

Aggiunto come **step 7.6** (dopo Reputation, prima di AI turn):

```
7.6. Blocs:
  - ogni 5 tick: ricomputa affinity per ogni blocco
  - ogni 13 tick: ricomputa leaderCountryId per ogni blocco
  - check membership transitions per nazioni AI (vedi System 1)
  - se un membro è stato attaccato in questo tick AND bloc.activeDefensePact:
      → ogni altro membro dichiara guerra all'aggressore (action: declareWar via engine, non player input)
      → emetti event_bloc_defense_pact_triggered
```

### Bloc UI

- **Pannello ONU** (System 2) ha una sotto-sezione "Blocchi" che mostra:
  - I 3 blocchi con: nome, leader (con bandiera/colore), # membri, affinity bar, "Pact attivo: sì/no".
  - La membership corrente del giocatore (badge).
  - Le azioni `applyToJoinBloc`, `leaveBloc`, e (se leader) `proposeBlocSummit` / `defensePactProposal`.
- **Mappa SVG**: bordo della nazione colorato in funzione del blocco (azzurro / rosso / verde / grigio).
- **Notification stream**: cambi di leader, fragmentation events, defense pact triggers.

### File affetti

```
packages/engine/src/types.ts                                    [edit, +BlocsState, +Bloc]
packages/engine/src/blocs/                                      [new]
  ├── computeLeader.ts
  ├── computeAffinity.ts
  ├── transitions.ts                     ← entry/exit checks per AI countries
  ├── defensePact.ts                     ← logica auto-war
  └── index.ts
packages/engine/src/tick.ts                                     [edit, step 7.6]
packages/engine/src/actions/blocActions.ts                      [new — applyToJoin, leave, propose, pact]

apps/web/components/Panels/UN.tsx                               [edit, +Blocs sub-section]
apps/web/components/Map/Map.tsx                                 [edit, bloc-colored borders]
```

---

## SYSTEM 4 — Nuclear Weapons

### Modello a tre livelli

#### Livello 0 — **Deterrente passivo**

- Una volta che il giocatore (o qualsiasi nazione) ha completato `tech_military_nuclear_arsenal` E ha ≥ 1 warhead in `military.nuclearArsenal.warheadCount`, lo stato di "deterrenza" è attivo.
- Visibile alle altre nazioni quando il loro `intelligence.knownIntel[targetId] >= 'partial'` (l'intel parziale è il livello dove emerge "ha l'arma").
- Effetto: l'AI di `declareWar` riceve un malus di −5.0 sullo score (forte riduzione) per quel target. Pratica: nessuna AI normale dichiara guerra a un nucleare a meno che non sia anch'essa nucleare e/o pesantemente provocata.
- Non c'è azione attiva da fare: basta possederle.

#### Livello 1 — **Strike tattico (a regione)**

- Azione: `launchTacticalNuclear { targetRegionId, warheadId }`. Il bersaglio è una regione, non una nazione.
- Effetti immediati:
  - Tutti i `MilitaryDeployment` con `regionId === targetRegionId` vengono distrutti (armies removed, units = 0).
  - La nazione "host" della regione: `popularity: -30`, treasury intatto (la regione è devastata, non la capitale).
  - Reputazione del giocatore: −50 a tutti e tre i blocchi.
  - `worldTension: +30`.
  - Triggera **automaticamente** una `condemnation` ONU contro il giocatore al prossimo step ONU.
  - Tutti i nazione-AI che hanno trattati di alleanza con la nazione-host: `declareWar` automatico contro il giocatore (condizionato a `aiAggression > 0.5` per evitare false universali; nazioni `pacifist_trader` non lo fanno).
  - Consuma 1 warhead (`warheadCount -= 1`).
- Doppia conferma UI obbligatoria (vedi sotto).

#### Livello 2 — **Strike strategico (a nazione)**

- Azione: `launchStrategicNuclear { targetCountryId, warheadId }`. Il bersaglio è una nazione intera (capitale + sector industry).
- Logica:
  ```
  if target ha nukes (warheadCount >= 1) AND target.nuclearArsenal.deterrentActive:
      → MAD: entrambi i lati subiscono lo strike
      ```
- **Caso unilaterale (target senza nukes):**
  - Target: `gdp *= 0.5`, `treasury *= 0.3`, `popularity = 0`, `politicalCapital = 0`.
  - Tutti i deployment del target distrutti.
  - Capitale del target: occupazione automatica (regione contestata permanentemente).
  - Reputazione del giocatore: −100 saturo a tutti e tre i blocchi.
  - `worldTension: +60`.
  - Triggera `condemnation` ONU automatica.
  - Triggera `event_nuclear_aftermath_unilateral` (chain narrativo: famine, refugee crisis, ecc.).
  - Tutte le nazioni-AI con `aiPersonality.aggressiveness > 0.3` dichiarano guerra al giocatore.
  - Consuma 1 warhead.
- **Caso MAD (target con nukes):**
  - Entrambi: `gdp *= 0.2`, `treasury = 0`, `popularity = 0`, `politicalCapital = 0`.
  - Tutti i deployment di entrambi distrutti.
  - **Mondo**: `globalGdpReduction = 0.30` (modifier applicato a tutte le nazioni per i prossimi 200 tick).
  - `worldTension: +60`, clampato a 100.
  - Reputazione del giocatore: −100 saturo a tutti e tre i blocchi.
  - Triggera **chain di eventi** "Nuclear Winter": climate collapse (modifier su sector agriculture, −50% per 100 tick), refugee crisis (modifier su faction satisfaction populist −30 per tutte le nazioni superstiti), famine (popolarità −0.5/tick per 50 tick).
  - Auto-war di tutte le nazioni superstiti `aggressiveness > 0.2` contro chi ha lanciato per primo (ma con MAD entrambi sono devastati e l'auto-war è in pratica simbolica — nessuno ha eserciti).
  - Consuma 1 warhead per ciascuno.
- In entrambi i casi: la win condition `military` o `domination` diventa effettivamente irraggiungibile post-strike (popularity collassata, fazioni in collasso). È **esplicitamente** una scelta a perdere se non sai cosa stai facendo.

### UI gating: doppia conferma obbligatoria

Buried nel `MilitaryPanel`, sezione "Arsenale Nucleare" (visibile solo se `nuclearArsenal.warheadCount >= 1`).

1. **Pulsante "Lancia atomica"** — colore rosso saturo, icona radioactivity, padding generoso. Click apre **primo modal**:
   > **AVVERTENZA — Stai per usare un'arma nucleare.**
   > Conseguenze immediate:
   > - Reputazione mondiale: −50 (tattico) o −100 (strategico)
   > - Probabilità altissima di dichiarazioni di guerra a catena
   > - Possibile risposta MAD se il bersaglio possiede nukes
   >
   > [Bersaglio: <regione X o nazione Y>]
   > [Stima MAD: <yes/no, basato su intel>]
   >
   > [Annulla] [Continua →]

   "Continua" abilita il secondo modal solo se l'utente ha letto: **timer di 3 secondi obbligatorio prima che "Continua" diventi cliccabile** (anti-misclick).

2. **Secondo modal** — sanity check:
   > **CONFERMA FINALE.**
   > Una volta lanciato, questo non si annulla. Vuoi davvero procedere?
   >
   > Digita `LANCIO` per confermare:
   > [_______]
   >
   > [Annulla] [Lancia]

   Il pulsante "Lancia" è disabilitato finché l'utente non scrive esattamente `LANCIO` (case-sensitive). Anche qui, **chiusura del modal = annullamento totale dell'operazione** (nessuno stato pending, niente "ricorda la mia scelta").

3. Se confermato → l'azione viene applicata via `applyAction({ type: 'launchTacticalNuclear', ... })` o `'launchStrategicNuclear'`.

### Type sketch

```ts
export type NuclearArsenal = {
  /** Numero di testate disponibili. Decresce con ogni strike. */
  warheadCount: number;
  /** 0 = bombers (cancellabili), 1 = ICBM, 2 = hypersonic (no intercept). */
  deliverySystemLevel: 0 | 1 | 2;
  /** True if warheadCount >= 1 AND deterrentActive tech completata. */
  deterrentActive: boolean;
};

// in MilitaryState:
export type MilitaryState = {
  // ... esistenti ...
  /** Optional. Default: { warheadCount: 0, deliverySystemLevel: 0, deterrentActive: false }. */
  nuclearArsenal?: NuclearArsenal;
};

// in Action union:
export type Action =
  | /* ... esistenti ... */
  | { type: 'launchTacticalNuclear'; targetRegionId: RegionId }
  | { type: 'launchStrategicNuclear'; targetCountryId: CountryId };
```

### Tech tree additions (4 nuovi nodi)

| TechId | Branch | Cost | Prereqs | Effetti |
|---|---|---:|---|---|
| `tech_military_nuclear_research` | military | 1500 | `tech_military_advanced_doctrine` | Sblocca la ricerca nucleare; nessun arsenale ancora |
| `tech_military_nuclear_arsenal` | military | 3000 | `tech_military_nuclear_research` | `warheadCount = 1`, `deterrentActive = true`. Visibile a chi ha intel >= 'partial' su di te |
| `tech_military_nuclear_arsenal_advanced` | military | 4000 | `tech_military_nuclear_arsenal` | Sblocca multipli warhead/year (1 warhead aggiunto ogni 50 tick automaticamente, max 10) |
| `tech_military_hypersonic_delivery` | military | 5000 | `tech_military_nuclear_arsenal_advanced` | `deliverySystemLevel = 2`. Hypersonic: nessun intercept possibile (in Fase 3 nessuno intercepta comunque, ma il flag conta per Fase 4 / ABM) |

I nodi sono aggiunti agli scenari `mondo-contemporaneo` e `guerra-fredda` (in `guerra-fredda` con cost ridotti del 30% — la corsa atomica era la priorità del periodo). Per `ascesa-aurion` opzionale (lo scenario fittizio decide).

### Disarmo volontario (opzionale, vedi Open Questions)

Se la Open Question 4 viene risolta a "sì", aggiungere azione `dismantleNuclearArsenal { count: number }`:
- Costo: 0 treasury, ma 0 political capital se eseguito sotto un trattato `nonProliferation` ONU.
- Effetto: `warheadCount -= count`, +10 reputazione universale per ogni warhead dismesso.
- Senza trattato in vigore: il dismantling vale comunque ma rep boost dimezzato.

### File affetti

```
packages/engine/src/types.ts                                    [edit, +NuclearArsenal, +Actions]
packages/engine/src/actions/launchTacticalNuclear.ts            [new]
packages/engine/src/actions/launchStrategicNuclear.ts           [new]
packages/engine/src/actions/dismantleNuclear.ts                 [new — opzionale]
packages/engine/src/nuclear/                                    [new]
  ├── applyMAD.ts
  ├── applyUnilateral.ts
  ├── nuclearWinter.ts                   ← chain di eventi post-MAD
  └── index.ts
packages/engine/src/tick.ts                                     [edit, gestire warhead production]
packages/engine/src/ai/declareWarScoring.ts                     [edit, deterrent malus]

apps/web/components/Panels/Military.tsx                         [edit, sezione Arsenale]
apps/web/components/Modals/NuclearLaunchConfirm.tsx             [new]
apps/web/components/Modals/NuclearLaunchSanityCheck.tsx         [new]
apps/web/content/scenarios/mondo-contemporaneo.json             [edit, +tech]
apps/web/content/scenarios/guerra-fredda.json                   [edit, +tech]
```

---

## SYSTEM 5 — Endless / Sandbox Mode

### Tre sub-modalità (scelta del giocatore al new-game wizard)

#### **Eternal** (default raccomandato)

- La partita non finisce *mai* per win condition. Le 5 win condition esistenti (`economic`, `military`, `scientific`, `diplomatic`, `domination`) diventano **milestones**: quando soddisfatte, mostrano un toast "Hai raggiunto la vittoria <X>!" e si registrano in `state.cumulativeStats.victoriesAchieved`, ma il loop continua.
- Le condizioni di sconfitta restano attive (popularity collapse, treasury collapse, capital occupation, all factions angry). Una sola di queste comunque chiude la partita.
- Score visibile nell'HUD: `cumulativeStats.peakGdpRank` (rank PIL massimo raggiunto, lower-better), `peakTreasury` (max treasury mai avuto), `totalTechsUnlocked`, `totalReputationGained` (somma di tutte le delta positive).

#### **Era-paced** (più lavoro, defer parziale a Wave 10)

- La partita progredisce attraverso **ere temporali** definite a livello di scenario:
  - Per `mondo-contemporaneo`: 1960-1980 "Cold War Era" → 1980-2000 "End of History" → 2000-2020 "Information Age" → 2020+ "Space Age"
  - Per `guerra-fredda`: 1962-1972 "Cuban Crisis Era" → 1972-1985 "Détente Era" → 1985-1991 "Late Cold War"
  - Per `ascesa-aurion`: scenario-specific (definite nel JSON come ranges di tick)
- Ogni transizione di era apre un **modal `EraTransitionModal`** con summary stats: top achievements, reputazione, tech, eventi maggiori.
- Il giocatore può scegliere "Continua" (passa alla prossima era) oppure "Termina partita" (chiude come victory chapter, mostrando il summary finale).
- Le transizioni NON modificano il game state oltre a registrare il marker; sono UI flourish + checkpoint mentale.
- Il tipo `Scenario` riceve un campo opzionale:
  ```ts
  eras?: Array<{ id: string; nameKey: string; startTick: number; endTick: number; }>;
  ```
- Per Wave 9-10 implementiamo solo Eternal e Dethrone-loss. Era-paced viene **definito qui ma implementato in Wave 10** (è la sub-modalità più costosa per via dei summary screens e delle eras per scenario).

#### **Dethrone-loss** (la modalità "tensione")

- La partita finisce in sconfitta se il giocatore esce dalla **top-3 PIL globale** per **5 anni in-game consecutivi** (≥ 260 tick).
- Trigger secondario opzionale (configurabile per scenario, default attivo): se la reputazione presso un singolo blocco scende sotto −80 per ≥ 130 tick consecutivi → game over per "isolamento internazionale".
- Le win condition normali rimangono attive (puoi vincere normalmente *e* perdere così), ma il game state ha un nuovo contatore: `_dethroneStreaks: { outOfTop3Weeks: number; isolatedInBlocWeeks: Record<BlocId, number> }`.
- Aggiunge tensione strategica: non basta arrivare a #1, devi mantenerlo. Particolarmente sinergico con Eternal (giochi a tempo indeterminato MA con la spada di Damocle).

### Picker UI

- Aggiunto come **step 5** del new-game wizard, dopo difficoltà e prima della conferma.
- Tre chip orizzontali, default selezionato "Eternal":
  - **Eternal** — "Nessuna fine. Le vittorie sono milestone, gioca quanto vuoi."
  - **Era-paced** — "Avanza attraverso ere storiche con resoconti." [Wave 10]
  - **Dethrone-loss** — "Game over se cadi fuori dalla top-3 PIL per 5 anni."
- Per `quick-start`: lo step viene **skippato**, hardcoded a `'classic'` (la modalità Fase 2 originale, "vittoria = fine").
- Il valore viene salvato in `state.gameMode`.

### Save game changes

```ts
export type GameMode = 'classic' | 'eternal' | 'era-paced' | 'dethrone-loss';

export type CumulativeStats = {
  peakGdpRank: number;                    // 1 = #1 mondiale; default = 999
  peakTreasury: number;
  totalTechsUnlocked: number;
  totalReputationGained: number;          // somma delta positive
  totalReputationLost: number;            // somma delta negative (positivo per leggibilità)
  victoriesAchieved: VictoryConditionId[]; // milestones in Eternal
  eraTransitionsAtTicks: number[];        // per Era-paced
};

export type DethroneStreaks = {
  outOfTop3Weeks: number;
  isolatedInBlocWeeks: Record<BlocId, number>;
};

// in GameState:
export type GameState = {
  // ... esistenti ...
  gameMode?: GameMode;                    // default 'classic' per saves Fase 1/2
  cumulativeStats?: CumulativeStats;
  _dethroneStreaks?: DethroneStreaks;     // popolato solo se gameMode === 'dethrone-loss'
  /** Recording log of all actions, optional. Used by replay (deferred). */
  actionLog?: Array<{ tick: number; action: Action; playerCountryId: CountryId }>;
};
```

### Implementation order (Wave 9-10)

1. **Eternal** — il più facile. Modifica: `checkWinLoss` ritorna `'playing'` se gameMode === 'eternal' e regola win soddisfatta (toast invece di terminate). Init `cumulativeStats`. Update `peakGdpRank`/`peakTreasury` ad ogni tick (cheap).
2. **Dethrone-loss** — medio. Track `outOfTop3Weeks` e `isolatedInBlocWeeks` ogni tick; `checkWinLoss` ritorna `'lost'` se le soglie superano i limiti. Aggiungere notification 50 tick prima della soglia ("Sei fuori dalla top-3 da 4 anni — ne resta 1!").
3. **Era-paced** — più complesso. Definire eras per ogni scenario (o accettare di shippare solo per `mondo-contemporaneo` e `guerra-fredda` in Wave 10), implementare `EraTransitionModal` con summary stats, gestire transizioni. Defer a Wave 10 se Wave 9 è già pieno.

### Migration

I save Fase 1/2 caricano in Fase 3 con default `gameMode: 'classic'`, `cumulativeStats: undefined`. Nessuna perdita di compatibilità.

### File affetti

```
packages/engine/src/types.ts                                    [edit, +GameMode, +CumulativeStats, +DethroneStreaks]
packages/engine/src/checkWinLoss.ts                             [edit, gameMode-aware]
packages/engine/src/cumulativeStats/                            [new]
  ├── updatePeak.ts
  └── index.ts
packages/engine/src/dethrone/                                   [new]
  ├── computeRanking.ts
  └── checkDethroneLoss.ts
packages/engine/src/migrations/v2tov3.ts                        [new — defaults gameMode='classic']

apps/web/components/NewGame/GameModePicker.tsx                  [new — Wave 9]
apps/web/components/Modals/EraTransitionModal.tsx               [new — Wave 10]
apps/web/components/Modals/MilestoneToast.tsx                   [new — per Eternal]
apps/web/app/new/page.tsx                                       [edit — step 5]
```

---

## SYSTEM 6 — Space Programs as Power Projection

### Mechanics

- Il ramo **`space`** del tech tree (esistente in Fase 1) viene **espanso** con nodi che producono **prestige reputazionale** invece di solo modifier numerici.
- Ogni *space milestone* ha:
  - Un `firstAchieverCountryId` (chi è arrivato per primo) e `firstAchievedAtTick`.
  - Un `prestigeFirst`: reputazione data al primo achiever (alta).
  - Un `prestigeFollow`: reputazione data ai successivi achievers, decrescente con la posizione (50% al secondo, 25% al terzo, 0 dal quarto in poi).
- L'engine traccia globalmente lo stato di ogni milestone in `state.spaceMilestones`. Quando un'AI o il giocatore completa la tech, l'engine controlla se è il primo: se sì, applica `prestigeFirst`; altrimenti applica `prestigeFollow * decay(position)`.
- Le space milestone sono **separate dai semplici tech** del ramo space: non tutti i tech del ramo sono milestone. Le milestone sono il sottoinsieme "iconic" — quelle che il mondo ricorda.

### Le milestone (~7 in Fase 3)

| TechId (milestone) | Pitch | prestigeFirst | prestigeFollow |
|---|---|---:|---:|
| `tech_space_first_satellite` | "Sputnik" — primo satellite in orbita | +5 univ. | +2 univ. |
| `tech_space_manned_orbit` | Primo astronauta in orbita | +8 univ. | +3 univ. |
| `tech_space_moon_landing` | Sbarco sulla Luna | +20 univ. | +8 univ. |
| `tech_space_moon_base` | Base lunare permanente | +25 univ. | +10 univ. |
| `tech_space_mars_mission` | Missione umana su Marte | +30 univ. | +12 univ. |
| `tech_space_mars_colony` | Colonia permanente su Marte | +40 univ. | +15 univ. |
| `tech_space_asteroid_mining` | Mining asteroidi attivo | +25 W: +30 (industriale prevale) | +10 univ. |

"univ." = applicato a tutti e tre i blocchi simmetricamente. Le milestone sono additive alla rep — non fanno parte della "rolling window" per non scomparire dopo 2 anni.

### Type sketch

```ts
export type SpaceMilestone = {
  techId: TechId;
  firstAchieverCountryId: CountryId | null;
  firstAchievedAtTick: number | null;
  /** Subsequent achievers in order; index 0 is second achiever, etc. */
  followAchievers: Array<{ countryId: CountryId; achievedAtTick: number }>;
  /** Reputation grant for first achiever. */
  prestigeFirst: Partial<ReputationByBloc>;     // se Partial: applica solo blocchi specificati
  /** Reputation grant for follow achievers (decays by position). */
  prestigeFollow: Partial<ReputationByBloc>;
};

export type SpaceMilestonesState = Record<TechId, SpaceMilestone>;
```

`GameState.spaceMilestones?: SpaceMilestonesState`. Inizializzato a startup leggendo `scenario.techTree` per i nodi di `branch === 'space'` flaggati come milestone (nuovo campo opzionale `isMilestone: boolean` su `TechDefinition`).

### Tick step (engine)

Aggiunto come **step 2.5** (dopo "Ricerca", per applicare prestige nello stesso tick in cui la tech completa):

```
2.5. Space milestones:
  - per ogni completion di tech in questo tick:
      - se tech.isMilestone === true:
          - se firstAchieverCountryId === null:
              → firstAchieverCountryId = country
              → applica prestigeFirst alla reputazione
              → emetti event_space_milestone_first
          - else:
              → push in followAchievers
              → applica prestigeFollow * decay(position)
              → emetti event_space_milestone_follow
```

### UI

- **Nuovo tab "Space Race" dentro `ResearchPanel`** (sub-tab orizzontale: "Tech tree" | "Space race").
- La tab "Space race" mostra:
  - Una lista delle 7 milestone con:
    - Icona (razzo, bandiera lunare, ecc.)
    - Nome
    - Stato: "Non raggiunta" | "Raggiunta da <country> al tick X" | "In progress da <country>"
    - Lista degli achievers in ordine cronologico
    - Reputation gained dal first achiever
- **Notification stream**: ogni completion di milestone genera una notifica visibile prominente ("⭐ Aurion ha raggiunto: Moon Landing! +20 reputazione mondiale.").
- Le milestone già raggiunte da AI prima del giocatore: visibili come "missed opportunity" — il giocatore può ancora completare la tech (per i benefici scientifici normali) ma il prestige è ridotto.

### File affetti

```
packages/engine/src/types.ts                                    [edit, +SpaceMilestone, isMilestone su TechDef]
packages/engine/src/space/                                      [new]
  ├── computeMilestone.ts
  ├── applyPrestige.ts
  └── index.ts
packages/engine/src/tick.ts                                     [edit, step 2.5]

apps/web/components/Panels/Research.tsx                         [edit, +Space Race tab]
apps/web/components/Panels/SpaceRaceTab.tsx                     [new]

apps/web/content/scenarios/mondo-contemporaneo.json             [edit, +milestone tech, isMilestone:true]
apps/web/content/scenarios/guerra-fredda.json                   [edit, +milestone tech]
apps/web/content/scenarios/ascesa-aurion.json                   [edit, opzionale, +milestone fittizie]
```

---

## SYSTEM 7 — Replay Mode (DEFERRED a Wave 11+)

> ⚠️ Marcato come **deferred** — nello spec per completezza dell'identità di Fase 3, ma l'implementazione è esplicitamente programmata per Wave 11 al più presto. La Wave 9 e 10 NON devono shippare nulla di replay.

### Goal

Permettere al giocatore di rivedere una partita finita, tick per tick, in modalità "playback".

### Mechanics

- Il save Fase 1+2 contiene già l'intera `GameState` finale + il `seed` deterministico. Quello che manca per il replay: la sequenza completa di azioni del giocatore.
- **Action log**: nuovo campo opzionale `state.actionLog: Array<{ tick: number; action: Action; playerCountryId: CountryId }>`. Popolato da `applyAction` quando il flag `recordReplay` è attivo.
- Replay viewer: nuova route `/[locale]/replay/[saveId]`. Logica:
  1. Carica il save.
  2. Ricostruisce `createGame(scenario, options)` con stesso seed.
  3. Applica in ordine ogni `(tick, action)` dal log, scattando snapshot ogni N tick.
  4. UI mostra: stato corrente + controlli playback.
- Controlli: play / pause / step (1 tick) / speed (1x, 2x, 4x, 8x) / restart / jump-to-tick (slider).

### Storage cost

- Action log per partita media (200-800 tick × ~20 azioni / 100 tick = ~40-160 azioni totali, ognuna ~200 byte JSON): **~8-32 KB**. Trascurabile.
- Setting globale `meta.recordReplays: boolean` (default `true`, dismissibile).

### Type sketch

```ts
// Già menzionato in System 5:
actionLog?: Array<{ tick: number; action: Action; playerCountryId: CountryId }>;

// Settings globali in meta:
type MetaSettings = {
  recordReplays: boolean;
  // ...
};
```

### File affetti (quando implementato)

```
packages/engine/src/replay/                                     [new — Wave 11]
  ├── reconstructState.ts
  └── index.ts
apps/web/app/[locale]/replay/[saveId]/page.tsx                  [new — Wave 11]
apps/web/components/Replay/PlaybackControls.tsx                 [new — Wave 11]
```

### Why deferred

- Non aggiunge identità al gioco (è una feature *secondary*, non *core*).
- Richiede UI dedicata e un'altra route, scope creep per Wave 9-10.
- Una volta che `actionLog` è registrato (semplice), la feature può essere costruita asincronamente in Wave 11+ senza bloccare il resto della Fase 3.
- Per Wave 9: l'unica modifica preparatoria è aggiungere `actionLog?` come campo opzionale e popolarlo se flag è attivo. Questo costa < 0.5 giorni e non blocca nulla.

---

## SYSTEM 8 — Mod System (DEFERRED a Wave 12+)

> ⚠️ Marcato come **deferred** — listato qui per dichiarare scope, ma esplicitamente fuori dal lavoro di Wave 9-10.

### Goal

Permettere a giocatori avanzati di scrivere/giocare scenari custom senza ricompilare l'app.

### Mechanics

- **Drag-and-drop di un file `.json`** sulla home page → l'app valida il file con il validator esistente (Phase 2 `validate.ts`) → se valido, lo registra come scenario "user-loaded" in IndexedDB → diventa giocabile dal new-game wizard.
- Il giocatore può rimuovere mod da una pagina dedicata `/mods` (lista con remove).
- Il **CLI scaffolder** `pnpm new-scenario` esistente (Fase 2) rimane lo strumento di authoring ufficiale. La Fase 3 *espone* il workflow al giocatore non-dev: scarica il template, modifica con un editor di testo, drag-and-drop.
- **Sandbox di validazione**: prima di accettare un mod, il validator controlla:
  - Schema-valid (Zod schema esistente in `validate.ts`)
  - Nessun campo "code" o "function" — solo dati JSON. **Mai** eval/execute codice utente.
  - Limit ragionevoli: max 100 country, max 200 tech, max 100 eventi (DOS-prevention).

### Out of scope per la Fase 3 (anche oltre il deferral)

- **Sharing online dei mod** (community gallery, voting, ecc.) — Fase 4
- **Per-mod custom code**: solo dati. Niente JS/TS eseguibile, mai. Logica = engine fissa.
- **Translation editor in-game** — i mod possono includere `messages.it.json` e `messages.en.json` come allegati (drag in bundle), ma non c'è UI per editarli.
- **Mod chain / multiple mod attivi**: un mod = uno scenario indipendente. No "mod che modifica un altro mod".

### Type sketch

```ts
// in IndexedDB (nuovo store):
type ModEntry = {
  id: string;             // user-given o auto
  name: string;
  scenarioJson: Scenario; // validated copy
  messagesIt?: Record<string, string>;
  messagesEn?: Record<string, string>;
  installedAt: number;
};
```

### File affetti (quando implementato)

```
apps/web/lib/persistence.ts                                     [edit — +mods store]
apps/web/lib/modValidator.ts                                    [new — wraps Phase 2 validate.ts + DOS limits]
apps/web/app/[locale]/mods/page.tsx                             [new]
apps/web/components/Home/ModDropZone.tsx                        [new]
```

### Why deferred

- Nessun impatto sull'identità di Fase 3.
- Richiede design di UX di onboarding (come spieghi al giocatore non-dev cos'è uno scenario JSON?).
- Il validator Fase 2 è già robusto, ma l'esposizione al pubblico richiede DOS hardening.
- Wave 9-10 sono pieni di sistemi *core*; il mod system è "nice to have" che può attendere senza bloccare niente.

---

## SYSTEM 9 — Achievements

### Goal

Una progressione meta cross-partita: il giocatore vede "12 di 30 achievement sbloccati" sul profilo (locale), e ogni partita può sbloccarne di nuovi. Aumenta il valore di replay senza dipendere da multiplayer/leaderboard.

### Mechanics

- Ogni achievement è una struttura dati:
  ```ts
  type Achievement = {
    id: string;
    nameKey: string;
    descriptionKey: string;
    iconKey: string;
    /** Closed taxonomy of conditions. */
    condition: AchievementCondition;
    /** True if hidden until unlocked. Default false. */
    secret?: boolean;
    /** Reward (cosmetic flag, no game effect). */
    badgeKey?: string;
  };
  ```
- Conditions tipizzate (closed union):
  ```ts
  type AchievementCondition =
    | { kind: 'completeTech'; techId: TechId }
    | { kind: 'winVictory'; victoryId: VictoryConditionId }
    | { kind: 'reachStat'; stat: 'popularity'|'treasury'|'gdp'|'researchOutput'; value: number }
    | { kind: 'signNAlliances'; n: number }
    | { kind: 'survive'; ticks: number }
    | { kind: 'reachReputation'; bloc: BlocId; value: number }
    | { kind: 'spacefirst'; techId: TechId }
    | { kind: 'unMember'; ticks: number }
    | { kind: 'detectNSpies'; n: number }
    | { kind: 'launchNuclear'; type: 'tactical'|'strategic' }
    | { kind: 'survivedMad'; }
    | { kind: 'maintainTop3'; ticks: number }
    | { kind: 'compound'; all: AchievementCondition[] };
  ```
- Ogni tick l'engine controlla, per ogni achievement non ancora sbloccato per il save corrente, se la condizione è soddisfatta. Se sì → emette `event_achievement_unlocked` + flag in `state.unlockedAchievementsThisGame: AchievementId[]`.
- Persistenza globale: `meta.achievements: Set<AchievementId>` in IndexedDB. Cross-save, cross-scenario.

### Initial set (~25 achievement)

Mix di condizioni per coprire i nove sistemi:

1. **`first_steps`** — Completa la prima tech (qualsiasi). [Easy, primo unlock garantito]
2. **`tech_addict`** — Completa 25 tech in una singola partita.
3. **`treasury_titan`** — Raggiungi treasury > 1B.
4. **`popularity_hero`** — Mantieni popularity > 90 per 50 tick consecutivi.
5. **`gdp_crown`** — Raggiungi PIL #1 globale.
6. **`alliance_weaver`** — Hai 5 alleanze attive contemporaneamente.
7. **`spy_master`** — 10 operazioni spia di successo in una partita.
8. **`counter_intel`** — Rileva 5 spie nemiche in una partita.
9. **`peacekeeper`** — Voti "yes" a 10 risoluzioni ONU peacekeeping.
10. **`veto_lord`** — Pone veto su una risoluzione (membro permanente).
11. **`bloc_leader`** — Diventa leader di un blocco.
12. **`bloc_hopper`** — Cambia blocco almeno una volta in una partita.
13. **`isolated_one`** — Raggiungi reputazione < −80 in due blocchi simultaneamente. [Achievement "antieroe"]
14. **`world_friend`** — Raggiungi reputazione > +50 in tutti e tre i blocchi simultaneamente.
15. **`first_satellite`** — Sii il primo a lanciare un satellite (prestigio space).
16. **`moon_first`** — Sii il primo a sbarcare sulla Luna.
17. **`mars_first`** — Sii il primo a inviare una missione su Marte.
18. **`nuclear_power`** — Costruisci il tuo primo warhead.
19. **`mutually_assured`** — Sopravvivi a uno scenario MAD (tu lanci o sei lanciato e sopravvivi). [Secret]
20. **`scorched_earth`** — Lancia uno strike strategico nucleare. [Secret, achievement "dark"]
21. **`disarmer`** — Smantella tutto il tuo arsenale nucleare via trattato `nonProliferation`.
22. **`eternal_player`** — Gioca 1000 tick in modalità Eternal.
23. **`maintained_top3`** — Resta nella top-3 PIL per 500 tick consecutivi (modalità Dethrone-loss).
24. **`era_traveler`** — Completa una transizione di era (modalità Era-paced).
25. **`comeback_kid`** — Vinci una partita dopo essere stato in `_loseStreaks > 50%` di una qualsiasi soglia.
26. **`speedrun`** — Vinci `quick-start` in < 100 tick.
27. **`iron_man`** — Vinci una partita in modalità Iron Man.
28. **`pacifist`** — Vinci una partita senza dichiarare guerra mai.
29. **`crystal_chess`** — Vinci una partita usando il seed deterministico noto (eg `"aurion-default"`) → permette training repeatable.
30. **`completionist`** — Sblocca 25 achievement.

I primi 5 sono "confidence boost" garantiti per qualsiasi giocatore che gioca due partite. Gli ultimi 5 sono "long tail".

### UI

- **Toast unlock**: in basso a destra, dimensione media, dura 5 secondi, dismissibile. Mostra icona + nome + descrizione.
- **Pagina trofei**: nuova route `/[locale]/trofei`. Griglia di 30 card. Locked = silhouette grigia. Unlocked = colorato + data di sblocco + scenario in cui è stato sbloccato.
- **Counter in home**: "Hai sbloccato 12/30 achievement" come teaser.
- I `secret: true` non mostrano nemmeno la silhouette finché non sbloccati (mostrano "???").

### Tick step (engine)

Aggiunto come **step 11** (ultimo, dopo `checkWinLoss`):

```
11. Achievements:
  - per ogni achievement non in state.unlockedAchievementsThisGame:
      - se condition soddisfatta: push in unlockedAchievementsThisGame, emetti event_achievement_unlocked
  - (la persistenza globale è gestita lato app/web, non engine: il web reagisce all'evento e fa updateMeta)
```

### File affetti

```
packages/engine/src/types.ts                                    [edit, +Achievement, +AchievementCondition]
packages/engine/src/achievements/                               [new]
  ├── definitions.ts                     ← le 30 achievement
  ├── checkConditions.ts
  └── index.ts
packages/engine/src/tick.ts                                     [edit, step 11]

apps/web/lib/persistence.ts                                     [edit, +meta.achievements set]
apps/web/components/Notifications/AchievementToast.tsx          [new]
apps/web/app/[locale]/trofei/page.tsx                           [new]
apps/web/components/Home/AchievementCounter.tsx                 [new]
```

---

# Architettura globale — sintesi

## Engine (`packages/engine/`)

### Nuovi step nel tick (riepilogo)

Estendiamo il loop di tick (Fase 1 era 10 step, Fase 2 invariato). Fase 3 aggiunge:

| # | Step | Cost stimato | Fase 3 nuovo? |
|---|---|---|---|
| 1 | Economia | basso | no |
| 2 | Ricerca | basso | no |
| 2.5 | **Space milestones** | basso | **sì (System 6)** |
| 3 | Spy operations | basso | no |
| 4 | Military | medio | no |
| 5 | Politica | basso | no |
| 6 | Fazioni | basso | no |
| 7 | Aggiornamento `_loseStreaks` | basso | no |
| 7.5 | **Reputation** | medio | **sì (System 1)** |
| 7.6 | **Blocs** | basso | **sì (System 3)** |
| 8 | AI turn | alto | no |
| 8.5 | **UN** | medio | **sì (System 2)** |
| 9 | Eventi narrativi | medio | no |
| 9.5 | **Cumulative stats / Dethrone tracking** | basso | **sì (System 5)** |
| 10 | World tension + checkWinLoss | basso | edit (gameMode-aware) |
| 11 | **Achievements** | basso | **sì (System 9)** |

Cost totale aggiuntivo per tick: stimato ~+15-25% di compute. Trascurabile alla scala di 200-800 tick per partita.

### Nuovi tipi (riepilogo)

In `packages/engine/src/types.ts` (modifiche additive, retro-compat):

- `BlocId`, `ReputationByBloc`, `ReputationDelta`, `ReputationState`
- `UNResolutionKind`, `UNVote`, `UNResolution`, `UNState`
- `Bloc`, `BlocsState`
- `NuclearArsenal` (sotto `MilitaryState`)
- `GameMode`, `CumulativeStats`, `DethroneStreaks`
- `SpaceMilestone`, `SpaceMilestonesState`
- `Achievement`, `AchievementCondition`
- Estensione di `Action` union (5 nuove varianti: `launchTacticalNuclear`, `launchStrategicNuclear`, `dismantleNuclear`, `proposeUNResolution`, `voteUNResolution`, `applyToJoinBloc`, `leaveBloc`, `proposeBlocSummit`, `defensePactProposal`)
- Estensione di `Scenario` (campi opzionali: `unCouncilMembers?: CountryId[]`, `eras?: Era[]`)
- Estensione di `CountryInit` (campo opzionale: `bloc?: BlocId`)
- Estensione di `TechDefinition` (campo opzionale: `isMilestone?: boolean`)
- Estensione di `GameState` (campi opzionali: `reputation?`, `un?`, `blocs?`, `gameMode?`, `cumulativeStats?`, `_dethroneStreaks?`, `spaceMilestones?`, `unlockedAchievementsThisGame?`, `actionLog?`)

### Nuovi action variant

```ts
export type Action =
  | /* Fase 1+2 esistenti */
  | { type: 'launchTacticalNuclear'; targetRegionId: RegionId }
  | { type: 'launchStrategicNuclear'; targetCountryId: CountryId }
  | { type: 'dismantleNuclear'; count: number }
  | { type: 'proposeUNResolution'; kind: UNResolutionKind; targetCountryId?: CountryId; targetRegionId?: RegionId }
  | { type: 'voteUNResolution'; resolutionId: string; vote: UNVote }
  | { type: 'applyToJoinBloc'; blocId: BlocId }
  | { type: 'leaveBloc' }
  | { type: 'proposeBlocSummit'; targetCountryId?: CountryId }
  | { type: 'defensePactProposal' };
```

### Migration v2 → v3

Nuova `packages/engine/src/migrations/v2tov3.ts`. Funzione pura `(GameState v2) → GameState v3` che popola:

- `gameMode = 'classic'` (default Fase 2 behavior)
- `reputation = { deltas: [], current: { western: 0, eastern: 0, 'non-aligned': 0, unaligned: 0 } }`
- `un = { active: false, permanentMembers: [], activeResolutions: [], history: [] }`
- `blocs` derivato leggendo `country.bloc` da scenario (se presente)
- `cumulativeStats = { peakGdpRank: 999, peakTreasury: <current>, totalTechsUnlocked: <count>, ... }`
- `spaceMilestones = {}` (nessuno raggiunto)
- `actionLog = []` (vuoto)
- `unlockedAchievementsThisGame = []`

Wired in `apps/web/lib/persistence.ts` al load: se `engineVersion` < `'3.x'`, applica v1→v2 (esistente) poi v2→v3.

## Web app (`apps/web/`)

### Nuovi pannelli

- **ONU** — settimo `PanelTab`, contiene voting + bloc politics. Visibile solo se `state.un?.active === true`.

### Nuovi componenti (riepilogo)

```
apps/web/components/
├── Hud/
│   └── ReputationBadges.tsx                 [new — System 1]
├── Panels/
│   ├── UN.tsx                               [new — System 2 + 3 bloc sub-section]
│   ├── SpaceRaceTab.tsx                     [new — System 6, sub-tab di Research]
│   └── Military.tsx                         [edit — sezione Arsenale Nucleare]
├── Modals/
│   ├── UNResolutionModal.tsx                [new — System 2]
│   ├── UNProposeResolutionModal.tsx         [new — System 2]
│   ├── ReputationDetailModal.tsx            [new — System 1]
│   ├── NuclearLaunchConfirm.tsx             [new — System 4 step 1]
│   ├── NuclearLaunchSanityCheck.tsx         [new — System 4 step 2]
│   ├── EraTransitionModal.tsx               [new — System 5, Wave 10]
│   └── MilestoneToast.tsx                   [new — System 5 Eternal]
├── Notifications/
│   └── AchievementToast.tsx                 [new — System 9]
├── NewGame/
│   └── GameModePicker.tsx                   [new — System 5, step 5 wizard]
└── Home/
    └── AchievementCounter.tsx               [new — System 9]
```

### Nuove pagine

- `apps/web/app/[locale]/trofei/page.tsx` — galleria achievement
- `apps/web/app/[locale]/replay/[saveId]/page.tsx` — Wave 11+ (deferred)
- `apps/web/app/[locale]/mods/page.tsx` — Wave 12+ (deferred)

### i18n

Add maggiore di tutte le fasi: stimato ~250-400 nuove chiavi per IT+EN totale, divise per:

- `rep.*` — reputation reasons, bloc names (~50 chiavi)
- `un.*` — resolution types, vote labels, button texts (~80 chiavi)
- `bloc.*` — bloc names, leader changes, summit (~30 chiavi)
- `nuclear.*` — warning copy, confirm dialog text, MAD aftermath events (~50 chiavi)
- `mode.*` — game mode names, era labels, dethrone copy (~40 chiavi)
- `space.*` — milestone names, space race UI (~30 chiavi)
- `achievement.*` — 30 achievement × (name + description) = ~60 chiavi
- `event.phase3.*` — eventi narrativi specifici (~50 chiavi)

Le chiavi sono ripartite tra messages globali (`apps/web/content/messages/{it,en}.json` — UI chrome + tipi resolution + bloc) e per-scenario (eventi narrativi dentro `<scenario>.{it,en}.json`).

### Persistenza (Dexie / IndexedDB)

Schema v3+:

```ts
db.version(3).stores({
  saves: '&id, name, scenarioId, savedAt',
  meta:  '&key',
  mods:  '&id, name, installedAt',          // Wave 12+
});

// estensione SaveEntry:
type SaveEntry = {
  // ... Phase 1+2 ...
  gameMode: GameMode;                        // dal Phase 3
  // (state contiene già tutti i nuovi campi opzionali)
};

// nuove chiavi in meta:
type Meta = {
  // ...
  achievements: Set<AchievementId>;          // global, cross-save
  recordReplays: boolean;                    // default true
  ironManUnlocked: Record<ScenarioId, boolean>; // Phase 2 esistente
};
```

Migration esistente Phase 2 (v1→v2) resta. Aggiungiamo v2→v3 in `packages/engine/src/migrations/v2tov3.ts`. Loader applica `chain([v1tov2, v2tov3])` ai save Fase 1 quando vengono caricati in Fase 3.

---

## Scenari interessati dalla Fase 3

| Scenario | Fase 3 changes |
|---|---|
| `ascesa-aurion` | Aggiunge campo `bloc` a country (con assegnazioni fittizie). UN opzionale (lasciamo `unCouncilMembers: []` di default). Tech tree riceve i 4 nodi nucleari come opzione, e 7 milestone space. ~3-4 eventi narrativi nuovi (bloc fragmentation, ONU first appearance). |
| `mondo-contemporaneo` | UN attivo, 6 council members. Bloc assegnati realisticamente (USA→western, Russia→eastern, India→non-aligned, ecc.). Nucleari: i 5 stati con nukes hanno `tech_military_nuclear_arsenal` già completata. Milestones space tutte presenti. ~10 eventi narrativi nuovi (ONU resolution flavor, nuclear scare events, climate accord). |
| `guerra-fredda` | UN attivo, 5 council members. Western vs Eastern affilato (entrambi i superpoteri sono leader del proprio blocco a startup). Nucleari abilitati con cost ridotto del 30%. Milestones space → la corsa allo spazio è il narrative core. ~12 eventi narrativi nuovi (Cuban-style crisis, decolonizzazione che cambia bloc membership). |
| `quick-start` | **Nessuna Fase 3** (rimane mini-tutorial). UN inattivo, nessun blocco visibile, nessun nucleare, gameMode hardcoded a 'classic'. La Fase 3 è scoping out per design — il quick-start serve a imparare i 6 sistemi base, non i 9 totali. |

---

## Estimated scope per wave

Stime best-effort, persona singola focalizzata. La Fase 3 è esplicitamente più grande di Fase 1+2 messi insieme; le wave sono progettate per essere shippabili indipendentemente.

### Wave 9 — Reputation + UN + Blocs + Endless (Eternal + Dethrone)

Foundation della Fase 3. Senza queste cose i sistemi successivi non hanno significato.

| Componente | Realistic | Optimistic |
|---|---:|---:|
| Engine: ReputationState + tabella deltas + tick step 7.5 | 3 g | 2 g |
| Engine: UN system (types, AI voting, triggers, applyResolution, tick 8.5) | 5 g | 3 g |
| Engine: Blocs (types, leader, affinity, transitions, defense pact, tick 7.6) | 3 g | 2 g |
| Engine: Endless mode (Eternal + Dethrone, gameMode-aware checkWinLoss, cumulativeStats) | 2 g | 1 g |
| Engine: Action variants (5 nuove) + tests | 2 g | 1 g |
| Engine: migration v2→v3 + tests | 1 g | 0.5 g |
| Engine: estensione `sim.ts` per tracciare reputation/UN events nel JSONL | 1 g | 0.5 g |
| Web: ReputationBadges + ReputationDetailModal | 1.5 g | 1 g |
| Web: pannello ONU (voting + blocs sub-section) | 4 g | 2.5 g |
| Web: UNResolutionModal + UNProposeResolutionModal | 2 g | 1.5 g |
| Web: GameModePicker + wizard step 5 | 1.5 g | 1 g |
| Web: bloc-colored map borders + bloc affinity overlay | 1 g | 0.5 g |
| Web: notification stream extensions (UN, bloc, dethrone warnings) | 1 g | 0.5 g |
| Content: assegnazione bloc a country in 3 scenari + UN council members | 1 g | 0.5 g |
| Content: ~10 eventi narrativi nuovi (bloc transitions, ONU flavor) | 2 g | 1.5 g |
| i18n: ~150 chiavi nuove IT+EN | 1.5 g | 1 g |
| Bilanciamento: target di sim per reputation distribution | 2 g | 1 g |
| E2E test: pick-game-mode + UN-vote-flow + bloc-join-leave | 2 g | 1 g |
| **Wave 9 totale** | **~36 g** | **~22 g** |

~7-8 settimane realistic.

### Wave 10 — Nuclear + Space + Era-paced + Achievement core

| Componente | Realistic | Optimistic |
|---|---:|---:|
| Engine: NuclearArsenal + 4 tech tree nodes | 1 g | 0.5 g |
| Engine: launchTactical + launchStrategic + MAD logic + nuclear winter chain | 4 g | 2.5 g |
| Engine: dismantleNuclear (opzionale, dietro Open Question 4) | 0.5 g | 0.5 g |
| Engine: SpaceMilestone + tick 2.5 + applyPrestige | 2 g | 1 g |
| Engine: Era-paced (Era type, transition tracking, tick step) | 2 g | 1.5 g |
| Engine: Achievement system (definitions + checkConditions + tick 11) + 25-30 achievement | 4 g | 2.5 g |
| Web: Military panel — sezione Arsenale Nucleare | 1.5 g | 1 g |
| Web: NuclearLaunchConfirm + SanityCheck (doppia conferma) | 2 g | 1 g |
| Web: SpaceRaceTab in ResearchPanel | 1.5 g | 1 g |
| Web: EraTransitionModal + summary stats | 2 g | 1.5 g |
| Web: AchievementToast + pagina /trofei + AchievementCounter home | 2 g | 1 g |
| Content: nucleari in mondo-contemporaneo + guerra-fredda (tech tree edit + i18n + initial state per i 5 stati nuke) | 2 g | 1 g |
| Content: 7 milestone space in 3 scenari + i18n | 1 g | 0.5 g |
| Content: era definitions per mondo-contemporaneo + guerra-fredda | 1 g | 0.5 g |
| Content: ~20 eventi narrativi nuovi (nuclear winter chain, era transitions, achievement-related) | 3 g | 2 g |
| i18n: ~150 chiavi nuove IT+EN | 1.5 g | 1 g |
| Bilanciamento: deterrenza non rotta (AI non lancia troppo facilmente, etc) | 2 g | 1 g |
| E2E test: nuclear flow (build → deter → tactical strike → reputation crash) + achievement unlock | 2 g | 1 g |
| **Wave 10 totale** | **~32 g** | **~20 g** |

~6-7 settimane realistic.

### Wave 11 — Replay + polish

| Componente | Realistic | Optimistic |
|---|---:|---:|
| Engine: actionLog instrumentation di applyAction | 1 g | 0.5 g |
| Engine: replay/reconstructState (snapshot per N tick + replay accelerated) | 3 g | 2 g |
| Web: pagina /replay/[saveId] + PlaybackControls | 3 g | 2 g |
| Web: polish tutti i pannelli (animazioni, transizioni, micro-interaction) | 3 g | 1.5 g |
| Bug fixes raccolti durante Wave 9-10 | 2 g | 1 g |
| **Wave 11 totale** | **~12 g** | **~7 g** |

~2-3 settimane.

### Wave 12 — Mod system + cleanup finale

| Componente | Realistic | Optimistic |
|---|---:|---:|
| Web: ModDropZone + lib/modValidator (DOS hardening) + IndexedDB store | 4 g | 2.5 g |
| Web: pagina /mods + remove flow | 1.5 g | 1 g |
| Documentazione utente: come scrivere uno scenario JSON (markdown publico) | 2 g | 1 g |
| Cleanup tecnico: refactoring nice-to-have, dead code removal, dependency upgrade | 2 g | 1 g |
| **Wave 12 totale** | **~10 g** | **~5.5 g** |

~2 settimane.

### Totale Fase 3

| Wave | Realistic | Optimistic |
|---|---:|---:|
| Wave 9 | 36 g | 22 g |
| Wave 10 | 32 g | 20 g |
| Wave 11 | 12 g | 7 g |
| Wave 12 | 10 g | 5.5 g |
| **Totale** | **~90 g** | **~55 g** |

~18 settimane realistic, ~11 ottimistico. La Fase 3 è ~3× la Fase 2 in scope. Le Wave 9 e 10 sono il grosso (sistemi core); Wave 11-12 sono shipping incrementali.

**Rischio principale**: il bilanciamento dei nuovi sistemi (reputation, nuclear deterrence, dethrone-loss tightness) può richiedere iterazioni multiple. Mitigation: ogni Wave include 1-2 giorni dedicati di sim distribuzionale specifica per i nuovi sistemi.

---

## Sensitivity considerations (estensione Fase 2)

La Fase 3 introduce armi nucleari, condanne ONU, conflitti di blocco. Le regole sensitivity di Fase 2 restano in vigore + queste aggiunte:

1. **Strike nucleari**: i wording dei modal di conferma e degli eventi post-strike sono volutamente *gravi* — descrivono "città devastate", "milioni di vittime stimati", "inverno nucleare". Niente humour, niente understatement. La doppia conferma + timer di 3 secondi è anche un signal: *questo è un atto serio nel gioco*.
2. **Niente immagini fotorealistiche** di funghi atomici, città distrutte, vittime. Le icone restano simboliche (radioactivity icon, mappa con regione "scure"). Stile resta astratto come Fase 2.
3. **MAD wording**: "Mutual Assured Destruction" è terminologia tecnica da letteratura strategica, ok in inglese. In italiano usiamo "Distruzione Reciproca Garantita" + acronimo MAD fra parentesi. NON "olocausto nucleare" (carico storico).
4. **Risoluzioni ONU su humanitarian / refugee**: il wording resta archetipico ("popolazione colpita da disastro naturale", "rifugiati causati da conflitto regionale"), mai ancorato a eventi reali specifici (sirian war, ukraine, rohingya, ecc.).
5. **Achievement "scorched_earth" e "mutually_assured"**: marcati `secret: true`. Il giocatore non li vede nella lista finché non li sblocca. Questo evita di promuovere implicitamente il comportamento ("oh, c'è un achievement per il nuke, devo provarlo").
6. **Bloc names**: nomi generici ("Western Alliance", "Eastern Alliance", "Non-Aligned Movement"). Niente "NATO" o "BRICS" come nomi visibili (il pitch può menzionarli per chiarezza interna, lo scenario JSON usa i nomi generici).
7. **Disclaimer wizard**: il disclaimer Fase 2 viene esteso con una riga in più per `mondo-contemporaneo` e `guerra-fredda`:
   > *"Questo scenario include meccaniche di guerra nucleare. Le scelte sono romanzate; nessuna delle dinamiche di gioco rappresenta dottrine reali o predizioni di eventi."*
8. **Review manuale degli eventi nuclear-related**: ogni evento del chain "Nuclear Winter" deve essere riletto da almeno un secondo paio di occhi prima del merge — convenzione, da scrivere nel CONTRIBUTING aggiornato.

---

## Open questions

Domande reali sui cui il maintainer deve decidere prima dell'implementazione, o che potrebbero ridefinire scope.

1. **Visibilità della bloc membership**: quando una nazione AI cambia blocco, il giocatore lo vede sempre o solo se ha intel sufficiente (`>= 'rumors'`) su quella nazione? *Default proposto*: sempre visibile per Fase 3 (è una conseguenza geopolitica diffusa, non un segreto). Gating per intel è un'estensione possibile in Fase 4.

2. **Trigger di risoluzioni ONU**: vengono triggerate solo da regole hardcoded (war dichiarata → peacekeeping; nuke → condemnation; periodico → climate) o anche da azioni del giocatore meno gravi (es. signing trade deal triggera humanitarian aid)? *Default proposto*: solo trigger hardcoded + proposte volontarie via `proposeUNResolution`. Trigger sottili rendono il sistema imprevedibile per il giocatore e difficile da bilanciare.

3. **Era-paced — un set di ere globale o per scenario?** *Default proposto*: per scenario (definite nel JSON come `eras?: Era[]`). Più lavoro di authoring ma rispetta l'identità di ogni scenario. Quick-start non ha eras.

4. **Disarmo nucleare volontario**: è permesso? L'azione `dismantleNuclear` rende il sistema più ricco (puoi guadagnare reputazione tornando indietro), ma complica la narrativa. *Default proposto*: sì, ma SOLO se è in vigore un trattato `nonProliferation` ONU. Senza trattato il dismantling è permesso ma rep boost dimezzato. Achievement `disarmer` per chi lo fa.

5. **Achievement: cosmetici o sbloccano contenuto?** Sbloccare scenari/difficoltà come reward è motivante, ma crea un'asimmetria fra player nuovi e vecchi (e non si può "perdere" il progresso senza scaring). *Default proposto*: puramente cosmetici per Fase 3. Sblocco di contenuto come opzione per Fase 4 (gated dietro setting "Progression mode").

6. **Eternal mode — milestone screen quando soddisfi una win condition**: si ferma il loop come un evento (modal), oppure è un toast non-bloccante? *Default proposto*: toast non-bloccante con suono opzionale. Il giocatore in Eternal vuole continuare; un modal interrompe il flow. Una eccezione: la *prima* milestone della partita apre un modal "celebrativo" che spiega "Hai ottenuto la prima vittoria! Continua a giocare, le altre saranno toast."

7. **Dethrone-loss — trigger secondario "isolamento"**: attivo di default o opt-in scenario-by-scenario? *Default proposto*: attivo di default per `mondo-contemporaneo` e `guerra-fredda` (dove i blocchi contano molto), disattivo per `ascesa-aurion`.

8. **AI proposal di risoluzioni ONU**: l'AI propone risoluzioni autonomamente? Quanto frequentemente? *Default proposto*: sì, ogni AI permanente con political capital >= 50 ha 5% chance/tick di proporre una risoluzione coerente con i suoi interessi. Bilanciamento da tunare in Wave 9.

9. **Recording replay — opt-in o default**: registrare l'actionLog ha overhead trascurabile ma occupa qualche KB/save. *Default proposto*: opt-in tramite setting in home (`Meta.recordReplays`), default `true`. Toggle visibile nelle impostazioni.

10. **Mod system — sandboxing**: in Fase 3 (deferred Wave 12) i mod sono solo dati. Va bene così? *Default proposto*: sì, niente eval mai. Se in futuro si vogliono "rule mod" (modificare la logica), si farà tramite un DSL strict (es. JsonLogic), non tramite eval di JS arbitrario.

11. **Visualizzazione delle vittorie multiple in Eternal**: il giocatore raggiunge `economic` poi `scientific` poi `military` — l'HUD mostra "3/5 vittorie" come un counter, o ogni vittoria è solo loggata? *Default proposto*: counter visibile in HUD a destra dei badge reputazione. Crea senso di progresso visibile.

12. **Nuclear strike — può l'AI lanciare contro il giocatore?** *Default proposto*: sì, ma solo se: AI ha `nuclearArsenal.warheadCount >= 1`, è stata pesantemente provocata (war attiva da > 50 tick OR ha subito uno strike), aggressiveness > 0.7. Soglie alte per evitare nuke gratuiti. La sim deve verificare che la frequenza di nuke AI-iniziati sia < 5% delle partite a Hard.

13. **Compatibilità scenari Fase 1+2 con Fase 3**: il quick-start non usa la Fase 3. Vogliamo che il giocatore abbia un'opzione "modalità Phase 2" per gli altri scenari (cioè giocare `mondo-contemporaneo` SENZA i sistemi Fase 3)? *Default proposto*: no. La Fase 3 è on-by-default per gli scenari che la supportano. Aggiungere un toggle "modalità classica" complica il wizard senza vero beneficio.

---

## Verification (quando Fase 3 è "done")

Considero la Fase 3 "fatta" quando tutti questi check passano. Liste lunghe perché i sistemi sono nove.

### Engine

1. **`pnpm typecheck` / `pnpm lint` / `pnpm test`** verdi. Nessun warning sui nuovi tipi.
2. **Coverage ≥ 80%** sui nuovi reducer/tick step (reputation, UN, blocs, nuclear, achievement).
3. **Determinismo**: stesso seed + stesse azioni (incluse azioni Fase 3 come `voteUNResolution`, `launchTacticalNuclear`) → hash stato finale identico.
4. **Property-based**: `applyAction` resta puro; le delta reputazione sommano correttamente; il `worldTension` non eccede mai 100; il `warheadCount` non va mai sotto 0.
5. **Migration v1→v2→v3**: un save Fase 1 carica in Fase 3 senza errori, applica defaults corretti, gioca normalmente per 50 tick senza glitch.

### Sim distribuzionale

6. **Reputation distribution**: su 200 partite a `mondo-contemporaneo` Normal, il giocatore termina la partita con reputazione media non degenerata (no -100 universale, no +100 universale).
7. **UN resolution frequency**: in 200 partite, almeno 5 risoluzioni passano per partita (in media), non più di 30. Distribuzione per kind ragionevole (no "100% sanctions").
8. **Bloc transitions**: in 200 partite a `mondo-contemporaneo`, almeno 1 transizione AI-driven di blocco per partita. Niente cycle-spam (transizioni A→B→A→B nello stesso blocco di 50 tick).
9. **Nuclear gameplay**: in 200 partite a `guerra-fredda` Hard, l'AI lancia uno strike unilaterale in < 5% dei casi e MAD in < 1%. Quando MAD si verifica, le metriche post-strike (popolarità, treasury, ecc.) sono nei range definiti dallo spec.
10. **Game mode distribution**: per ognuno dei tre `gameMode`, la sim conferma:
    - Eternal: nessuna partita finisce per win condition; tutte finiscono solo per loss condition (o timeout simulazione).
    - Dethrone-loss: % di partite che terminano per dethrone-loss in 5-15% range (pressione vera ma non oppressiva).
    - Era-paced: tutte le partite raggiungono almeno 1 era transition.

### Manual smoke (golden paths per nuova identità)

11. **Path "Guerra"** (manuale, ~1 ora): scegli `mondo-contemporaneo` Hard, gioca aggressivamente — dichiara guerre multiple, attacca alleati Western. Verifica:
    - Reputation Western crolla sotto −50.
    - ONU triggera condemnation contro di te entro 30 tick.
    - Almeno 3 nazioni AI dichiarano contro-guerra.
    - Achievement `isolated_one` sblocca se reach −80 in 2 blocchi.

12. **Path "Diplomazia"** (manuale, ~1 ora): scegli `mondo-contemporaneo` Normal, gioca pacificamente — alleanze, voti UN coordinati, niente guerre. Verifica:
    - Reputation Western e Non-Aligned salgono sopra +30.
    - Entri in Western Alliance dopo ~50 tick.
    - Riesci a far passare almeno 1 risoluzione ONU.
    - Achievement `world_friend` sblocca se reach +50 in 3 blocchi.

13. **Path "Spazio"** (manuale, ~1 ora): scegli `guerra-fredda` Normal, focalizza ricerca su space tech. Verifica:
    - Sei il primo a raggiungere `tech_space_first_satellite` (la gara è triple — USA-stand-in, USSR-stand-in, tu) → +5 universale rep.
    - Achievement `first_satellite` sblocca.
    - Sblocca `moon_landing` per primo o secondo. La prestige scala correttamente.

14. **Path "Nukes"** (manuale, ~30 min): in qualsiasi scenario con nukes attivi, costruisci arsenal, lancia tactical strike. Verifica:
    - Doppia conferma funziona (timer 3s, scrittura "LANCIO").
    - Effetti applicati correttamente (army distrutta, popularity host nazione −30).
    - Reputation crolla a −50 universale.
    - Condemnation ONU triggerata automaticamente.
    - Achievement `scorched_earth` sblocca (e non visibile prima).

15. **Path "Endless"** (manuale, ~2 ore): scegli `mondo-contemporaneo` Eternal Normal, gioca a lungo. Verifica:
    - Vinci una win condition → toast, partita continua.
    - `cumulativeStats.peakGdpRank` aggiorna correttamente.
    - Achievement `eternal_player` sblocca a 1000 tick.
    - Salvataggio/reload preserva tutto.

### E2E (Playwright)

16. **`bloc-join.spec.ts`**: nuova partita → applyToJoinBloc western → tick avanzano → entri nel blocco → reputation badge mostra +10 western.
17. **`un-vote-flow.spec.ts`**: nuova partita → wait risoluzione (cheat helper triggers one) → click "Vota" → modal aperto → "Yes" → tick avanza → risultato applicato.
18. **`nuclear-launch.spec.ts`**: cheat helper sblocca arsenale → click "Lancia atomica" → modal 1 → wait 3s → continua → modal 2 → digita LANCIO → strike applicato → state corretto.
19. **`achievement-unlock.spec.ts`**: nuova partita → triggera condition (es. completa una tech via cheat) → achievement toast appare → check meta.achievements update.
20. **`game-mode-pick.spec.ts`**: wizard → step 5 → seleziona Eternal → conferma → state.gameMode === 'eternal'.

### Sensitivity

21. **Disclaimer wizard esteso** appare per `mondo-contemporaneo` e `guerra-fredda` con la riga "meccaniche di guerra nucleare", dismissibile.
22. **Achievement secret** (`scorched_earth`, `mutually_assured`) NON visibili nella `/trofei` page se non sbloccati (silhouette `???`).
23. **Review manuale eventi nuclear chain**: ogni evento del "Nuclear Winter chain" letto e approvato dal maintainer. Wording grave, niente trivializzazione.

### Scope respect

24. **Nessun file fuori dalla lista "Architecture changes" toccato.** Lo SPEC.md di Fase 1 e SPEC-PHASE-2.md di Fase 2 invariati.
25. **Nessuna feature deferred (Replay full UI, Mod system) implementata in Wave 9-10.** L'unica preparazione consentita: il campo `actionLog?` in GameState e la sua popolazione opzionale.
26. **i18n completezza**: nessuna chiave `rep.*`, `un.*`, `bloc.*`, `nuclear.*`, `mode.*`, `space.*`, `achievement.*` mancante in IT o EN (validator script lo verifica).

---

> Spec scritto contro lo stato del repo a `ee78a80 feat(wave7): Mondo Contemporaneo, Iron Man, Tutorial, sim balance`. Se l'engine evolve fra spec e implementazione, prevalgono i tipi reali in `packages/engine/src/types.ts`.
> Reference: la User Story originale del maintainer per la Fase 3 è "diventare *e mantenere* lo status di superpotenza, no quick end. Decisioni impattano: guerra / nucleare / ricerca + spionaggio (costa reputazione), o alleanze NATO-vs-counter-blocs. Programmi spaziali come power projection. ONU. Opinione pubblica." Lo spec è una decomposizione strutturata di questa visione in nove sistemi tipizzati e implementabili wave per wave.

---

## Decisioni risolte (post-Wave 8)

Le 13 open questions sopra sono state risolte dal maintainer. Le risposte qui elencate sono **vincolanti** per Wave 9-12.

| # | Domanda | Decisione | Impatto |
|---|---|---|---|
| 1 | Visibilità bloc membership | **Sempre visibile** | Notifica nello stream + overlay alleanze aggiornato in tempo reale. No intel gating. |
| 2 | Trigger risoluzioni ONU | **Hardcoded + trigger sottili contestuali** *(non-default)* | Più ricco emergentemente: `signTradeDeal` con paese povero può triggerare humanitarian aid; tensione alta → climate accord. Wave 9 deve mappare ~10 azioni → trigger ONU possibili e bilanciare la frequenza. |
| 3 | Era-paced — set globale o per scenario | **Per scenario, definite nel JSON** | Aggiungere campo `eras?: Era[]` a `Scenario`. Quick-start e Aurion senza ere; Mondo Contemporaneo + Guerra Fredda ne dichiarano. Più authoring ma rispetta identità. |
| 4 | Disarmo nucleare volontario | **Sì, ma rep boost pieno solo con trattato ONU non-proliferation in vigore** | Senza trattato: dismantling permesso, rep boost dimezzato. Con trattato: pieno (+30 tutti i blocchi). Achievement `disarmer`. Spinge il giocatore a partecipare al trattato ONU prima di disarmare. |
| 5 | Achievement reward | **Puramente cosmetici per Fase 3** | Niente sblocco contenuto. Niente asimmetria nuovi/veterani. Sblocco contenuto come opzione futura (Fase 4) gated dietro setting "Progression mode". |
| 6 | Eternal — milestone screen | **Toast non-bloccante con suono opzionale** | Eccezione: la **prima** vittoria della partita apre un modal celebrativo che spiega "Continua a giocare, le altre saranno toast". Le successive sono toast in basso a destra. |
| 7 | Dethrone-loss — trigger isolamento | **Default-on per scenari con blocchi** (Mondo Contemporaneo + Guerra Fredda) | Ascesa di Aurion (mondo fittizio senza blocchi) e Quick-start non lo applicano. Non c'è opzione user-controllata: il trigger è dichiarato a livello scenario. |
| 8 | AI proposal frequenza ONU | **5%/tick se political capital >= 50** | ~1 risoluzione AI ogni 20 tick. Tunabile per difficoltà nel modifier `eventChanceMultiplier` (Hard amplifica). |
| 9 | Replay opt-in | **Default-on, switchabile in Settings** | Ogni partita registra l'action log da Wave 9 in poi. Settings global toggle "Registra replay". Quando Wave 11 atterra, le partite esistenti hanno il log pronto. |
| 10 | Mod system sandboxing | **Solo dati JSON, niente eval mai** | Wave 12: `.json` import → validator → load. Niente DSL per logica in Fase 3. Eventuale rule-modding via DSL (JsonLogic) come opzione Fase 4. |
| 11 | Visualizzazione vittorie multiple Eternal | **Counter HUD '3/5 vittorie'** | Posizione: a destra dei badge reputazione. Click apre lista dettagliata (quale vittoria, quando). Indicatore di progresso visibile. |
| 12 | AI può lanciare nukes contro player | **Sì, ma solo con soglie alte** | Soglie: warhead >= 1, war attiva da > 50 tick OR ha già subito uno strike, aggressiveness > 0.7. Sim deve verificare frequenza nuke AI-iniziati < 5% partite a Hard. |
| 13 | Toggle "modalità Phase 2" | **On-by-default, niente toggle** | Phase 3 è il modo "normale" di giocare gli scenari che la supportano (Mondo Contemporaneo, Guerra Fredda). Quick-start rimane senza Phase 3 (è corto). Niente complicazioni nel wizard. |

### Note di implementazione derivate

- **Q2** è la decisione più impattante per Wave 9. Il "trigger sottile contestuale" non è il default proposto — richiede una mappa esplicita azione→trigger nello scenario. Suggerimento: aggiungere a ogni `Scenario` un campo `unTriggerMap?: Record<ActionTriggerKey, UNResolutionTemplate>` per personalizzare per scenario, con un default in engine se non dichiarato. Bilanciare la frequenza con `eventChanceMultiplier`.
- **Q7** vincola lo schema scenario: aggiungere `dethroneIsolationOnByDefault?: boolean` (default false) — Mondo Contemporaneo e Guerra Fredda settano `true`. Wizard mostra una nota informativa quando il giocatore sceglie Dethrone su uno di questi scenari.
- **Q11** richiede una nuova selettrice `selectVictoryProgress(state, scenario): { unlocked: VictoryConditionId[], total: number }` che alimenta il counter HUD. Aggiungere `state.unlockedVictories: VictoryConditionId[]` al GameState (additivo, retrocompat).
- **Q12** richiede di estendere l'AI scoring per `launchNuclear*` con soglie esplicite (vedi sistema 4 per i gating). Aggiungere test sim: 200 partite Hard, conteggio nuke AI-iniziati < 10.
