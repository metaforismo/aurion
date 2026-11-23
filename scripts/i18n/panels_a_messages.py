"""Economy / Research / Internal politics panel copy.

Run: python3 scripts/i18n/panels_a_messages.py
"""

ENTRIES = []


def add(path, it, en):
    ENTRIES.append((path, it, en))


# ---------------------------------------------------------------------------
# Economy
# ---------------------------------------------------------------------------
E = "panelEconomy."
add(E + "perWeek", "a settimana", "per week")
add(E + "hero.treasury", "Tesoreria", "Treasury")
add(E + "hero.gdp", "PIL", "GDP")
add(E + "hero.rank", "Nel mondo", "World rank")
add(E + "hero.rankValue", "{rank}º su {total}", "#{rank} of {total}")
add(E + "hero.taxRate", "Aliquota", "Tax rate")

add(E + "trend.collecting",
    "Il grafico delle entrate si disegna da solo, settimana dopo settimana: fai scorrere il tempo.",
    "The income chart draws itself week by week: let time run.")
add(E + "trend.aria",
    "Entrate delle ultime {weeks} settimane: da {from} a {to}",
    "Income over the last {weeks} weeks: from {from} to {to}")
add(E + "trend.span",
    "Entrate · {weeks} sett.",
    "Income · {weeks} wk")
add(E + "trend.range", "{min} – {max}", "{min} – {max}")
add(E + "trend.flat", "stabili", "steady")

add(E + "warning.inTheRed",
    "La cassa è in rosso da {weeks, plural, =0 {questa settimana} =1 {una settimana} other {# settimane}}. "
    "Dopo {limit} settimane di fila sotto zero il governo cade: te ne {left, plural, =1 {resta una} other {restano #}}. "
    "Finché resti in rosso perdi anche mezzo punto di popolarità a settimana.",
    "The treasury has been in the red {weeks, plural, =0 {since this week} =1 {for one week} other {for # weeks}}. "
    "After {limit} straight weeks below zero the government falls: you have {left, plural, =1 {one left} other {# left}}. "
    "While you stay in the red you also lose half a popularity point a week.")
add(E + "warning.runway",
    "Stai spendendo più di quanto incassi: a questo ritmo la cassa si svuota in "
    "{weeks, plural, =0 {meno di una settimana} =1 {una settimana} other {# settimane}}. "
    "Con {limit} settimane di fila sotto zero la partita è persa.",
    "You are spending more than you earn: at this pace the treasury runs dry in "
    "{weeks, plural, =0 {under a week} =1 {one week} other {# weeks}}. "
    "{limit} straight weeks below zero and the game is lost.")

add(E + "sources.title", "Da dove arrivano i soldi", "Where the money comes from")
add(E + "sources.tax", "Gettito fiscale", "Tax take")
add(E + "sources.taxHint", "Il {rate}% del PIL, diviso per 52 settimane", "{rate}% of GDP, spread over 52 weeks")
add(E + "sources.sectors", "Servizi e tecnologia", "Services and tech")
add(E + "sources.sectorsHint", "Rendono di più al fisco: +{pct} sul gettito", "They pay more tax: +{pct} on the take")
add(E + "sources.trade",
    "{n, plural, =1 {Un accordo commerciale} other {# accordi commerciali}}",
    "{n, plural, =1 {One trade deal} other {# trade deals}}")
add(E + "sources.tradeHint", "+{pct} di entrate ciascuno", "+{pct} income each")
add(E + "sources.sanctions",
    "{n, plural, =1 {Una sanzione in corso} other {# sanzioni in corso}}",
    "{n, plural, =1 {One sanction in force} other {# sanctions in force}}")
add(E + "sources.sanctionsHint", "−{pct} di entrate ciascuna", "−{pct} income each")
add(E + "sources.wars",
    "{n, plural, =1 {Una guerra in corso} other {# guerre in corso}}",
    "{n, plural, =1 {One war under way} other {# wars under way}}")
add(E + "sources.warsHint",
    "Ogni guerra costa € 50 a settimana per unità dell’esercito",
    "Each war costs € 50 a week per army unit")
add(E + "sources.difficulty", "Livello di difficoltà", "Difficulty level")
add(E + "sources.difficultyHint", "Correzione sulle tue entrate", "Adjustment to your income")
add(E + "sources.policies", "Politiche nazionali", "National policies")
add(E + "sources.policiesHint", "Bonus e costi di quelle in vigore", "Bonuses and upkeep of those in force")
add(E + "sources.net", "In cassa ogni settimana", "Into the treasury each week")
add(E + "sources.noTrade",
    "Nessun accordo commerciale: ognuno aggiunge il {pct} alle entrate.",
    "No trade deals yet: each one adds {pct} to your income.")
add(E + "sources.openDiplomacy", "Apri Diplomazia", "Open Diplomacy")

add(E + "tax.title", "Politica fiscale", "Tax policy")
add(E + "tax.label", "Aliquota fiscale", "Tax rate")
add(E + "tax.inForce", "in vigore: {rate}%", "in force: {rate}%")
add(E + "tax.incomeChange", "Entrate", "Income")
add(E + "tax.perWeek", "a settimana", "per week")
add(E + "tax.reactions", "Come la prendono le fazioni (punti di soddisfazione)",
    "How the factions take it (satisfaction points)")
add(E + "tax.apply", "Applica il {rate}%", "Apply {rate}%")
add(E + "tax.reset", "Annulla", "Reset")
add(E + "tax.tradeOff",
    "Più tasse, più entrate. Ma ogni punto in più toglie 0,4 punti di soddisfazione alle Imprese e ne dà 0,3 ai "
    "Populisti e 0,1 ai Riformisti; Militari e Clero lo sentono appena. E la popolarità segue le fazioni. "
    "Sposta il cursore per vedere il conto.",
    "More tax, more income. But each extra point costs Business 0.4 satisfaction and gives Populists 0.3 and "
    "Reformists 0.1; Military and Clergy barely notice. And popularity follows the factions. "
    "Move the slider to see the bill.")
add(E + "tax.applied", "Aliquota portata al {rate}%.", "Tax rate set to {rate}%.")

add(E + "invest.title", "Investimenti", "Investments")
add(E + "invest.intro",
    "Si paga subito, una volta sola. L’effetto resta.",
    "You pay once, up front. The effect stays.")
add(E + "invest.targetLabel", "Dove investire", "Where to invest")
add(E + "invest.target.economy.name", "Economia", "Economy")
add(E + "invest.target.infra.name", "Infrastrutture", "Infrastructure")
add(E + "invest.target.research.name", "Ricerca", "Research")
add(E + "invest.target.military.name", "Esercito", "Army")
add(E + "invest.target.military.rate", "Una nuova unità ogni € 100.000", "One new unit per € 100,000")
add(E + "invest.target.intel.name", "Intelligence", "Intelligence")
add(E + "invest.target.intel.rate", "Una spia ogni € 50 Mln, più controspionaggio",
    "One spy per € 50M, plus counter-intelligence")
add(E + "invest.amountLabel", "Quanto investire", "How much")
add(E + "invest.custom", "Altro", "Custom")
add(E + "invest.customLabel", "Importo in milioni di euro", "Amount in millions of euros")
add(E + "invest.customPlaceholder", "es. 250", "e.g. 250")
add(E + "invest.blocked.empty", "La cassa è vuota: non c’è nulla da investire.",
    "The treasury is empty: there is nothing to invest.")
add(E + "invest.blocked.enter", "Scrivi l’importo, in milioni di euro.", "Type the amount, in millions of euros.")
add(E + "invest.blocked.invalid", "L’importo deve essere un numero maggiore di zero.",
    "The amount must be a number above zero.")
add(E + "invest.blocked.tooMuch", "È più di quanto hai in cassa ({treasury}).",
    "That is more than you have in the treasury ({treasury}).")
add(E + "invest.blocked.noUnit", "Troppo poco: una unità costa {cost}.", "Too little: one unit costs {cost}.")
add(E + "invest.preview.title", "Cosa ottieni", "What you get")
add(E + "invest.preview.gdp", "PIL da {from} a {to}", "GDP from {from} to {to}")
add(E + "invest.preview.income",
    "Entrate {gain} a settimana: si ripaga in {weeks, plural, =1 {una settimana} other {# settimane}}",
    "Income {gain} a week: pays for itself in {weeks, plural, =1 {one week} other {# weeks}}")
add(E + "invest.preview.incomeNone", "Nessun aumento delle entrate con l’aliquota attuale",
    "No income gain at the current tax rate")
add(E + "invest.preview.popularity", "Popolarità +{points} subito", "Popularity +{points} right away")
add(E + "invest.preview.research", "Ricerca da {from} a {to} punti a settimana, per sempre",
    "Research from {from} to {to} points a week, for good")
add(E + "invest.preview.military", "+{units} unità: l’esercito sale a {total}",
    "+{units} units: the army grows to {total}")
add(E + "invest.preview.spies",
    "{n, plural, =0 {Nessuna nuova spia (ne servono € 50 Mln l’una)} =1 {Una nuova spia: in tutto {total}} other {# nuove spie: in tutto {total}}}",
    "{n, plural, =0 {No new spy (they cost € 50M each)} =1 {One new spy: {total} in all} other {# new spies: {total} in all}}")
add(E + "invest.preview.counterIntel", "Controspionaggio dal {from} al {to}",
    "Counter-intelligence from {from} to {to}")
add(E + "invest.preview.treasuryAfter", "Ti restano {value} in cassa", "You keep {value} in the treasury")
add(E + "invest.confirm", "Investi {amount} in {target}", "Invest {amount} in {target}")
add(E + "invest.confirmIdle", "Investi", "Invest")
add(E + "invest.done", "Fatto: {amount} investiti in {target}.", "Done: {amount} invested in {target}.")

add(E + "sectors.title", "Di cosa vive il paese", "What the country lives on")
add(E + "sectors.agriculture", "Agricoltura", "Agriculture")
add(E + "sectors.industry", "Industria", "Industry")
add(E + "sectors.services", "Servizi", "Services")
add(E + "sectors.tech", "Tecnologia", "Technology")
add(E + "sectors.note",
    "Ogni 10 punti di Servizi alzano il gettito del {services}%, ogni 10 di Tecnologia del {tech}%. "
    "Agricoltura e Industria fanno PIL, ma non rendono di più al fisco.",
    "Every 10 points of Services lift the tax take by {services}%, every 10 of Technology by {tech}%. "
    "Agriculture and Industry make GDP but pay no extra tax.")

add(E + "mega.title", "Grandi progetti", "Megaprojects")
add(E + "mega.building",
    "{n, plural, =0 {Nessun cantiere aperto} =1 {Un cantiere aperto} other {# cantieri aperti}}",
    "{n, plural, =0 {Nothing under construction} =1 {One project under construction} other {# projects under construction}}")
add(E + "mega.next", "Puoi avviare: {name} · {price}", "Ready to start: {name} · {price}")
add(E + "mega.none", "Niente da avviare adesso: guarda cosa manca nel Cosmo",
    "Nothing to start right now: see what is missing in Cosmos")

add(E + "errors.invest.invalidAmount", "L’importo da investire non è valido.", "That is not a valid amount to invest.")
add(E + "errors.invest.insufficientTreasury", "Non hai abbastanza in tesoreria per questo investimento.",
    "The treasury cannot cover this investment.")
add(E + "errors.tax.outOfRange", "L’aliquota deve stare tra 0 e 100%.", "The tax rate must be between 0 and 100%.")
add(E + "errors.country.notFound", "Il tuo paese non è più in gioco.", "Your country is no longer in play.")

# ---------------------------------------------------------------------------
# Research
# ---------------------------------------------------------------------------
R = "panelResearch."
add(R + "hero.active", "In ricerca", "Researching")
add(R + "hero.idle", "Laboratori fermi", "Labs are idle")
add(R + "hero.idleHint",
    "I punti ricerca di questa settimana andranno persi finché non scegli cosa studiare.",
    "This week’s research points are wasted until you pick something to study.")
add(R + "hero.weeksUnit",
    "{weeks, plural, =0 {pronta questa settimana} =1 {settimana alla scoperta} other {settimane alla scoperta}}",
    "{weeks, plural, =0 {ready this week} =1 {week to discovery} other {weeks to discovery}}")
add(R + "hero.neverUnit", "ricerca ferma: la produzione è zero", "stalled: research output is zero")
add(R + "hero.thenTry", "Poi conviene: {name}", "Good next pick: {name}")
add(R + "hero.allDone", "Hai scoperto tutto", "You have discovered everything")
add(R + "hero.allDoneHint",
    "L’albero di questo scenario è completo. La scienza ora si fa con i grandi progetti.",
    "This scenario’s tree is complete. From here, science means megaprojects.")

add(R + "branch.civil", "Civile", "Civil")
add(R + "branch.military", "Militare", "Military")
add(R + "branch.intelligence", "Intelligence", "Intel")
add(R + "branch.space", "Spazio", "Space")
add(R + "branchHint.civil", "Economia, società e consenso.", "Economy, society and consent.")
add(R + "branchHint.military", "Dottrina e forze armate.", "Doctrine and the armed forces.")
add(R + "branchHint.intelligence", "Spie, operazioni coperte e controspionaggio.",
    "Spies, covert operations and counter-intelligence.")
add(R + "branchHint.space", "La strada per l’orbita, la Luna e Marte.", "The road to orbit, the Moon and Mars.")

add(R + "recommended.label", "Consigliata", "Recommended")
add(R + "recommended.chip", "Consigliata", "Recommended")
add(R + "recommended.reason",
    "{weeks, plural, =1 {Una settimana} other {# settimane}} di lavoro"
    "{opens, plural, =0 {} =1 {, e apre la strada a un’altra tecnologia} other {, e apre la strada ad altre # tecnologie}}.",
    "{weeks, plural, =1 {One week} other {# weeks}} of work"
    "{opens, plural, =0 {} =1 {, and it opens the way to one more technology} other {, and it opens the way to # more technologies}}.")
add(R + "recommended.reasonNoOutput",
    "{opens, plural, =0 {La più economica disponibile.} =1 {Apre la strada a un’altra tecnologia.} other {Apre la strada ad altre # tecnologie.}}",
    "{opens, plural, =0 {The cheapest one available.} =1 {It opens the way to one more technology.} other {It opens the way to # more technologies.}}")

add(R + "start", "Avvia la ricerca", "Start research")
add(R + "startNamed", "Avvia la ricerca · {points} punti", "Start research · {points} points")
add(R + "startCost",
    "{points} punti: circa {weeks, plural, =1 {una settimana} other {# settimane}} a {output} punti a settimana",
    "{points} points: about {weeks, plural, =1 {one week} other {# weeks}} at {output} points a week")
add(R + "startCostNoOutput", "{points} punti. Oggi non ne produci: non avanzerà.",
    "{points} points. You produce none today: it will not advance.")
add(R + "started", "Ricerca avviata: {name}.", "Research started: {name}.")

add(R + "stats.output", "Produzione", "Output")
add(R + "stats.outputValue", "{n} punti/sett.", "{n} points/wk")
add(R + "stats.done", "Scoperte", "Discovered")
add(R + "rules",
    "Una ricerca alla volta, senza coda: una volta avviata non si interrompe, e la successiva la scegli quando finisce.",
    "One project at a time, no queue: once started it cannot be stopped, and you pick the next when it is done.")
add(R + "rulesNoOutput",
    "Non produci punti ricerca: investi in Ricerca dal pannello Economia per rimettere in moto i laboratori.",
    "You produce no research points: invest in Research from the Economy panel to get the labs moving.")

add(R + "tree.title", "Albero tecnologico", "Tech tree")
add(R + "tree.count", "{done}/{total} nel ramo", "{done}/{total} in branch")
add(R + "tree.branchLabel", "Ramo dell’albero", "Tree branch")
add(R + "tree.empty", "Questo scenario non ha tecnologie in questo ramo.",
    "This scenario has no technologies in this branch.")
add(R + "tree.tier", "Livello {n}", "Tier {n}")

add(R + "row.done", "Scoperta", "Discovered")
add(R + "row.researching", "In ricerca · {pct}%", "Researching · {pct}%")
add(R + "row.locked", "Richiede {list}", "Needs {list}")
add(R + "row.cost", "{points} punti", "{points} points")
add(R + "row.costWeeks",
    "{points} punti · {weeks, plural, =1 {1 settimana} other {# settimane}}",
    "{points} points · {weeks, plural, =1 {1 week} other {# weeks}}")
add(R + "status.done", "Scoperta", "Discovered")
add(R + "status.researching", "In ricerca", "Researching")
add(R + "status.available", "Disponibile", "Available")
add(R + "status.locked", "Bloccata", "Locked")

add(R + "detail.effects", "Cosa porta", "What it brings")
add(R + "detail.requires", "Richiede", "Requires")
add(R + "detail.leadsTo", "Apre la strada a", "Leads to")
add(R + "detail.progress", "Avanzamento", "Progress")
add(R + "points", "{done} / {total} punti", "{done} / {total} points")
add(R + "eta.weeks",
    "{weeks, plural, =0 {Pronta questa settimana.} =1 {Pronta tra una settimana.} other {Pronta tra # settimane.}}",
    "{weeks, plural, =0 {Ready this week.} =1 {Ready in one week.} other {Ready in # weeks.}}")
add(R + "eta.never", "Ferma: non produci punti ricerca.", "Stalled: you produce no research points.")
add(R + "blocked.busy", "I laboratori sono impegnati con {name}. Potrai avviarla quando avranno finito.",
    "The labs are busy with {name}. You can start this once they are done.")
add(R + "blocked.busyWeeks",
    "I laboratori sono impegnati con {name}: potrai avviarla tra {weeks, plural, =0 {pochi giorni} =1 {una settimana} other {# settimane}}.",
    "The labs are busy with {name}: you can start this in {weeks, plural, =0 {a few days} =1 {one week} other {# weeks}}.")
add(R + "blocked.locked", "Prima devi scoprire: {list}.", "Discover this first: {list}.")

add(R + "milestone.badge", "Primato mondiale in palio", "A world first is at stake")
add(R + "milestone.open",
    "Primato ancora libero: chi arriva per primo guadagna {first} punti di reputazione in ogni blocco, chi segue {follow}.",
    "Still unclaimed: whoever gets here first earns {first} reputation in every bloc, followers earn {follow}.")
add(R + "milestone.yours",
    "Il primato è tuo dalla settimana {week}: {first} punti di reputazione in ogni blocco.",
    "The first is yours since week {week}: {first} reputation in every bloc.")
add(R + "milestone.taken",
    "{country} ci è arrivata per prima, alla settimana {week}. A te restano {follow} punti di reputazione.",
    "{country} got here first, in week {week}. You can still earn {follow} reputation.")
add(R + "milestone.followers", "Poi sono arrivati: {list}.", "Then came: {list}.")

for stat, it, en in [
    ("researchOutput", "Ricerca", "Research"),
    ("weeklyIncome", "Entrate", "Income"),
    ("gdp", "PIL", "GDP"),
    ("agriculture", "Agricoltura", "Agriculture"),
    ("industry", "Industria", "Industry"),
    ("services", "Servizi", "Services"),
    ("tech", "Settore tecnologico", "Tech sector"),
    ("popularity", "Popolarità", "Popularity"),
    ("army", "Militari", "Military faction"),
    ("business", "Imprese", "Business"),
    ("religious", "Clero", "Clergy"),
    ("populist", "Populisti", "Populists"),
    ("reformist", "Riformisti", "Reformists"),
    ("doctrineLevel", "Dottrina militare", "Military doctrine"),
    ("counterIntelLevel", "Controspionaggio", "Counter-intelligence"),
    ("spyCount", "Spie", "Spies"),
    ("armySize", "Esercito", "Army"),
    ("navy", "Marina", "Navy"),
    ("airforce", "Aviazione", "Air force"),
    ("population", "Popolazione", "Population"),
]:
    add(R + f"fx.stat.{stat}", it, en)
add(R + "fx.spyUnlock", "Operazione: {name}", "Operation: {name}")
add(R + "fx.spy.steal_tech", "furto di tecnologia", "tech theft")
add(R + "fx.spy.sabotage", "sabotaggio", "sabotage")
add(R + "fx.spy.propaganda", "propaganda", "propaganda")
add(R + "fx.spy.destabilize", "destabilizzazione", "destabilisation")
add(R + "fx.spy.assassinate", "eliminazione mirata", "targeted killing")
add(R + "fx.action.fiscal_audit", "Verifiche fiscali", "Fiscal audits")
add(R + "fx.action.deterrence", "Deterrenza nucleare", "Nuclear deterrence")
add(R + "fx.action.thermonuclear_deterrence", "Deterrenza termonucleare", "Thermonuclear deterrence")
add(R + "fx.actionOther", "Nuova capacità", "New capability")
add(R + "fx.other", "Effetto speciale", "Special effect")

add(R + "space.title", "Tecnologie spaziali", "Space technology")
add(R + "space.count", "{done} su {total}", "{done} of {total}")
add(R + "space.why",
    "Hai scoperto il {pct}% del ramo. È questa quota ad aprire i grandi progetti fuori dalla Terra:",
    "You hold {pct}% of the branch. That share is what opens the megaprojects beyond Earth:")
add(R + "space.gateReached", "sbloccato", "unlocked")
add(R + "space.gateMissing",
    "{n, plural, =1 {manca 1 tecnologia} other {mancano # tecnologie}}",
    "{n, plural, =1 {1 technology to go} other {# technologies to go}}")
add(R + "space.openCosmos", "Vai ai grandi progetti", "Go to megaprojects")
add(R + "space.firsts.title", "Primati mondiali", "World firsts")
add(R + "space.firsts.intro",
    "Chi arriva per primo a queste tappe guadagna reputazione in tutti i blocchi. Chi segue ne prende molta meno.",
    "Whoever reaches these first earns reputation in every bloc. Followers get far less.")
add(R + "space.firsts.open", "libero · +{points}", "open · +{points}")
add(R + "space.firsts.yours", "tuo", "yours")

add(R + "errors.research.techNotFound", "Questa tecnologia non esiste in questo scenario.",
    "That technology does not exist in this scenario.")
add(R + "errors.research.alreadyCompleted", "L’hai già scoperta.", "You have already discovered it.")
add(R + "errors.research.alreadyActive", "I laboratori stanno già lavorando a un’altra ricerca.",
    "The labs are already working on something else.")
add(R + "errors.research.missingPrereq", "Mancano ancora le tecnologie che la precedono.",
    "The technologies that come before it are still missing.")
add(R + "errors.country.notFound", "Il tuo paese non è più in gioco.", "Your country is no longer in play.")

# ---------------------------------------------------------------------------
# Internal politics
# ---------------------------------------------------------------------------
P = "panelPolitics."
add(P + "hero.popularity", "Popolarità", "Popularity")
add(P + "hero.weekly", "{points} a settimana", "{points} per week")
add(P + "hero.crisisMark", "sotto il {pct}%: crisi", "below {pct}%: crisis")
add(P + "hero.settles",
    "Con le fazioni di oggi si assesta intorno al {pct} (la tacca bianca). La popolarità insegue l’umore delle "
    "fazioni, pesato per influenza, e torna lentamente verso il 50%.",
    "With today’s factions it settles around {pct} (the white tick). Popularity chases the factions’ mood, "
    "weighted by influence, and drifts slowly back towards 50%.")
add(P + "hero.government", "Governo", "Government")
add(P + "hero.mood", "Umore fazioni", "Faction mood")
add(P + "hero.hostile", "Ostili", "Hostile")
add(P + "standing.crisis", "In crisi", "In crisis")
add(P + "standing.uneasy", "A rischio", "At risk")
add(P + "standing.steady", "Stabile", "Steady")
add(P + "standing.strong", "Solida", "Strong")

add(P + "danger.title", "Come cade un governo", "How a government falls")
add(P + "danger.popularity",
    "Popolarità sotto il {pct}% per {weeks} settimane di fila.",
    "Popularity below {pct}% for {weeks} weeks in a row.")
add(P + "danger.popularityActive",
    "Sei sotto il {pct}% da {weeks, plural, =0 {questa settimana} =1 {una settimana} other {# settimane}}: "
    "ancora {left, plural, =1 {una} other {#}} e il governo cade. Fai una concessione alla fazione più pesante, subito.",
    "You have been below {pct}% {weeks, plural, =0 {since this week} =1 {for one week} other {for # weeks}}: "
    "{left, plural, =1 {one more} other {# more}} and the government falls. Make a concession to the heaviest faction now.")
add(P + "danger.factions",
    "Tutte e cinque le fazioni sotto il {pct}% per {weeks} settimane di fila. "
    "{hostile, plural, =0 {Oggi nessuna è ostile.} =1 {Oggi una è ostile.} other {Oggi # sono ostili.}}",
    "All five factions below {pct}% for {weeks} weeks in a row. "
    "{hostile, plural, =0 {None is hostile today.} =1 {One is hostile today.} other {# are hostile today.}}")
add(P + "danger.factionsActive",
    "Tutte le fazioni sono sotto il {pct}% da {weeks, plural, =0 {questa settimana} =1 {una settimana} other {# settimane}}: "
    "ancora {left, plural, =1 {una} other {#}} e ti rovesciano. Basta riportarne una sopra la soglia per fermare il conto.",
    "Every faction has been below {pct}% {weeks, plural, =0 {since this week} =1 {for one week} other {for # weeks}}: "
    "{left, plural, =1 {one more} other {# more}} and they overthrow you. Lifting a single one above the line stops the clock.")

add(P + "government.title", "Forma di governo", "Form of government")
add(P + "government.nudgeNote", "Punti di soddisfazione a settimana.", "Satisfaction points per week.")
for gov, it_name, en_name, it_desc, en_desc in [
    ("democracy", "Democrazia", "Democracy",
     "Si governa col consenso: riformisti, imprese e populisti si sentono rappresentati.",
     "You rule by consent: reformists, business and populists feel represented."),
    ("autocracy", "Autocrazia", "Autocracy",
     "Il potere sta in poche mani: i militari sono di casa, i riformisti mordono il freno.",
     "Power sits in a few hands: the military is at home, reformists chafe."),
    ("oligarchy", "Oligarchia", "Oligarchy",
     "Decidono i grandi patrimoni: le imprese prosperano, i populisti covano rancore.",
     "Big money decides: business thrives, populists nurse a grudge."),
    ("theocracy", "Teocrazia", "Theocracy",
     "La legge segue la fede: il clero è al centro, i riformisti ai margini.",
     "Law follows faith: the clergy at the centre, reformists at the edge."),
    ("monarchy", "Monarchia", "Monarchy",
     "La corona poggia su esercito e clero; ai populisti resta poco spazio.",
     "The crown rests on army and clergy; populists get little room."),
]:
    add(P + f"government.{gov}.name", it_name, en_name)
    add(P + f"government.{gov}.desc", it_desc, en_desc)

for fid, it_name, en_name, it_wants, en_wants in [
    ("army", "Militari", "Military",
     "Stato maggiore e veterani. Vogliono un governo forte; il fisco li tocca poco.",
     "General staff and veterans. They want a strong government; taxes barely touch them."),
    ("business", "Imprese", "Business",
     "Industriali e finanza. Vogliono tasse basse: nessuno reagisce al fisco quanto loro.",
     "Industry and finance. They want low taxes: nobody reacts to the tax rate like they do."),
    ("religious", "Clero", "Clergy",
     "Le autorità religiose. Vogliono un governo vicino alla fede; il fisco li tocca poco.",
     "The religious authorities. They want a government close to the faith; taxes barely touch them."),
    ("populist", "Populisti", "Populists",
     "La piazza. Vogliono tasse alte, che leggono come redistribuzione.",
     "The street. They want high taxes, which they read as redistribution."),
    ("reformist", "Riformisti", "Reformists",
     "Università e ceto urbano. Vogliono un paese aperto e gradiscono tasse un po’ più alte.",
     "Universities and the urban class. They want an open country and like taxes a little higher."),
]:
    add(P + f"faction.{fid}.name", it_name, en_name)
    add(P + f"faction.{fid}.wants", it_wants, en_wants)

add(P + "mood.hostile", "Ostili", "Hostile")
add(P + "mood.unhappy", "Scontenti", "Unhappy")
add(P + "mood.lukewarm", "Tiepidi", "Lukewarm")
add(P + "mood.content", "Soddisfatti", "Content")
add(P + "mood.loyal", "Fedeli", "Loyal")

add(P + "factions.title", "Fazioni", "Factions")
add(P + "factions.count", "{n} gruppi di potere", "{n} power groups")
add(P + "factions.intro",
    "Una concessione costa {cost} e alza subito di {points} punti la soddisfazione di una fazione. "
    "Più una fazione pesa, più sposta la popolarità.",
    "A concession costs {cost} and lifts one faction’s satisfaction by {points} points at once. "
    "The more a faction weighs, the more it moves popularity.")
add(P + "factions.weight", "peso {pct}", "weight {pct}")
add(P + "factions.urgent", "Più urgente", "Most urgent")

add(P + "placate.button", "Concedi · {cost}", "Concede · {cost}")
add(P + "placate.effectLabel", "Con una concessione", "With a concession")
add(P + "placate.maxed", "Soddisfazione già al massimo: una concessione sarebbe sprecata.",
    "Satisfaction is already at the top: a concession would be wasted.")
add(P + "placate.cannotAfford", "Servono {cost} in tesoreria", "You need {cost} in the treasury")
add(P + "placate.blocked",
    "Una concessione costa {cost}: in cassa hai {treasury}. Alza le entrate dal pannello Economia.",
    "A concession costs {cost}: you have {treasury}. Raise your income from the Economy panel.")
add(P + "placate.done", "Concessione fatta: {name} al {value}.", "Concession made: {name} at {value}.")

add(P + "moves.title", "Cosa li muove", "What moves them")
add(P + "moves.taxDown", "Tasse: ogni punto di aliquota in più costa {points} punti di soddisfazione.",
    "Taxes: each extra point of tax costs {points} satisfaction.")
add(P + "moves.taxUp", "Tasse: ogni punto di aliquota in più vale {points} punti di soddisfazione.",
    "Taxes: each extra point of tax is worth {points} satisfaction.")
add(P + "moves.governmentUp", "{government}: li favorisce, +{points} a settimana.",
    "{government}: it favours them, +{points} per week.")
add(P + "moves.governmentDown", "{government}: li penalizza, −{points} a settimana.",
    "{government}: it holds them back, −{points} per week.")
add(P + "moves.likes", "Politiche che apprezzano: {list}.", "Policies they like: {list}.")
add(P + "moves.dislikes", "Politiche che non sopportano: {list}.", "Policies they resent: {list}.")
add(P + "moves.drift",
    "Lasciati a sé tornano verso il 50%: questa settimana {points}.",
    "Left alone they drift back to 50%: {points} this week.")

add(P + "news.title", "Cronaca politica", "Political news")
add(P + "news.empty",
    "Nessun fatto politico di rilievo finora. Scioperi, scandali e riforme compariranno qui.",
    "No political news so far. Strikes, scandals and reforms will show up here.")
add(P + "news.week", "sett. {week}", "wk {week}")

add(P + "errors.placate.insufficientTreasury", "Non hai abbastanza in tesoreria per una concessione.",
    "The treasury cannot cover a concession.")
add(P + "errors.placate.unknownFaction", "Questa fazione non esiste.", "That faction does not exist.")
add(P + "errors.country.notFound", "Il tuo paese non è più in gioco.", "Your country is no longer in play.")

# Namespaces rewritten from scratch: drop the old trees first.
REMOVE = ["panelEconomy", "panelResearch", "panelSpaceRace", "panelPolitics"]

if __name__ == "__main__":
    from _merge import merge

    merge(ENTRIES, remove=REMOVE)
