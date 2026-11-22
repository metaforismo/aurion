# Aurion audio assets

Every sound in this folder was rendered with
[**earshot**](https://github.com/Leonxlnx/earshot) (v1.0.0), a CPU-only,
model-free command-line tool that makes sound files from plain-language
requests. Nothing here was recorded, bought or downloaded from a sample
library, and no generative-AI audio model was involved. `ffmpeg` is used only
to place, layer, fade, level and encode the earshot renders — it synthesises
nothing.

The whole folder is reproducible from two files:

- `scripts/audio/spec.json` — every sound: id, earshot design id / request,
  seed, pitch, duration, layers, loudness, manifest volume, throttle.
- `scripts/audio/generate.py` — renders the spec, encodes it, measures the
  result and rewrites `manifest.json`.

## Layout

```
apps/web/public/audio/
├── manifest.json      # generated — what lib/audio.ts loads at startup
├── README.md
├── LICENSES.md
├── music/             # 5 seamless loops, .webm (Opus) + .mp3
└── sfx/               # 28 one-shots,     .webm (Opus) + .mp3
```

## Regenerating

```bash
# once: earshot into a virtualenv (needs Python >= 3.10) + ffmpeg on PATH
python3 -m venv .venv-audio
.venv-audio/bin/pip install "earshot @ git+https://github.com/Leonxlnx/earshot"

# everything (about 4 minutes on 4 cores; the first run compiles numba)
EARSHOT=.venv-audio/bin/earshot python3 scripts/audio/generate.py

# only some ids (exact id or prefix)
EARSHOT=... python3 scripts/audio/generate.py --only sfx.click music.space

# re-measure the committed files without rendering
python3 scripts/audio/generate.py --check
```

`EARSHOT` defaults to `earshot` on `PATH` (`FFMPEG` / `FFPROBE` likewise).
Renders are cached in `scripts/audio/.cache/` (git-ignored). Seeds are fixed in
the spec, so a re-run with the same earshot version gives the same audio.
The script fails if an output is near silent, too quiet, at full scale, or if
a loop is not exactly its declared length; the measurements land in
`scripts/audio/report.json`.

Browse what earshot can make with `earshot sounds --search "rocket"` or
`earshot sounds --domain ui|game|motion|ambience|music`. It understands a named
sound ("a coin dropped on a table") much better than a mood ("something
hopeful").

## Adding or changing a sound

1. Add / edit an entry in `scripts/audio/spec.json`:

   ```json
   { "id": "sfx.new-thing", "volume": 0.5, "minIntervalMs": 200,
     "layers": [ { "sound": "coin/drop" }, { "sound": "whoosh/soft", "at": 0.1, "gain": -8 } ] }
   ```

2. Run `generate.py --only sfx.new-thing` (it rewrites `manifest.json`).
3. Add the id to the `SfxId` / `MusicId` union in `apps/web/lib/audio.ts`
   (autocompletion only — unknown ids are accepted and no-op).
4. Use it: `const sfx = useSfx(); sfx('sfx.new-thing');`

Do not hand-edit `manifest.json`; it is overwritten on every run.

## Formats

| | container | codec | channels | bitrate |
|---|---|---|---|---|
| UI one-shots | `.webm` / `.mp3` | Opus / MP3 | mono | 48 / 64 kbps |
| big one-shots | `.webm` / `.mp3` | Opus / MP3 | stereo | 64 / 96 kbps |
| music loops | `.webm` / `.mp3` | Opus / MP3 | stereo | 64 / 64 kbps |

- The manifest lists the WebM as `src` and the MP3 as `fallback`. The manager
  asks the browser (`canPlayType`) and uses the MP3 where Opus-in-WebM is not
  supported (older Safari / iOS), or if the WebM fails to load.
- One-shots peak at about −3 dBFS (`sfx.hover` and `sfx.tick` at −8); loops are
  levelled to −20 / −22 LUFS. Relative loudness in the game is set by the
  per-id `volume` in the spec, multiplied by the user's category volume.
- **Loops.** The loops are built on a timeline twice the loop length and the
  second half is folded back onto the first, so tails ring across the loop
  point and the WebM/Opus files repeat without a seam. The **MP3 fallback has
  a short gap (~50 ms) at the loop point** once per 32–60 s — that is inherent
  to MP3 encoder padding and is only heard on browsers that cannot play the
  WebM.

## What the music is (and is not)

earshot does not compose music; it says so itself. It offers three short
ready-made beds (lo-fi, playful, chiptune — none fits Aurion and none is used)
plus pads, drones, single instrument notes, percussion strokes and seamless
ambience loops. The five `music.*` files are **ambient underscore beds**
assembled from those parts: held pad chords in a slow four-chord progression,
a handful of single harp / felt-piano / singing-bowl notes placed on chord
tones, low drums, and wind / room / ship-hum ambience underneath. They have
harmony and a pulse of sorts but no real melody, arrangement or development,
and they repeat every 32–60 seconds. Treat them as placeholders-with-dignity:
fine as a quiet bed, not a soundtrack.

| id | length | made of |
|---|---|---|
| `music.menu` | 48 s | string + warm pads (D – B♭ – F – C), harp notes, two tubular bells, faint wind |
| `music.gameplay` | 60 s | warm pads (G – C – G – D), airy fifths, sparse felt-piano notes, room tone |
| `music.tension` | 48 s | dark drone on D, airy fifths rocking D ↔ E♭, low brass, heartbeat frame drum, timpani, gong swell, mountain wind |
| `music.space` | 60 s | ship hum, dark drone on C, glass pads, singing bowls, wine-glass tones, faint sparkle |
| `music.victory` | 32 s | string + warm pads (C – F – G – C), rising harp arpeggios, glockenspiel |

No sound was auditioned by a human while this folder was produced: the
designs were chosen from earshot's catalogue descriptions and verified by
measurement only (duration, peak, loudness, spectrum, loop seam). Listen
before shipping and tune `spec.json` where something is off.

## Runtime

`apps/web/lib/audio.ts` (manager) and `apps/web/components/Audio/` (React
provider + hooks):

```ts
const sfx = useSfx();            // safe without a provider
sfx('sfx.click');

const audio = useAudio();        // inside <AudioProvider>
audio.play('sfx.launch');
audio.playMusic('music.space');  // crossfades from the current bed
audio.stopMusic();

useMusic('music.menu');          // declarative bed for a screen
useGameplayMusic({ override: inOrbitView ? 'music.space' : null });
```

The manager lazy-loads files, survives missing ones, throttles each one-shot
(`minIntervalMs` in the manifest, 40 ms by default), crossfades beds, starts a
bed blocked by the browser autoplay policy on the first user gesture, and
honours the music / SFX mutes and volumes.
