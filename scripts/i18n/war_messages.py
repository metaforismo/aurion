"""Wars with an outcome: score, peace terms, truce.
Run: python3 scripts/i18n/war_messages.py"""

D = "panelDiplomacy"
M = "panelMilitary.wars"
TRUCE_IT = " Segue una tregua di due anni."
TRUCE_EN = " A two-year truce follows."

ENTRIES = [
    (f"{D}.peace.white",
     "Nessuno dei due è abbastanza avanti da dettare condizioni: la pace è senza vincitori né riparazioni, e l'atteggiamento risale di 15 punti." + TRUCE_IT,
     "Neither side is far enough ahead to dictate terms: a peace with no winner and no reparations, and attitude recovers by 15." + TRUCE_EN),
    (f"{D}.peace.winReparations",
     "Stai vincendo: {name} ti paga {amount} di riparazioni e il tuo consenso sale di 3 punti. Portando il punteggio a +60 potresti imporre la capitolazione." + TRUCE_IT,
     "You are winning: {name} pays you {amount} in reparations and your approval rises by 3. At a score of +60 you could force a capitulation." + TRUCE_EN),
    (f"{D}.peace.winCapitulation",
     "{name} capitola: ti paga {amount} di riparazioni, ti cede {gdp} di PIL e il tuo consenso sale di 6 punti." + TRUCE_IT,
     "{name} capitulates: it pays you {amount} in reparations, hands over {gdp} of GDP and your approval rises by 6." + TRUCE_EN),
    (f"{D}.peace.loseReparations",
     "Stai perdendo: per avere la pace paghi {amount} di riparazioni a {name} e il tuo consenso scende di 4 punti. Se il punteggio arriva a −60 le condizioni peggiorano." + TRUCE_IT,
     "You are losing: peace costs you {amount} in reparations to {name} and 4 points of approval. If the score reaches −60 the terms get worse." + TRUCE_EN),
    (f"{D}.peace.loseCapitulation",
     "È una capitolazione: paghi {amount} di riparazioni a {name}, cedi {gdp} di PIL e il tuo consenso crolla di 10 punti." + TRUCE_IT,
     "This is a capitulation: you pay {amount} in reparations to {name}, give up {gdp} of GDP and your approval falls by 10." + TRUCE_EN),
    (f"{D}.peace.short.white", "pace senza vincitori, nessuna riparazione.", "a peace with no winner and no reparations."),
    (f"{D}.peace.short.winReparations", "{name} ti paga {amount}.", "{name} pays you {amount}."),
    (f"{D}.peace.short.winCapitulation", "{name} capitola: {amount} e {gdp} di PIL per te.", "{name} capitulates: {amount} and {gdp} of GDP for you."),
    (f"{D}.peace.short.loseReparations", "paghi {amount} a {name}.", "you pay {name} {amount}."),
    (f"{D}.peace.short.loseCapitulation", "capitoli: paghi {amount} e cedi {gdp} di PIL.", "you capitulate: you pay {amount} and give up {gdp} of GDP."),
    (f"{D}.error.truce",
     "C'è una tregua in vigore dopo l'ultima pace: non puoi ancora tornare in guerra.",
     "A truce is in force after the last peace: you cannot go back to war yet."),
    ("errors.truce",
     "C'è una tregua in vigore dopo l'ultima pace.",
     "A truce is in force after the last peace."),
    (f"{M}.score", "Punteggio di guerra", "War score"),
    (f"{M}.scoreLabel",
     "Punteggio di guerra {score} su una scala da −100 a +100; a 20 si ottengono riparazioni, a 60 la capitolazione",
     "War score {score} on a scale from −100 to +100; 20 earns reparations, 60 a capitulation"),
    (f"{M}.ifPeaceNow", "Se firmi ora:", "If you sign now:"),
    (f"{M}.toll",
     "{weeks, plural, =0 {Appena scoppiata} =1 {1 settimana di guerra} other {# settimane di guerra}} · perdite: {own} tue, {foe} loro",
     "{weeks, plural, =0 {Just broken out} =1 {1 week of war} other {# weeks of war}} · losses: {own} yours, {foe} theirs"),
    (f"{M}.howItEnds",
     "Il punteggio sale vincendo scontri, occupando la loro regione e, piano piano, semplicemente essendo più forte; ogni settimana di guerra costa consenso a entrambi. La pace si firma alle condizioni del punteggio: sotto 20 è un pareggio, da 20 chi è avanti incassa riparazioni, da 60 l'altro capitola. Se le truppe nemiche nella tua regione superano i tuoi difensori per 26 settimane di fila, perdi la partita.",
     "The score rises by winning battles, occupying their region and, slowly, simply by being stronger; every week of war costs both sides approval. Peace is signed on the score's terms: under 20 it is a draw, from 20 the side ahead collects reparations, from 60 the other capitulates. If enemy troops in your region outnumber your defenders for 26 weeks in a row, you lose the game."),
    ("briefing.feed.peace.white", "Pace senza vincitori", "Peace with no winner"),
    ("briefing.feed.peace.reparations", "{winner} incassa {amount} di riparazioni", "{winner} collects {amount} in reparations"),
    ("briefing.feed.peace.capitulation", "{loser} capitola davanti a {winner}", "{loser} capitulates to {winner}"),
]

if __name__ == "__main__":
    from _merge import merge

    merge(ENTRIES, remove=["errors.diplomacy"])
