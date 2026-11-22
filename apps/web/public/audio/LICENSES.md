# Audio licences

## Summary

All files under `apps/web/public/audio/music/` and `apps/web/public/audio/sfx/`
were rendered for this project with **earshot 1.0.0**
(<https://github.com/Leonxlnx/earshot>, MIT-licensed code, © Leon Lin) by
`scripts/audio/generate.py` from `scripts/audio/spec.json`, then mixed and
encoded with ffmpeg. They contain no third-party recordings, samples or music.

Per earshot's README ("Licence"):

> Everything earshot renders (`make`, `sfx`, `kit`, `forge`) belongs to whoever
> rendered it: free for any use, commercial too, without credit.

So the files belong to the Aurion project and may be redistributed with the
client bundle. No attribution is required; this file exists for provenance.

## Where the sounds inside earshot come from

earshot ships no audio recordings. Its sounds are of three kinds:

- **Synthesised** designs (UI tones, pads, drones, whooshes, risers, braams,
  impacts, laser / power-up figures): generated in code.
- **Learned** sounds (footsteps, coins, stamp, camera shutter, gun reload,
  rocket launch, explosions, thunder, wind and other ambience), **drum
  strokes** and **instrument notes** (harp, felt piano, glockenspiel,
  vibraphone, tubular bell, singing bowl, wine glass, timpani, frame drum,
  brass …): statistical models fitted to recordings that are in the **public
  domain** — CC0 or an explicit public-domain dedication — from BigSoundBank,
  Kenney, VCSL, VSCO-2 CE, Karoryfer and CC0 uploads on Freesound. Each render
  is a new take generated from those models, not a copy of a recording.
- **Fitted** bank sounds: derived from CC0 recordings.

CC0 asks for no credit; earshot credits every source recording anyway. The
full lists are in the earshot repository / package:

- `earshot/data/textures/CREDITS.md` (learned sounds and ambience)
- `earshot/data/drums/CREDITS.md` (drum strokes)
- `earshot/data/notes/CREDITS.md` (instrument notes)
- `earshot/data/resyn/CREDITS.md`
- `docs/CREDITS_FIT.md` (fitted sounds)

## Per-file provenance

Every file maps to one entry in `scripts/audio/spec.json`, which lists the
exact earshot design ids, seeds and parameters of each layer. To audit a file,
look up its id there (`sfx/launch.webm` → `sfx.launch` → `rocket/launch`,
`countdown/beep`) and, for learned sounds, the design's sources in the earshot
credit files above.

| files | origin | licence |
|---|---|---|
| `sfx/*.webm`, `sfx/*.mp3` (28 one-shots) | earshot renders, layered with ffmpeg | owned by the project; free for any use |
| `music/*.webm`, `music/*.mp3` (5 loops) | earshot renders (pads, drones, notes, percussion, ambience), layered with ffmpeg | owned by the project; free for any use |

## Tools

- earshot 1.0.0 — MIT.
- ffmpeg (libopus, libmp3lame) — used as a tool only; no ffmpeg code is
  distributed with the game.

## Rule for future additions

Anything added here must be either an earshot render added through
`spec.json`, original work owned by the project, or CC0 / public domain / a
permissive licence that allows redistribution in a public client bundle — and
it must be recorded in this file with its source.
