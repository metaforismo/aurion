# Aurion audio assets

This folder is the drop-target for all in-game music and sound effects. It
ships empty: real audio is licensed/recorded in a later wave. The audio
manager (`apps/web/lib/audio.ts`) is built to tolerate missing files —
if a clip 404s, the player still works, the manager logs a single warning
and stops trying to play that id.

## Layout

```
apps/web/public/audio/
├── manifest.json      # catalog the manager loads at startup
├── music/             # long, looping background beds
│   ├── menu.mp3
│   ├── gameplay.mp3
│   └── tension.mp3
└── sfx/               # one-shots
    ├── click.mp3
    ├── notification.mp3
    ├── event.mp3
    ├── tick.mp3
    ├── victory.mp3
    ├── defeat.mp3
    ├── tech-unlock.mp3
    ├── spy-success.mp3
    └── spy-detected.mp3
```

## Adding a new asset

1. Drop the file into `music/` or `sfx/` matching the manifest path.
2. If it's a brand-new id, add an entry to `manifest.json`:

   ```json
   "sfx.new-thing": { "src": "/audio/sfx/new-thing.mp3", "volume": 0.5 }
   ```

3. Use it from any client component:

   ```ts
   const audio = useAudio();
   audio.play('sfx.new-thing');
   ```

The manager reads the manifest exactly once at app mount; you don't need to
re-register anything in code.

## File format expectations

- **Primary container:** `.mp3` (best decoder support across browsers).
- **Optional fallback:** `.ogg` next to the `.mp3` for Firefox-on-old-Linux
  setups. The manager doesn't switch on it yet — when we add fallbacks it
  will look up `manifest[id].srcOgg` first.
- **Sample rate / bit depth:** 44.1 kHz, 16-bit, stereo.
- **Bit rate:** 96–128 kbps for music, 64–96 kbps for one-shot SFX.
- **Length:**
  - SFX: ≤ 1.5s for clicks/blips, ≤ 4s for cinematic stings.
  - Music: 60–180s loops; ensure they actually loop seamlessly
    (no leading/trailing silence; matched zero-crossings).
- **Loudness:** target around –16 LUFS integrated. Peaks no higher than –1 dBFS
  to leave headroom for the per-category volume curve in the manager.

## Licensing

Every file committed here MUST be one of:

- Original work owned by the project (record the contract / assignment).
- CC0 / public domain (record the source URL).
- Licensed under a compatible permissive licence (CC-BY 4.0 with attribution
  in this file). **Track attributions in `LICENSES.md` next to the asset.**

Do **not** commit anything from a paid library without verifying the licence
allows redistribution as part of an open client bundle. Streaming-only or
"use in your project" clauses are usually NOT enough — the file ships in
`public/` and is downloaded by every player.

## Sourcing checklist

When evaluating a candidate sample:

- [ ] Licence is permissive and recorded.
- [ ] No vocals (Aurion is multilingual; spoken English would clash).
- [ ] Loops cleanly (for music) or fades to digital silence (for SFX).
- [ ] Compresses to the bit rates above without artefacts.
- [ ] Sounds tonally consistent with the rest of the bed (cold-war strings,
      analog synth, low brass — not bright EDM).
