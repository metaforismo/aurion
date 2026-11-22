"""Shared helper: merge (path, it, en) entries into apps/web/messages/*.json.

Every UI area keeps its copy in its own `<area>_messages.py` next to this
file and calls `merge(ENTRIES)`. Entries are authored as (dotted.path,
italian, english) so the two bundles can never drift out of key parity. A
file lock makes concurrent runs safe.
"""
import collections
import fcntl
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2] / "apps" / "web" / "messages"
LOCK = ROOT / ".merge.lock"


def _set(tree, path, value):
    node = tree
    parts = path.split(".")
    for part in parts[:-1]:
        child = node.get(part)
        if not isinstance(child, dict):
            child = collections.OrderedDict()
            node[part] = child
        node = child
    node[parts[-1]] = value


def _delete(tree, path):
    node = tree
    parts = path.split(".")
    for part in parts[:-1]:
        node = node.get(part)
        if not isinstance(node, dict):
            return
    node.pop(parts[-1], None)


def merge(entries, remove=()):
    """Write `entries` into both locale files; drop the dotted paths in `remove`."""
    with open(LOCK, "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        for index, locale in enumerate(("it", "en")):
            file = ROOT / f"{locale}.json"
            tree = json.loads(file.read_text(), object_pairs_hook=collections.OrderedDict)
            for path in remove:
                _delete(tree, path)
            for entry in entries:
                _set(tree, entry[0], entry[1 + index])
            file.write_text(json.dumps(tree, ensure_ascii=False, indent=2) + "\n")
