#!/usr/bin/env python3
"""Build a Linux bundle and execute its binary against an isolated fixture."""
import argparse
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--binary", type=Path, required=True)
    args = parser.parse_args()
    native = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory(prefix="ts4-package-") as temporary:
        root = Path(temporary)
        subprocess.run([
            "python3", str(native / "package.py"), "--binary", str(args.binary.resolve()),
            "--output", str(root / "artifacts"),
        ], check=True)
        archives = list((root / "artifacts").glob("*.tar.gz"))
        assert len(archives) == 1
        with tarfile.open(archives[0]) as archive:
            archive.extractall(root / "unpacked", filter="data")
        bundle, = (root / "unpacked").iterdir()
        executable = bundle / "bin/ts4-mod-manager-native"
        assert executable.stat().st_mode & 0o111
        desktop = (bundle / "share/applications/ts4-mod-manager-native.desktop").read_text()
        assert "Exec=ts4-mod-manager-native" in desktop
        assert "Icon=ts4-mod-manager-native" in desktop
        assert (bundle / "share/icons/hicolor/256x256/apps/ts4-mod-manager-native.png").is_file()
        licenses = bundle / "share/licenses/ts4-mod-manager-native"
        assert (licenses / "Inter-LICENSE.txt").is_file()
        assert (licenses / "Lucide-LICENSE.txt").is_file()
        dependencies = json.loads((licenses / "dependencies.json").read_text())
        assert any(package["name"] == "eframe" for package in dependencies)
        game = root / "fixture/The Sims 4"
        game.joinpath("Mods").mkdir(parents=True)
        package = game / "Mods/example.package"
        package.write_bytes(b"original package")
        output = subprocess.check_output([
            str(executable), "--inspect", "--root", str(game),
            "--managed-root", str(root / "absent-managed"),
        ], text=True)
        assert json.loads(output)["total"] == 1
        assert package.read_bytes() == b"original package"
        assert not root.joinpath("absent-managed").exists()
        print("Packaged executable, desktop entry, icon, licenses and fixture scan verified")


if __name__ == "__main__":
    main()
