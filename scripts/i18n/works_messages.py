"""National works: universities, plants, labs built at home, and their
place in the capital's 3D view.
Run: python3 scripts/i18n/works_messages.py"""

W = "works"
B = "cosmos.base"
E = "errors.works"

ITEMS = [
    ("university", "Università", "University",
     "Forma ingegneri e ricercatori: ogni livello aggiunge facoltà al campus.",
     "Trains engineers and researchers: every level adds faculties to the campus."),
    ("hospital", "Ospedale", "Hospital",
     "Cure migliori, cittadini più contenti. Cresce in altezza, con l'eliporto.",
     "Better care, happier citizens. It grows taller, with a helipad."),
    ("datacenter", "Data center", "Data centre",
     "Potenza di calcolo per la ricerca e le imprese.",
     "Computing power for research and business."),
    ("exchange", "Borsa", "Stock exchange",
     "Attira capitali: il distretto finanziario si alza attorno al palazzo storico.",
     "Draws capital: the financial district rises round the old building."),
    ("airport", "Aeroporto", "Airport",
     "Commerci e turismo. Nuovi terminal, poi una seconda pista.",
     "Trade and tourism. New terminals, then a second runway."),
    ("solar", "Parco solare", "Solar park",
     "Energia pulita ed economica, campo dopo campo.",
     "Clean, cheap energy, field after field."),
    ("nuclear", "Centrale nucleare", "Nuclear plant",
     "Tanta energia per l'industria: un reattore e una torre di raffreddamento per livello.",
     "Plenty of power for industry: a reactor and a cooling tower per level."),
    ("fusion_lab", "Reattore a fusione sperimentale", "Experimental fusion reactor",
     "Un tokamak che accende il plasma: ricerca sull'energia del futuro.",
     "A tokamak that lights plasma: research into the energy of the future."),
    ("observatory", "Osservatorio", "Observatory",
     "Telescopi ottici e, al terzo livello, un grande radiotelescopio.",
     "Optical telescopes and, at the third level, a great radio telescope."),
    ("collider", "Collisore di particelle", "Particle collider",
     "Anelli sotterranei sempre più grandi a caccia di materia oscura.",
     "Ever larger underground rings hunting for dark matter."),
    ("intel_hq", "Quartier generale dei servizi", "Intelligence headquarters",
     "Addestra spie e protegge dai servizi stranieri.",
     "Trains spies and guards against foreign services."),
]

ENTRIES = [
    (f"{W}.title", "Opere nazionali", "National works"),
    (f"{W}.intro",
     "Strutture che costruisci in patria con i soldi del tesoro. Ogni livello costa di più e dura di più, e quando è finito si vede nella capitale.",
     "Facilities you build at home with treasury money. Each level costs and takes more, and once finished it shows in the capital."),
    (f"{W}.slots", "cantieri {used}/{total}", "sites {used}/{total}"),
    (f"{W}.perLevel", "Per livello:", "Per level:"),
    (f"{W}.fx.research", "+{n} ricerca/sett.", "+{n} research/wk"),
    (f"{W}.fx.gdp", "+{n}% PIL", "+{n}% GDP"),
    (f"{W}.fx.popularity", "+{n} popolarità", "+{n} popularity"),
    (f"{W}.fx.spies", "+{n} spia", "+{n} spy"),
    (f"{W}.fx.kardashev", "energia (Kardashev)", "energy (Kardashev)"),
    (f"{W}.build", "Costruisci · {price} · {weeks} sett.", "Build · {price} · {weeks} wk"),
    (f"{W}.upgrade", "Livello {level} · {price} · {weeks} sett.", "Level {level} · {price} · {weeks} wk"),
    (f"{W}.building",
     "Livello {level} in costruzione: {weeks, plural, =1 {1 settimana} other {# settimane}}",
     "Level {level} going up: {weeks, plural, =1 {1 week} other {# weeks}}"),
    (f"{W}.cancel", "Annulla", "Cancel"),
    (f"{W}.locked", "Serve {name} al livello {level}", "Needs {name} at level {level}"),
    (f"{W}.maxed", "Livello massimo", "Top level"),
    (f"{W}.see", "Vedi nella capitale", "See in the capital"),
    (f"{B}.workSite", "· cantiere liv. {level} {pct}%", "· building lv. {level} {pct}%"),
    (f"{B}.workLevel", "· liv. {level}", "· lv. {level}"),
    (f"{E}.playerOnly", "Solo il giocatore costruisce opere nazionali.", "Only the player builds national works."),
    (f"{E}.unknown", "Opera sconosciuta.", "Unknown work."),
    (f"{E}.alreadyBuilding", "Questa opera è già in costruzione.", "This work is already being built."),
    (f"{E}.maxed", "Questa opera è già al livello massimo.", "This work is already at its top level."),
    (f"{E}.locked", "Prima serve un'altra opera.", "Another work is needed first."),
    (f"{E}.noFreeSlot", "Tutti i cantieri delle opere sono occupati.", "Every works site is busy."),
    (f"{E}.insufficientTreasury", "Tesoreria insufficiente.", "Not enough in the treasury."),
    (f"{E}.notBuilding", "Questa opera non è in costruzione.", "This work is not being built."),
]
for wid, it, en, bit, ben in ITEMS:
    ENTRIES.append((f"{W}.items.{wid}.name", it, en))
    ENTRIES.append((f"{W}.items.{wid}.blurb", bit, ben))
    ENTRIES.append((f"{B}.name.work_{wid}", it, en))

if __name__ == "__main__":
    from _merge import merge

    merge(ENTRIES)
