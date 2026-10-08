#!/usr/bin/env python3
"""Exercise the native executable against temporary catalogs; preserve all inputs."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile


def snapshot(root):
    return {
        str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in root.rglob("*") if path.is_file()
    }


def run(binary, *args):
    result = subprocess.run([str(binary), *map(str, args)], check=True, text=True,
                            capture_output=True, timeout=60)
    return json.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=Path(__file__).parent / "target/debug/ts4-mod-manager-native")
    parser.add_argument("--sizes", type=int, nargs="+", default=[100, 1000, 10000])
    parser.add_argument("--capture-dir", type=Path, help="Also run native renderer and save desktop, dark, and narrow PNGs")
    args = parser.parse_args()
    binary = args.binary.resolve()
    if not binary.is_file():
        parser.error("Build the native executable first with cargo build --manifest-path native/Cargo.toml --locked")
    if any(size < 2 or size > 100000 for size in args.sizes):
        parser.error("Catalog sizes must be between 2 and 100000")
    for size in args.sizes:
        with tempfile.TemporaryDirectory(prefix="ts4-native-fixture-") as directory:
            fixture = Path(directory)
            home = fixture / "home"
            home.mkdir()
            root = fixture / "The Sims 4"
            managed = fixture / "managed-not-created"
            for index in range(size):
                name = "Café Kitchen Collection" if index == 0 else f"Everyday Collection Item{index:05}"
                group = root / "Mods" / name
                group.mkdir(parents=True)
                (group / f"collection_{index:05}.package").write_bytes(b"synthetic catalog fixture")
            first = root / "Mods/Café Kitchen Collection"
            for index in range(64):
                (first / f"Kitchen_Component_{index:03}.package").write_bytes(b"synthetic detail fixture")
            before = snapshot(fixture)
            base = ["--home", home, "--root", root, "--managed-root", managed]
            catalog = run(binary, *base, "--inspect")
            assert catalog["total"] == size, catalog["total"]
            assert catalog["matches"] == size
            assert all(mod["enabled"] and mod["source"] == "external" for mod in catalog["mods"])
            filtered = run(binary, *base, "--inspect", "--query", "CAFÉ")
            assert filtered["matches"] == 1
            filenames = run(binary, *base, "--inspect", "--query", "Kitchen_Component_063")
            assert filenames["matches"] == 1
            no_matches = run(binary, *base, "--inspect", "--query", "no-matching-fixture")
            assert no_matches["matches"] == 0
            invalid = subprocess.run([str(binary), "--root", str(fixture / "missing"), "--inspect"],
                                     capture_output=True, text=True, timeout=10)
            assert invalid.returncode != 0
            if args.capture_dir and size == args.sizes[0]:
                args.capture_dir.mkdir(parents=True, exist_ok=True)
                for name, flags in [("desktop.png", []), ("dark.png", ["--dark"]),
                                    ("narrow.png", ["--size", "680x760"])]:
                    path = args.capture_dir.resolve() / name
                    subprocess.run([str(binary), *map(str, base), "--screenshot", str(path), *flags],
                                   check=True, timeout=60)
                    assert path.read_bytes().startswith(b"\x89PNG\r\n\x1a\n"), path
            assert snapshot(fixture) == before, "Native inspection changed input files"
            assert not managed.exists(), "Native inspection created managed storage"
            print(json.dumps({"mods": size, "scanMs": catalog["scanMs"], "searchMs": filtered["searchMs"],
                              "unicodeMatches": filtered["matches"], "inputsUnchanged": True}))


if __name__ == "__main__":
    main()
