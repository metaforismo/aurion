"""Off-world territory: sectors, claims, structures.
Run: python3 scripts/i18n/territory_messages.py"""

T = "cosmos.territory"
C = "cosmos.colony"

ENTRIES = [
    (f"{C}.tabs", "Scheda della colonia", "Colony tab"),
    (f"{C}.tab.mandate", "Mandato", "Mandate"),
    (f"{C}.tab.territory", "Territorio", "Territory"),
    (f"{T}.summary",
     "{mine, plural, =1 {1 settore tuo} other {# settori tuoi}} · {rivals} dei rivali · {free} liberi",
     "{mine, plural, =1 {1 sector yours} other {# sectors yours}} · {rivals} held by rivals · {free} free"),
    (f"{T}.pick",
     "Tocca la superficie per scegliere un settore. I tuoi sono dorati, quelli tratteggiati in azzurro si possono rivendicare.",
     "Tap the surface to pick a sector. Yours are gold; the ones dashed in blue can be claimed."),
    (f"{T}.owner.you", "Tuo", "Yours"),
    (f"{T}.owner.rival", "Di {name}", "Held by {name}"),
    (f"{T}.owner.free", "Libero", "Free"),
    (f"{T}.structures", "Strutture del settore", "Structures in the sector"),
    (f"{T}.emptySlot", "Spazio libero", "Free plot"),
    (f"{T}.structure.habitat", "Habitat", "Habitat"),
    (f"{T}.structure.lab", "Laboratorio", "Laboratory"),
    (f"{T}.structure.mine", "Miniera", "Mine"),
    (f"{T}.structure.foundry", "Fonderia", "Foundry"),
    (f"{T}.gain.habitat", "+{n} posti", "+{n} room"),
    (f"{T}.gain.lab", "{v} ricerca/sett.", "{v} research/wk"),
    (f"{T}.gain.mine", "+{v}/sett.", "+{v}/wk"),
    (f"{T}.gain.foundry", "{v}% cantieri", "{v}% build speed"),
    (f"{T}.price", "{cost} · {weeks} sett.", "{cost} · {weeks} wk"),
    (f"{T}.full", "Il settore è al completo: per costruire ancora serve altro terreno.", "The sector is full: building more takes more land."),
    (f"{T}.taken", "Un rivale è arrivato prima: questo terreno non si può più rivendicare.", "A rival got here first: this land can no longer be claimed."),
    (f"{T}.claimHint",
     "Un settore in più dà posti alla colonia e due spazi per costruire.",
     "One more sector gives the colony room and two plots to build on."),
    (f"{T}.claim", "Rivendica · {cost} · {weeks} sett.", "Claim · {cost} · {weeks} wk"),
    (f"{T}.notAdjacent",
     "Non confina con i tuoi settori: ci si espande da un terreno vicino all'altro.",
     "It does not border your sectors: you expand from one piece of land to the next."),
    (f"{T}.busy", "C'è già un lavoro in corso su questo mondo.", "A work is already under way on this world."),
    (f"{T}.cannotAfford", "Non hai abbastanza in cassa.", "You cannot afford it."),
    (f"{T}.work.claim",
     "Rivendicazione di {sector}: {weeks, plural, =1 {1 settimana} other {# settimane}}",
     "Claiming {sector}: {weeks, plural, =1 {1 week} other {# weeks}}"),
    (f"{T}.work.build",
     "{structure} in costruzione a {sector}: {weeks, plural, =1 {1 settimana} other {# settimane}}",
     "{structure} going up in {sector}: {weeks, plural, =1 {1 week} other {# weeks}}"),
]

B = "cosmos.base"

ENTRIES += [
    (f"{C}.visit", "Scendi sulla base", "Go down to the base"),
    (f"{B}.label.moon", "La base lunare, vista dalla superficie", "The lunar base, seen from the surface"),
    (f"{B}.label.mars", "La base marziana, vista dalla superficie", "The Martian base, seen from the surface"),
    (f"{B}.leave", "Torna in orbita", "Back to orbit"),
    (f"{B}.hint",
     "Trascina per guardarti intorno, rotella o pizzico per avvicinarti fino alle persone. La base cresce con gli abitanti, i progetti e le strutture che costruisci.",
     "Drag to look around, scroll or pinch to get as close as the people. The base grows with its population, your projects and the structures you build."),
    (f"{B}.loading", "Sto preparando la superficie…", "Preparing the surface…"),
    (f"{B}.zoomIn", "Avvicina", "Zoom in"),
    (f"{B}.zoomOut", "Allontana", "Zoom out"),
    (f"{B}.reset", "Vista d'insieme", "Overview"),
    (f"{B}.kind.housing", "{n, plural, =1 {modulo abitativo} other {moduli abitativi}}", "{n, plural, =1 {housing module} other {housing modules}}"),
    (f"{B}.kind.dome", "{n, plural, =1 {cupola} other {cupole}}", "{n, plural, =1 {dome} other {domes}}"),
    (f"{B}.kind.habitat", "habitat", "{n, plural, =1 {habitat} other {habitats}}"),
    (f"{B}.kind.lab", "{n, plural, =1 {laboratorio} other {laboratori}}", "{n, plural, =1 {laboratory} other {laboratories}}"),
    (f"{B}.kind.mine", "{n, plural, =1 {miniera} other {miniere}}", "{n, plural, =1 {mine} other {mines}}"),
    (f"{B}.kind.foundry", "{n, plural, =1 {fonderia} other {fonderie}}", "{n, plural, =1 {foundry} other {foundries}}"),
]

if __name__ == "__main__":
    from _merge import merge

    merge(ENTRIES)
