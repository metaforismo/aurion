#!/usr/bin/env bash
# Downloads the CC0 materials and skies used by the close-up 3D views (the
# capital, the lunar and Martian bases) from Poly Haven, resizes them for
# the web and writes them under apps/web/public/base/.
#
#   bash scripts/assets/fetch-base-assets.sh
#
# Needs curl, python3 and ImageMagick (`convert`). Everything Poly Haven
# publishes is CC0; the list of what is used is written to LICENSES.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/apps/web/public/base"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT/tex" "$OUT/sky"

API="https://api.polyhaven.com"

# name:size — size is the edge in pixels the maps are resized to.
TEXTURES=(
  # Earth: streets, ground, walls, roofs
  asphalt_02:1024
  concrete_pavement:512
  grass_ground:1024
  herringbone_pavement:512
  red_brick_03:512
  white_plaster_rough_01:512
  yellow_plaster:512
  concrete_tile_facade:512
  rectangular_facade_tiles:512
  white_sandstone_blocks_02:512
  clay_roof_tiles_02:512
  tarred_gravel:512
  factory_brick:512
  rough_concrete:512
  # Moon
  moon_dusted_03:1024
  moon_track_01:512
  # Mars
  terrain_red_01:1024
  red_sand:512
)

fetch_json() { curl -sfL --retry 3 --max-time 60 "$API/$1" -o "$2"; }

for entry in "${TEXTURES[@]}"; do
  name="${entry%%:*}"
  size="${entry##*:}"
  fetch_json "files/$name" "$TMP/$name.json"
  for map in Diffuse nor_gl Rough; do
    url="$(python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d['$map']['1k']['jpg']['url'])" "$TMP/$name.json")"
    case "$map" in Diffuse) suffix=diff ;; nor_gl) suffix=nor ;; Rough) suffix=rough ;; esac
    curl -sfL --retry 3 --max-time 120 "$url" -o "$TMP/$name-$suffix.jpg"
    convert "$TMP/$name-$suffix.jpg" -resize "${size}x${size}" -strip -quality 82 "$OUT/tex/$name-$suffix.jpg"
  done
  echo "texture $name"
done

# The photographed lawn is a late-summer one; shift it to a watered green
# for parks, gardens and the fields around the capital.
convert "$OUT/tex/grass_ground-diff.jpg" -modulate 100,150,125 -quality 82 "$OUT/tex/lawn-diff.jpg"
mv "$OUT/tex/grass_ground-nor.jpg" "$OUT/tex/lawn-nor.jpg"
mv "$OUT/tex/grass_ground-rough.jpg" "$OUT/tex/lawn-rough.jpg"
rm "$OUT/tex/grass_ground-diff.jpg"

# Sky for the capital: a cloudy-noon pure sky. The tonemapped image is the
# background; the small HDR lights the scene and gives glass its reflections.
SKY=kloofendal_48d_partly_cloudy_puresky
fetch_json "files/$SKY" "$TMP/sky.json"
hdr="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['hdri']['1k']['hdr']['url'])" "$TMP/sky.json")"
jpg="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['tonemapped']['url'])" "$TMP/sky.json")"
curl -sfL --retry 3 --max-time 120 "$hdr" -o "$OUT/sky/earth.hdr"
curl -sfL --retry 3 --max-time 300 "$jpg" -o "$TMP/sky.jpg"
convert "$TMP/sky.jpg" -resize 4096x2048 -strip -quality 84 "$OUT/sky/earth.jpg"
# Where the sun is in that sky, so the shadows agree with it.
python3 - "$OUT/sky/earth.hdr" "$OUT/sky/earth.json" <<'PY'
import json, math, sys
data = open(sys.argv[1], 'rb').read()
head, _, body = data.partition(b'\n\n')
dims = body.split(b'\n', 1)
w = h = 0
parts = dims[0].split()
h, w = int(parts[1]), int(parts[3])
pix = dims[1]
best, bx, by, pos = -1.0, 0, 0, 0
for y in range(h):
    # New-style RLE scanlines.
    if pix[pos] != 2 or pix[pos + 1] != 2:
        raise SystemExit('unsupported HDR encoding')
    pos += 4
    chans = []
    for c in range(4):
        row = []
        while len(row) < w:
            n = pix[pos]; pos += 1
            if n > 128:
                row.extend([pix[pos]] * (n - 128)); pos += 1
            else:
                row.extend(pix[pos:pos + n]); pos += n
        chans.append(row)
    for x in range(w):
        e = chans[3][x]
        if e == 0:
            continue
        f = math.ldexp(1.0, e - 136)
        lum = (0.2126 * chans[0][x] + 0.7152 * chans[1][x] + 0.0722 * chans[2][x]) * f
        if lum > best:
            best, bx, by = lum, x, y
u = (bx + 0.5) / w
v = 1 - (by + 0.5) / h
phi = (u - 0.5) * 2 * math.pi
theta = (v - 0.5) * math.pi
sun = [math.cos(theta) * math.cos(phi), math.sin(theta), math.cos(theta) * math.sin(phi)]
json.dump({'sun': [round(c, 4) for c in sun]}, open(sys.argv[2], 'w'))
print('sun', sun)
PY

cat > "$OUT/LICENSES.md" <<MD
# Materials and skies for the 3D views

All from [Poly Haven](https://polyhaven.com), released under **CC0** (public
domain): no attribution required, credited here anyway. Downloaded and
resized by \`scripts/assets/fetch-base-assets.sh\`.

| File | Poly Haven asset |
| --- | --- |
$(for entry in "${TEXTURES[@]}"; do n="${entry%%:*}"; f="$n"; note=""; if [ "$n" = grass_ground ]; then f=lawn; note=" (recoloured)"; fi; echo "| \`tex/$f-*.jpg\` | [$n](https://polyhaven.com/a/$n)$note |"; done)
| \`sky/earth.jpg\`, \`sky/earth.hdr\` | [$SKY](https://polyhaven.com/a/$SKY) |
MD
du -sh "$OUT"
