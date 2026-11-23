"""Faction leverage copy. Run: python3 scripts/i18n/politics_messages.py"""

P = "panelPolitics.leverage"

ENTRIES = [
    (f"{P}.loyal", "Con te, da {at}%", "Behind you, from {at}%"),
    (f"{P}.hostile", "Contro di te, fino a {at}%", "Against you, up to {at}%"),
    (f"{P}.inForce", "in vigore", "in force"),
    (f"{P}.incomeMul", "{v} entrate", "{v} income"),
    (f"{P}.researchMul", "{v} ricerca", "{v} research"),
    (f"{P}.combatMul", "{v} forza in battaglia", "{v} combat power"),
    (f"{P}.growthMul", "{v} crescita del PIL", "{v} GDP growth"),
    (f"{P}.popularity", "{v} consenso a settimana", "{v} approval a week"),
]

if __name__ == "__main__":
    from _merge import merge

    merge(ENTRIES)
