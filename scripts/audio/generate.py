#!/usr/bin/env python3
"""Regenerate every Aurion sound from scripts/audio/spec.json.

Every sample is rendered by `earshot` (https://github.com/Leonxlnx/earshot),
a CPU-only, model-free sound renderer. ffmpeg is only used to place, layer,
fade, level and encode those renders -- it synthesises nothing.

Usage:
    EARSHOT=/path/to/venv/bin/earshot python3 scripts/audio/generate.py
    python3 scripts/audio/generate.py --only sfx.click music.space
    python3 scripts/audio/generate.py --check        # only re-measure outputs

Env:
    EARSHOT  earshot executable (default: `earshot` on PATH)
    FFMPEG   ffmpeg executable  (default: `ffmpeg`);  FFPROBE likewise.

Needs python >= 3.9 (stdlib only), earshot >= 1.0 and ffmpeg with libopus and
libmp3lame. Renders are cached in scripts/audio/.cache (safe to delete).

Outputs (under apps/web/public/audio/):
    sfx/<name>.webm + .mp3     one-shots (Opus first, MP3 for old Safari)
    music/<name>.webm + .mp3   seamless loops
    manifest.json              what apps/web/lib/audio.ts loads
and scripts/audio/report.json with the measured duration / peak / loudness
of every encoded file.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
OUT = REPO / "apps" / "web" / "public" / "audio"
CACHE = HERE / ".cache"
EARSHOT = os.environ.get("EARSHOT", "earshot")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
FFPROBE = os.environ.get("FFPROBE", "ffprobe")

AXES = ("bright", "hard", "ring", "size", "space", "width", "energy", "motion")


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    p = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, **kw)
    if p.returncode != 0:
        sys.stderr.write(f"\nFAILED: {' '.join(str(c) for c in cmd)}\n{p.stdout}\n{p.stderr}\n")
        raise SystemExit(1)
    return p


# --------------------------------------------------------------------------
# earshot renders (cached by argument hash)
# --------------------------------------------------------------------------

def earshot_args(layer: dict, seed: int) -> list[str]:
    args: list[str] = []
    if layer.get("want"):
        args.append(layer["want"])
    if layer.get("sound"):
        args += ["--sound", layer["sound"]]
    args += ["--seed", str(layer.get("seed", seed))]
    for key in ("dur", "pitch", "theme", "voice", "material", "events"):
        if layer.get(key) is not None:
            args += [f"--{key}", str(layer[key])]
    for axis in AXES:
        if layer.get(axis) is not None:
            args += [f"--{axis}", str(layer[axis])]
    return args


def render(layer: dict, seed: int) -> Path:
    args = earshot_args(layer, seed)
    key = hashlib.sha1(json.dumps(args).encode()).hexdigest()[:16]
    wav = CACHE / f"{key}.wav"
    if not wav.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        tmp = CACHE / f"{key}.tmp.wav"
        p = run([EARSHOT, "make", *args, "-o", tmp])
        tmp.rename(wav)
        note = (p.stdout.strip().splitlines() or [""])[-1]
        (CACHE / f"{key}.txt").write_text(" ".join(args) + "\n" + p.stdout + p.stderr)
        print(f"    earshot {' '.join(args)}\n      -> {note.split(': ', 1)[-1]}")
    return wav


def expand(layers: list[dict]) -> list[dict]:
    """Expand the `notes` shorthand: [[pitch, at, gain_db?], ...]."""
    out: list[dict] = []
    for layer in layers:
        if "notes" not in layer:
            out.append(layer)
            continue
        base = {k: v for k, v in layer.items() if k != "notes"}
        for note in layer["notes"]:
            one = dict(base)
            if note[0] is not None:
                one["pitch"] = note[0]
            one["at"] = note[1]
            one["gain"] = base.get("gain", 0) + (note[2] if len(note) > 2 else 0)
            out.append(one)
    return out


# --------------------------------------------------------------------------
# ffmpeg mixing
# --------------------------------------------------------------------------

def duration(path: Path) -> float:
    p = run([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
    return float(p.stdout.strip())


def measure(path: Path) -> dict:
    p = run([FFMPEG, "-hide_banner", "-nostats", "-i", path, "-af",
             "volumedetect,ebur128=framelog=quiet", "-f", "null", "-"])
    err = p.stderr
    peak = float(re.search(r"max_volume: (-?[\d.]+|-inf) dB", err).group(1))
    mean = float(re.search(r"mean_volume: (-?[\d.]+|-inf) dB", err).group(1))
    lufs_m = re.findall(r"I:\s+(-?[\d.]+) LUFS", err)
    lufs = float(lufs_m[-1]) if lufs_m else None
    return {"duration_s": round(duration(path), 3), "peak_db": peak, "mean_db": mean, "lufs": lufs}


def layer_chain(layer: dict, src_dur: float) -> tuple[str, float]:
    """ffmpeg filter chain for one layer; returns (chain, end time on the timeline)."""
    f: list[str] = ["aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo"]
    start = float(layer.get("start", 0))
    length = src_dur - start
    if layer.get("trim") is not None:
        length = min(length, float(layer["trim"]))
    if start or layer.get("trim") is not None:
        f.append(f"atrim=start={start}:duration={length}")
        f.append("asetpts=PTS-STARTPTS")
    if layer.get("highpass"):
        f.append(f"highpass=f={layer['highpass']}")
    if layer.get("lowpass"):
        f.append(f"lowpass=f={layer['lowpass']}")
    if layer.get("fade_in"):
        f.append(f"afade=t=in:st=0:d={layer['fade_in']}:curve=qsin")
    if layer.get("fade_out"):
        d = min(float(layer["fade_out"]), length)
        f.append(f"afade=t=out:st={length - d:.4f}:d={d}:curve=qsin")
    if layer.get("gain"):
        f.append(f"volume={layer['gain']}dB")
    if layer.get("pan") is not None:  # -1 (left) .. 1 (right), constant-ish power
        p = max(-1.0, min(1.0, float(layer["pan"])))
        left, right = min(1.0, 1 - p), min(1.0, 1 + p)
        f.append(f"pan=stereo|c0={left:.3f}*c0|c1={right:.3f}*c1")
    at = float(layer.get("at", 0))
    if at > 0:
        f.append(f"adelay={int(round(at * 1000))}:all=1")
    return ",".join(f), at + length


def mix(item: dict, seed: int, dest: Path) -> None:
    layers = expand(item["layers"])
    cmd: list[str] = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y"]
    chains: list[str] = []
    end = 0.0
    for i, layer in enumerate(layers):
        wav = render(layer, seed)
        cmd += ["-i", wav]
        chain, layer_end = layer_chain(layer, duration(wav))
        end = max(end, layer_end)
        chains.append(f"[{i}:a]{chain}[l{i}]")
    n = len(layers)
    labels = "".join(f"[l{i}]" for i in range(n))
    graph = ";".join(chains) + f";{labels}amix=inputs={n}:normalize=0:dropout_transition=0[m]"
    post: list[str] = []
    loop_len = item.get("length") if item.get("loop") else None
    if loop_len:
        # Wrap the timeline: whatever rings past `length` is folded back onto
        # the start, so the file loops with no seam and no crossfade smear.
        L = float(loop_len)
        if end > 2 * L:
            raise SystemExit(f"{item['id']}: layers run past 2x the loop length ({end:.1f}s)")
        post.append(f"apad=whole_dur={2 * L}")
        post.append(f"atrim=0:{2 * L}")
    else:
        total = float(item["trim"]) if item.get("trim") else end
        post.append(f"atrim=0:{total}")
        fo = float(item.get("fade_out", 0.02))
        post.append(f"afade=t=out:st={max(0.0, total - fo):.4f}:d={fo}")
    if item.get("highpass"):
        post.append(f"highpass=f={item['highpass']}")
    if item.get("lowpass"):
        post.append(f"lowpass=f={item['lowpass']}")
    graph += f";[m]{','.join(post) if post else 'anull'}[out]"
    if not loop_len:
        run(cmd + ["-filter_complex", graph, "-map", "[out]", "-c:a", "pcm_f32le", dest])
        return
    # Second pass: fold the second half of the 2L timeline onto the first.
    L = float(loop_len)
    long = dest.with_name(dest.stem + ".unwrapped.wav")
    run(cmd + ["-filter_complex", graph, "-map", "[out]", "-c:a", "pcm_f32le", long])
    run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
         "-t", str(L), "-i", long, "-ss", str(L), "-t", str(L), "-i", long,
         "-filter_complex", f"[0:a][1:a]amix=inputs=2:normalize=0:dropout_transition=0,atrim=0:{L}[out]",
         "-map", "[out]", "-c:a", "pcm_f32le", dest])


def master(item: dict, raw: Path, defaults: dict) -> Path:
    """Level the mix: peak ceiling for one-shots, loudness target for loops."""
    m = measure(raw)
    ceiling = float(item.get("peak", defaults["peak"]))
    gain = ceiling - m["peak_db"]
    if item.get("loop"):
        target = float(item.get("lufs", defaults["music_lufs"]))
        if m["lufs"] is not None:
            gain = min(gain, target - m["lufs"])
    out = raw.with_name(raw.stem + ".master.wav")
    stereo = bool(item.get("stereo", item.get("loop", False)))
    run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-af", f"volume={gain:.2f}dB",
         "-ac", "2" if stereo else "1", "-c:a", "pcm_s24le", out])
    return out


def encode(item: dict, wav: Path, defaults: dict) -> dict[str, Path]:
    kind, name = item["id"].split(".", 1)
    folder = OUT / kind
    folder.mkdir(parents=True, exist_ok=True)
    stereo = bool(item.get("stereo", item.get("loop", False)))
    cls = "music" if item.get("loop") else ("sfx_stereo" if stereo else "sfx_mono")
    opus_k, mp3_k = defaults["bitrates"][cls]
    opus_k = item.get("opus_kbps", opus_k)
    mp3_k = item.get("mp3_kbps", mp3_k)
    webm, mp3 = folder / f"{name}.webm", folder / f"{name}.mp3"
    common = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-map_metadata", "-1",
              "-fflags", "+bitexact", "-flags:a", "+bitexact"]
    run(common + ["-c:a", "libopus", "-b:a", f"{opus_k}k", "-vbr", "on", "-application", "audio", webm])
    run(common + ["-ar", "44100", "-c:a", "libmp3lame", "-b:a", f"{mp3_k}k", "-write_xing", "1",
                  "-id3v2_version", "0", mp3])
    return {"webm": webm, "mp3": mp3}


# --------------------------------------------------------------------------

def check(item: dict, m: dict, fmt: str) -> list[str]:
    problems = []
    if m["mean_db"] < -55:
        problems.append("near silent")
    if m["peak_db"] > -0.1:
        problems.append("peak at/over full scale (clipping risk)")
    if m["peak_db"] < -12:
        problems.append("very quiet peak")
    if item.get("loop") and fmt == "webm" and abs(m["duration_s"] - float(item["length"])) > 0.05:
        problems.append(f"loop length {m['duration_s']} != {item['length']}")
    return problems


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", nargs="*", help="ids (or prefixes) to regenerate")
    ap.add_argument("--check", action="store_true", help="only measure the existing outputs")
    ap.add_argument("--spec", default=str(HERE / "spec.json"))
    opts = ap.parse_args()

    spec = json.loads(Path(opts.spec).read_text())
    defaults = spec["defaults"]
    items = spec["sounds"]
    ids = [it["id"] for it in items]
    assert len(ids) == len(set(ids)), "duplicate ids in spec"

    if not opts.check:
        for tool in (EARSHOT, FFMPEG, FFPROBE):
            if shutil.which(tool) is None:
                raise SystemExit(f"{tool!r} not found. Set EARSHOT / FFMPEG / FFPROBE.")
        ver = run([EARSHOT, "--version"]).stdout.strip()
        print(f"using {ver}")

    report: dict[str, dict] = {}
    report_path = HERE / "report.json"
    if report_path.exists():
        report = json.loads(report_path.read_text()).get("files", {})
    bad = 0
    for item in items:
        sid = item["id"]
        kind, name = sid.split(".", 1)
        selected = not opts.only or any(sid == o or sid.startswith(o) for o in opts.only)
        if selected and not opts.check:
            print(f"== {sid}")
            CACHE.mkdir(parents=True, exist_ok=True)
            raw = CACHE / f"mix.{sid}.wav"
            mix(item, int(item.get("seed", defaults["seed"])), raw)
            files = encode(item, master(item, raw, defaults), defaults)
        else:
            files = {f: OUT / kind / f"{name}.{f}" for f in ("webm", "mp3")}
        if not selected:
            continue
        for fmt, path in files.items():
            if not path.exists():
                print(f"   MISSING {path}")
                bad += 1
                continue
            m = measure(path)
            m["bytes"] = path.stat().st_size
            problems = check(item, m, fmt)
            bad += len(problems)
            report[f"{kind}/{name}.{fmt}"] = m
            flag = ("  !! " + "; ".join(problems)) if problems else ""
            print(f"   {kind}/{name}.{fmt:<4} {m['duration_s']:7.2f}s  peak {m['peak_db']:6.1f} dB  "
                  f"mean {m['mean_db']:6.1f} dB  {m['bytes'] / 1024:7.1f} kB{flag}")

    # manifest.json: always rewritten in full from the spec
    manifest: dict[str, dict] = {}
    for item in items:
        kind, name = item["id"].split(".", 1)
        entry: dict = {"src": f"/audio/{kind}/{name}.webm", "fallback": f"/audio/{kind}/{name}.mp3",
                       "volume": item["volume"]}
        if item.get("loop"):
            entry["loop"] = True
        if item.get("minIntervalMs"):
            entry["minIntervalMs"] = item["minIntervalMs"]
        manifest[item["id"]] = entry
    lines = [f'  {json.dumps(k)}: {json.dumps(v)}' for k, v in manifest.items()]
    (OUT / "manifest.json").write_text("{\n" + ",\n".join(lines) + "\n}\n")

    total = sum(v["bytes"] for v in report.values())
    report_path.write_text(json.dumps({"total_bytes": total, "files": dict(sorted(report.items()))}, indent=1) + "\n")
    print(f"\n{len(report)} files, {total / 1e6:.2f} MB total; manifest.json has {len(manifest)} ids")
    if bad:
        raise SystemExit(f"{bad} problem(s) flagged above")


if __name__ == "__main__":
    main()
