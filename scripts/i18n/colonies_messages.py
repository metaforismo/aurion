"""Colonies on the Moon and Mars. Run: python3 scripts/i18n/colonies_messages.py"""

C = "cosmos.colony"

ENTRIES = [
    (f"{C}.title.moon", "Colonia lunare", "Lunar colony"),
    (f"{C}.title.mars", "Colonia marziana", "Martian colony"),
    (f"{C}.people", "{n} abitanti su {cap} posti", "{n} people, room for {cap}"),
    (f"{C}.growing",
     "Cresce da sola verso i posti disponibili. Nuovi progetti su questo mondo ne aggiungono.",
     "It grows by itself toward the room available. New projects on this world add more."),
    (f"{C}.full",
     "È al completo: per farla crescere servono nuovi progetti su questo mondo.",
     "It is full: growing it takes new projects on this world."),
    (f"{C}.mandate", "Mandato della colonia", "The colony's mandate"),
    (f"{C}.focus.balanced", "Equilibrio", "Balanced"),
    (f"{C}.focus.science", "Scienza", "Science"),
    (f"{C}.focus.industry", "Industria", "Industry"),
    (f"{C}.focus.trade", "Commercio", "Trade"),
    (f"{C}.yield.research", "{v} ricerca/sett.", "{v} research/wk"),
    (f"{C}.yield.income", "+{v}/sett.", "+{v}/wk"),
    (f"{C}.yield.speed", "{v}% cantieri", "{v}% build speed"),
    (f"{C}.hint",
     "Il mandato decide cosa la colonia manda a casa; più è popolosa, più rende. Dopo un cambio resta fisso per 26 settimane.",
     "The mandate decides what the colony sends home; the more people, the more it yields. Once changed it holds for 26 weeks."),
    (f"{C}.locked",
     "Mandato appena cambiato: potrai sceglierne un altro tra {weeks, plural, =1 {1 settimana} other {# settimane}}.",
     "The mandate has just changed: you can pick another in {weeks, plural, =1 {1 week} other {# weeks}}."),
    ("panelEconomy.sources.colonies", "Colonie", "Colonies"),
    ("panelEconomy.sources.coloniesHint", "Quanto mandano a casa le colonie su altri mondi", "What your colonies on other worlds send home"),
    ("panelEconomy.sources.factions", "Imprese", "Business"),
    ("panelEconomy.sources.factionsHintLoyal", "Sono dalla tua parte: pagano di più", "They are behind you: they pay in more"),
    ("panelEconomy.sources.factionsHintHostile", "Sono contro di te: nascondono i soldi", "They are against you: they hide their money"),
    ("errors.colony.cooldown", "Il mandato di questa colonia è stato cambiato da poco.", "This colony's mandate changed too recently."),
    ("errors.colony.none", "Non hai ancora una colonia su questo mondo.", "You have no colony on this world yet."),
]

if __name__ == "__main__":
    from _merge import merge

    merge(ENTRIES)
