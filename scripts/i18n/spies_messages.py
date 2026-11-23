"""Covert operations copy: outcomes by parameter, returning agents.
Run: python3 scripts/i18n/spies_messages.py"""

P = "panelSpies"

ENTRIES = [
    (f"{P}.outcome.sabotage.economy",
     "il loro PIL cala del {pct}: tanto pesa questo settore nella loro economia.",
     "their GDP drops by {pct}: that is how much this sector weighs in their economy."),
    (f"{P}.outcome.sabotage.economyUnknown",
     "il loro PIL cala tra l'1% e il 6%: più il settore pesa, più fa male. Con più informazioni sapresti quanto.",
     "their GDP drops by 1% to 6%: the bigger the sector, the deeper the cut. Better intel would tell you how much."),
    (f"{P}.outcome.propaganda.any",
     "la popolarità del loro governo scende di 5 punti.",
     "their government's popularity drops by 5."),
    (f"{P}.outcome.propaganda.faction",
     "la soddisfazione di {faction} crolla di 15 punti e la popolarità del governo scende di 2.",
     "the satisfaction of {faction} drops by 15 and the government's popularity by 2."),
    (f"{P}.outcome.assassinate.head_of_state",
     "la popolarità del loro governo scende di 10 punti e ogni fazione perde 5 punti di soddisfazione.",
     "their government's popularity drops by 10 and every faction loses 5 satisfaction."),
    (f"{P}.outcome.assassinate.defence_minister",
     "la loro dottrina militare perde il 15% e i militari perdono 10 punti di soddisfazione.",
     "their military doctrine loses 15% and the military faction loses 10 satisfaction."),
    (f"{P}.outcome.assassinate.intelligence_chief",
     "il loro controspionaggio perde 10 punti e i loro archivi sono tuoi: informazioni complete sul paese.",
     "their counter-intelligence loses 10 points and their files are yours: full intel on the country."),
    (f"{P}.composer.detectedEffect",
     "l'agente è perso, i rapporti con loro peggiorano di {penalty} punti e la tensione mondiale sale di 1 per dieci settimane. Se l'operazione era riuscita, l'effetto resta.",
     "the agent is lost, relations with them worsen by {penalty} and world tension rises by 1 for ten weeks. If the operation had worked, the effect stands."),
    (f"{P}.composer.agentLost",
     "Se nessuno vi scopre, l'agente rientra a fine operazione, che sia riuscita o no.",
     "If nobody catches you, the agent comes home when the operation ends, whether it worked or not."),
    (f"{P}.network.recruit",
     "Un agente rientra a fine missione, a meno che non venga scoperto. Reclutarne uno costa {cost} investiti in intelligence.",
     "An agent comes home when the mission ends, unless caught. Recruiting one costs {cost} invested in intelligence."),
    (f"{P}.reports.completed",
     "{op} riuscita contro {name}. L'agente è rientrato.",
     "{op} against {name} succeeded. The agent is home."),
    (f"{P}.reports.failed",
     "{op} fallita contro {name}: nessun effetto, nessuno se n'è accorto. L'agente è rientrato.",
     "{op} against {name} failed: no effect, nobody noticed. The agent is home."),
    (f"{P}.reports.detected",
     "{op} contro {name} fallita e scoperta: agente perso, rapporti −{penalty}.",
     "{op} against {name} failed and was exposed: agent lost, relations −{penalty}."),
    (f"{P}.reports.detectedButDone",
     "{op} contro {name} riuscita, ma scoperta: l'effetto resta, l'agente è perso, rapporti −{penalty}.",
     "{op} against {name} worked but was exposed: the effect stands, the agent is lost, relations −{penalty}."),
    (f"{P}.reports.caught",
     "Scoperta un'operazione di {name} contro di te: {op}. Rapporti −{penalty}.",
     "You exposed an operation by {name} against you: {op}. Relations −{penalty}."),
]

ENTRIES += [
    (f"{P}.reports.caught",
     "Sventata un'operazione di {name} contro di te: {op}. Nessun danno, rapporti −{penalty}.",
     "You foiled an operation by {name} against you: {op}. No damage, relations −{penalty}."),
    (f"{P}.reports.caughtButDone",
     "{op} di {name} contro di te: scoperta troppo tardi, il danno è fatto. Rapporti −{penalty}.",
     "{op} by {name} against you: exposed too late, the damage is done. Relations −{penalty}."),
    (f"{P}.reports.hitUnknown",
     "Hai subìto un'operazione: {op}. Mandante ignoto. Un controspionaggio più forte l'avrebbe fermata o smascherata.",
     "You were hit by an operation: {op}. Sender unknown. Stronger counter-intelligence would have stopped or exposed it."),
    ("globe.news.spyDone.completed", "Operazione riuscita", "Operation succeeded"),
    ("globe.news.spyDone.failed", "Operazione fallita", "Operation failed"),
    ("globe.news.spyDone.detected", "Agente scoperto", "Agent exposed"),
    ("globe.news.spyCaught", "Spia di {name} scoperta", "Spy from {name} caught"),
    ("globe.news.spyHit.steal_tech", "Tecnologia trafugata", "Technology stolen from you"),
    ("globe.news.spyHit.sabotage", "Sabotaggio subìto", "You were sabotaged"),
    ("globe.news.spyHit.propaganda", "Propaganda straniera", "Foreign propaganda"),
    ("globe.news.spyHit.destabilize", "Fazioni aizzate dall'estero", "Factions stirred from abroad"),
    ("globe.news.spyHit.assassinate", "Attentato", "Assassination"),
]

# Dock labels: the rail is 60px wide, so two names get a shorter form there.
# The full name stays the tab's accessible name and tooltip.
for pid, it, en in [
    ("economy", "Economia", "Economy"), ("research", "Ricerca", "Research"),
    ("military", "Militare", "Military"), ("spies", "Intel", "Intel"),
    ("diplomacy", "Diplomazia", "Diplomacy"), ("politics", "Politica", "Politics"),
    ("un", "ONU", "UN"), ("cosmos", "Cosmo", "Cosmos"),
]:
    ENTRIES.append((f"panelsShort.{pid}", it, en))

REMOVE = [
    f"{P}.outcome.propaganda",
    f"{P}.outcome.assassinate",
]

if __name__ == "__main__":
    from _merge import merge

    merge(ENTRIES, remove=REMOVE)
