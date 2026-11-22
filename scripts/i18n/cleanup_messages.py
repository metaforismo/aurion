"""Remove copy for UI that no longer exists. Run: python3 scripts/i18n/cleanup_messages.py"""

REMOVE = [
    "panelShared",
    "victoryScreen",
    "onboarding",
    "advisor",
    "objectives",
]

if __name__ == "__main__":
    from _merge import merge

    merge([], remove=REMOVE)
