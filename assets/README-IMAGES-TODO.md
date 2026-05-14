# Screenshots TODO

This directory holds marketing/README screenshots. We need the following before the README looks like a real OSS project instead of a placeholder.

## Required screenshots

| Filename | What | Notes |
|---|---|---|
| `home.png` | Home screen at `/` — logo, "Nuova partita", "Continua" with a save slot, language selector | Use IT locale, with at least one save slot populated |
| `new-game-wizard.png` | New-game wizard at `/new` — ideally the win-condition step (most visually interesting) | Show all 5 victory conditions selectable |
| `play-screen.png` | Main `/play/[saveId]` screen with map + HUD + at least one panel open | Open the Spie panel mid-operation for visual interest; show notification stream populated |

## Optional / nice-to-have

- `play-screen-event-modal.png` — narrative event modal mid-decision
- `tech-tree.png` — research panel zoomed out
- `victory.png` — end-of-game summary screen
- `social-card.png` — 1280×640, OG / social preview

## Conventions

- Format: PNG, 16:9 where reasonable, max width 2560px.
- Capture in **light mode** (or whatever the canonical theme ends up being once Visual Polish lands).
- Crop browser chrome out — just the app surface.
- File size: keep each under ~500 KB. Run through [`squoosh`](https://squoosh.app/) or `pngquant` before committing.
- Once added, link them from the root `README.md` "Screenshots" section.

Delete this file once the canonical three screenshots above are in place.
