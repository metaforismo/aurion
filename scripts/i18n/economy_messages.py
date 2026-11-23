"""Investment with diminishing returns. Run: python3 scripts/i18n/economy_messages.py"""

I = "panelEconomy.invest"

ENTRIES = [
    (f"{I}.target.economy.rate", "Fino a 4 euro di PIL per euro", "Up to 4 euros of GDP per euro"),
    (f"{I}.target.infra.rate", "Fino a 2 euro di PIL per euro, più popolarità", "Up to 2 euros of GDP per euro, plus popularity"),
    (f"{I}.target.research.rate", "Laboratori più produttivi, per sempre", "More productive labs, for good"),
    (f"{I}.preview.saturated",
     "Rende il {pct} del normale: è una somma grande rispetto al PIL, o hai già investito molto di recente. Somme più piccole e distanziate rendono di più.",
     "It returns {pct} of the usual: the sum is large next to your GDP, or you have invested a lot lately. Smaller sums, spaced out, return more."),
    (f"{I}.shareHint",
     "Quota della tesoreria di oggi. Somme grandi rispetto al PIL rendono meno, euro per euro.",
     "Share of today's treasury. Sums that are large next to your GDP return less, euro for euro."),
]

if __name__ == "__main__":
    from _merge import merge

    merge(ENTRIES)
