"""Protectorates on Earth. Run: python3 scripts/i18n/earth_messages.py"""

T = "globe.territory"

ENTRIES = [
    (f"{T}.close", "Chiudi", "Close"),
    (f"{T}.status.free", "Paese non allineato", "Unaligned country"),
    (f"{T}.status.yours", "Tuo protettorato", "Your protectorate"),
    (f"{T}.status.rival", "Protettorato di {name}", "Protectorate of {name}"),
    (f"{T}.status.inProgress",
     "Integrazione in corso: {weeks, plural, =1 {1 settimana} other {# settimane}}",
     "Being integrated: {weeks, plural, =1 {1 week} other {# weeks}}"),
    (f"{T}.cost", "Costo", "Cost"),
    (f"{T}.time", "Tempo", "Time"),
    (f"{T}.gain", "PIL, per sempre", "GDP, for good"),
    (f"{T}.weeks", "{n} sett.", "{n} wk"),
    (f"{T}.claim", "Integra come protettorato", "Make it a protectorate"),
    (f"{T}.hint",
     "Si paga subito. I paesi confinanti non la prendono bene: −5 di atteggiamento con ciascuno. Da qui potrai poi espanderti ai suoi vicini.",
     "You pay up front. The nations next door will not like it: −5 attitude with each. From here you can then expand to its neighbours."),
    (f"{T}.busy", "Stai già integrando un altro paese: uno alla volta.", "You are already integrating another country: one at a time."),
    (f"{T}.cannotAfford", "Non hai abbastanza in cassa.", "You cannot afford it."),
    (f"{T}.notAdjacent",
     "Non confina con i tuoi territori, nemmeno via mare: ci si espande da un paese vicino all'altro.",
     "It does not border your land, not even across the sea: you expand from one country to the next."),
    (f"{T}.yoursHint",
     "Fa parte della tua sfera. Se capitoli in guerra, il protettorato più recente passa al vincitore.",
     "It is part of your sphere. If you capitulate in a war, your latest protectorate goes to the winner."),
    (f"{T}.rivalHint",
     "Un rivale è arrivato prima. Può cambiare mano solo con una capitolazione.",
     "A rival got here first. It can only change hands through a capitulation."),
    ("briefing.feed.landYou", "{place} è ora un tuo protettorato", "{place} is now your protectorate"),
    ("briefing.feed.landRival", "{name} ha fatto di {place} un protettorato", "{name} made {place} a protectorate"),
    ("guide.systems.diplomacy.what",
     "I rapporti con ogni nazione: accordi commerciali, alleanze, sanzioni, guerra e pace. E il territorio: i paesi non allineati che confinano con i tuoi possono diventare protettorati, toccandoli sul globo.",
     "Relations with every nation: trade deals, alliances, sanctions, war and peace. And land: unaligned countries that border yours can become protectorates, by tapping them on the globe."),
    ("errors.territory.taken", "Questo territorio è già di qualcuno.", "That land already belongs to someone."),
    ("errors.territory.notAdjacent", "Non confina con i tuoi territori.", "It does not border your land."),
    ("errors.territory.busy", "C'è già un lavoro in corso.", "A work is already under way."),
    ("errors.territory.insufficientTreasury", "Non hai abbastanza in cassa.", "You cannot afford it."),
]

if __name__ == "__main__":
    from _merge import merge

    merge(ENTRIES)
