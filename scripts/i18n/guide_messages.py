"""How-to-play codex: the systems as they work now.
Run: python3 scripts/i18n/guide_messages.py"""

S = "guide.systems"

ENTRIES = [
    (f"{S}.economy.what",
     "Tasse, commercio e investimenti: è il sistema che paga tutti gli altri. La tesoreria si muove ogni settimana con le entrate, e il riepilogo dice da dove arriva ogni euro.",
     "Taxes, trade and investment: the system that pays for all the others. The treasury moves every week with your income, and the breakdown says where every euro comes from."),
    (f"{S}.economy.tip",
     "Investi poco e spesso. Una somma grande rispetto al PIL, o molti investimenti ravvicinati, rendono meno euro per euro: il rendimento torna pieno dopo qualche mese.",
     "Invest little and often. A sum that is large next to your GDP, or many investments close together, return less euro for euro: the full return comes back after a few months."),
    (f"{S}.military.what",
     "Esercito, marina e aviazione, e dove schierarli. Ogni guerra ha un punteggio: sale vincendo scontri, occupando la regione nemica e, piano piano, semplicemente essendo più forte.",
     "Army, navy and air force, and where to deploy them. Every war keeps a score: it rises by winning battles, by occupying the enemy's region and, slowly, simply by being stronger."),
    (f"{S}.military.tip",
     "La pace si firma alle condizioni del punteggio: sotto 20 è un pareggio, da 20 chi è avanti incassa riparazioni, da 60 l'altro capitola. Ogni settimana di guerra costa consenso: non trascinarla.",
     "Peace is signed on the score's terms: under 20 it is a draw, from 20 the side ahead collects reparations, from 60 the other capitulates. Every week of war costs approval: do not drag it out."),
    (f"{S}.intel.what",
     "Spie e controspionaggio: rubare tecnologie, sabotare, fare propaganda, destabilizzare un governo, colpire una figura chiave. Il bersaglio che scegli cambia l'effetto, e anche i rivali mandano agenti contro di te.",
     "Spies and counter-intelligence: stealing technology, sabotage, propaganda, destabilising a government, striking a key figure. The target you pick changes the effect, and rivals send agents after you too."),
    (f"{S}.intel.tip",
     "Un agente rientra a fine missione, a meno che non venga scoperto: in quel caso lo perdi e i rapporti peggiorano di 12 punti. Il controspionaggio è ciò che ferma, o smaschera, le operazioni contro di te.",
     "An agent comes home when the mission ends, unless caught: then you lose them and relations drop by 12. Counter-intelligence is what stops, or exposes, the operations against you."),
    (f"{S}.politics.what",
     "La popolarità e cinque fazioni, ognuna con il suo peso e una leva propria: i militari la forza in battaglia, le imprese le entrate, il clero il consenso, i populisti la crescita, i riformisti la ricerca.",
     "Popularity and five factions, each with its weight and a lever of its own: the army combat power, business income, the clergy approval, populists growth, reformists research."),
    (f"{S}.politics.tip",
     "Una fazione al 70% o più è dalla tua parte e ti dà un bonus; al 30% o meno lavora contro di te. Scegli quali tenerti strette in base a ciò che stai cercando di fare.",
     "A faction at 70% or more is behind you and gives a bonus; at 30% or less it works against you. Choose which to keep close by what you are trying to do."),
    (f"{S}.diplomacy.tip",
     "Un'alleanza si prepara: migliora prima i rapporti, e proponila solo quando l'altra nazione ti vede di buon occhio. Ogni alleato toglie anche il 4% dal prezzo dei megaprogetti.",
     "An alliance takes preparation: improve relations first, and propose it only when the other nation thinks well of you. Each ally also takes 4% off the price of megaprojects."),
    ("guide.cosmos.rule.colonies.title", "Le basi diventano colonie.", "Bases become colonies."),
    ("guide.cosmos.rule.land.title", "Il terreno si conquista.", "Land has to be taken."),
    ("guide.cosmos.rule.land.body",
     "Luna e Marte sono divisi in venti settori. Si parte da quello della base e ci si espande in quelli vicini; su ogni settore puoi costruire due strutture — habitat, laboratorio, miniera, fonderia. Anche i rivali rivendicano terreno, e non ce n'è per tutti. Con «Scendi sulla base» la vedi dal vivo: edifici, strade, persone.",
     "The Moon and Mars are divided into twenty sectors. You start from the one your base stands on and expand into its neighbours; each sector takes two structures — habitat, laboratory, mine, foundry. Rivals claim land too, and there is not enough for everyone. “Go down to the base” shows it live: buildings, roads, people."),
    ("guide.cosmos.rule.colonies.body",
     "Su Luna e Marte la popolazione cresce da sola verso i posti che i tuoi progetti offrono. A ogni colonia dai un mandato — scienza, industria o commercio — che decide cosa manda a casa ogni settimana.",
     "On the Moon and Mars the population grows by itself toward the room your projects provide. You give each colony a mandate — science, industry or trade — that decides what it sends home every week."),
]

if __name__ == "__main__":
    from _merge import merge

    merge(ENTRIES)
