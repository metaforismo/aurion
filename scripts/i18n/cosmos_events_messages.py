"""Space-age event copy. Run: python3 scripts/i18n/cosmos_events_messages.py"""

# id: (name, description, choice a, choice b) — Italian then English.
EVENTS = {
    "cheap_power": (
        ("Energia quasi gratis",
         "Il reattore a fusione produce più di quanto la rete sappia consumare. Le famiglie aspettano la bolletta; le imprese, i mercati esteri.",
         "Taglia le bollette a tutti",
         "Vendi il surplus all'estero"),
        ("Power almost for free",
         "The fusion reactor makes more than the grid can use. Households are waiting for their bills; businesses, for foreign markets.",
         "Cut everyone's bills",
         "Sell the surplus abroad"),
    ),
    "pad_accident": (
        ("Incidente allo spazioporto",
         "Un vettore è esploso sulla rampa. Nessuna vittima, ma le immagini fanno il giro del mondo e l'opposizione chiede di fermare tutto.",
         "Ferma i lanci e apri un'inchiesta",
         "Si va avanti: è così che si impara"),
        ("Accident at the spaceport",
         "A launcher blew up on the pad. No casualties, but the footage is everywhere and the opposition wants everything halted.",
         "Halt launches and open an inquiry",
         "Carry on: this is how you learn"),
    ),
    "orbital_tourism": (
        ("Turisti in orbita",
         "Un consorzio offre una fortuna per portare clienti paganti sulla stazione. Gli scienziati a bordo non la prendono bene.",
         "Vendi i biglietti",
         "La stazione resta un laboratorio"),
        ("Tourists in orbit",
         "A consortium offers a fortune to fly paying guests to the station. The scientists aboard are not thrilled.",
         "Sell the tickets",
         "The station stays a laboratory"),
    ),
    "lunar_claim": (
        ("Di chi è la Luna?",
         "Una potenza rivale contesta la tua base: il polo sud lunare, dice, è patrimonio di tutti. Il mondo guarda cosa rispondi.",
         "Condividi dati e accesso",
         "Pianta la bandiera"),
        ("Who owns the Moon?",
         "A rival power disputes your base: the lunar south pole, it says, belongs to everyone. The world is watching your answer.",
         "Share data and access",
         "Plant the flag"),
    ),
    "helium_rush": (
        ("La corsa all'elio-3",
         "Il primo carico lunare ha fatto crollare il prezzo dell'energia. Chi incassa: lo Stato o chi ha investito?",
         "Nazionalizza i proventi",
         "Lascia fare al mercato"),
        ("The helium-3 rush",
         "The first lunar shipment crashed the price of energy. Who collects: the state, or those who invested?",
         "Nationalise the proceeds",
         "Leave it to the market"),
    ),
    "mars_silence": (
        ("Silenzio da Marte",
         "L'equipaggio non risponde da nove giorni. I tecnici parlano di un'antenna; le famiglie, in diretta, di abbandono.",
         "Lancia una missione di soccorso",
         "Aspetta: il segnale tornerà"),
        ("Silence from Mars",
         "The crew has not answered for nine days. Engineers say it is an antenna; the families, live on air, call it abandonment.",
         "Launch a rescue mission",
         "Wait: the signal will come back"),
    ),
    "mars_autonomy": (
        ("Marte chiede autonomia",
         "Un milione di coloni vota per un proprio parlamento. Pagano le tasse a un pianeta che non vedranno mai più.",
         "Concedi l'autogoverno",
         "Marte resta una provincia"),
        ("Mars asks for autonomy",
         "A million colonists vote for a parliament of their own. They pay tax to a planet they will never see again.",
         "Grant self-government",
         "Mars remains a province"),
    ),
    "type_one_day": (
        ("Il giorno del Tipo I",
         "La rete planetaria è accesa: per la prima volta una civiltà dispone dell'energia di un intero pianeta. Come lo si ricorda?",
         "Festa nazionale, per sempre",
         "Niente feste: si reinveste tutto"),
        ("Type I Day",
         "The planetary grid is live: for the first time a civilisation commands the energy of a whole planet. How should it be remembered?",
         "A national holiday, for good",
         "No parties: reinvest it all"),
    ),
    "belt_strike": (
        ("Sciopero nella fascia",
         "I minatori degli asteroidi incrociano le braccia: turni di otto mesi, e nessuno che li senta. Le consegne sono ferme.",
         "Accetta le loro condizioni",
         "Sostituiscili con le macchine"),
        ("Strike in the belt",
         "The asteroid miners have downed tools: eight-month shifts and nobody listening. Deliveries have stopped.",
         "Accept their terms",
         "Replace them with machines"),
    ),
    "europa_life": (
        ("C'è vita su Europa",
         "Sotto il ghiaccio, qualcosa si muove. Microbi, forse. È la scoperta del millennio, e per ora la conosci solo tu.",
         "Pubblica tutto, subito",
         "Classifica e studia in segreto"),
        ("There is life on Europa",
         "Beneath the ice, something moves. Microbes, perhaps. It is the discovery of the millennium, and for now only you know.",
         "Publish everything, now",
         "Classify it and study in secret"),
    ),
    "swarm_shadow": (
        ("L'ombra dello sciame",
         "I primi specchi di Dyson tolgono alla Terra un filo di luce. I raccolti ne risentono, e gli agricoltori se ne sono accorti.",
         "Correggi le orbite, costi quel che costi",
         "È un prezzo accettabile"),
        ("The shadow of the swarm",
         "The first Dyson mirrors take a sliver of light from Earth. Harvests are feeling it, and farmers have noticed.",
         "Correct the orbits, whatever it costs",
         "It is an acceptable price"),
    ),
    "ark_lottery": (
        ("Chi sale sull'arca?",
         "Centomila posti per un viaggio di sola andata verso Proxima. Dieci milioni di domande. Bisogna decidere come si sceglie.",
         "Una lotteria aperta a tutti",
         "Solo i più qualificati"),
        ("Who boards the ark?",
         "A hundred thousand berths on a one-way trip to Proxima. Ten million applications. Someone has to decide how to choose.",
         "A lottery open to all",
         "Only the most qualified"),
    ),
}

ENTRIES = []
for eid, (it, en) in EVENTS.items():
    for field, i in (("name", 0), ("desc", 1), ("a", 2), ("b", 3)):
        ENTRIES.append((f"cosmosEvent.{eid}.{field}", it[i], en[i]))

if __name__ == "__main__":
    from _merge import merge

    merge(ENTRIES)
