#!/usr/bin/env python3
"""Measure Linux window mapping and process-tree memory on isolated catalogs."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import statistics
import subprocess
import tempfile
import time


def memory_totals(root_pid, proc=Path("/proc")):
    parents = {}
    for entry in proc.iterdir():
        if entry.name.isdigit():
            try:
                status = entry.joinpath("status").read_text()
                parent = next(line.split()[1] for line in status.splitlines() if line.startswith("PPid:"))
                parents[int(entry.name)] = int(parent)
            except (OSError, StopIteration, ValueError):
                continue
    included = {root_pid} if root_pid in parents else set()
    while True:
        descendants = {pid for pid, parent in parents.items() if parent in included}
        if descendants <= included:
            break
        included |= descendants
    result = {"processes": 0, "rssKiB": 0, "pssKiB": 0}
    for pid in included:
        try:
            fields = dict(line.split(":", 1) for line in proc.joinpath(str(pid), "smaps_rollup").read_text().splitlines() if ":" in line)
            result["rssKiB"] += int(fields["Rss"].split()[0])
            result["pssKiB"] += int(fields["Pss"].split()[0])
            result["processes"] += 1
        except (OSError, KeyError, ValueError):
            continue
    return result


def mapped_window(pid):
    clients = json.loads(subprocess.check_output(["hyprctl", "-j", "clients"], text=True))
    return any(client.get("pid") == pid and client.get("mapped", False) for client in clients)


def sample(binary, kind, home, game, settle_seconds):
    environment = dict(os.environ)
    environment.update({"HOME": str(home), "XDG_DATA_HOME": str(home / ".local/share"),
                        "XDG_CONFIG_HOME": str(home / ".config"), "XDG_CACHE_HOME": str(home / ".cache")})
    command = [str(binary)]
    command += ["--home", str(home), "--root", str(game), "--managed-root", str(home / "managed")]
    started = time.perf_counter()
    with tempfile.TemporaryFile() as errors:
        process = subprocess.Popen(command, env=environment, stdout=errors, stderr=errors, start_new_session=True)
        peak = {"processes": 0, "rssKiB": 0, "pssKiB": 0}
        mapped_ms = None
        settled = None
        try:
            deadline = started + 30
            while time.perf_counter() < deadline:
                if process.poll() is not None:
                    raise RuntimeError(f"{kind} exited before its window mapped, status {process.returncode}")
                memory = memory_totals(process.pid)
                for field in peak:
                    peak[field] = max(peak[field], memory[field])
                if mapped_ms is None and mapped_window(process.pid):
                    mapped_ms = (time.perf_counter() - started) * 1000
                now = time.perf_counter()
                if mapped_ms is not None and (now - started) * 1000 >= mapped_ms + settle_seconds * 1000:
                    settled = memory
                    break
                time.sleep(0.05)
            if settled is None:
                raise RuntimeError(f"{kind} did not map a window within 30 seconds")
            return {"mappedMs": mapped_ms, "settled": settled, "peak": peak}
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--native", type=Path, required=True)
    parser.add_argument("--mods", type=int, default=1000)
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--settle-seconds", type=float, default=2)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not shutil.which("hyprctl") or not os.environ.get("HYPRLAND_INSTANCE_SIGNATURE"):
        parser.error("This window-mapping comparison requires a running Hyprland desktop")
    if not 2 <= args.mods <= 100000 or not 1 <= args.runs <= 20 or not 0.5 <= args.settle_seconds <= 30:
        parser.error("Use 2–100000 mods, 1–20 runs and 0.5–30 settling seconds")
    binaries = {"native": args.native.resolve()}
    for binary in binaries.values():
        if not binary.is_file() or not os.access(binary, os.X_OK):
            parser.error(f"Executable unavailable: {binary}")
    report = {"mods": args.mods, "runs": args.runs, "settleSeconds": args.settle_seconds,
              "metric": "First mapped window, not first completed catalog frame",
              "memory": "Process-tree PSS apportions shared pages; RSS totals count shared pages per process",
              "results": {}}
    for kind, binary in binaries.items():
        samples = []
        for _ in range(args.runs):
            with tempfile.TemporaryDirectory(prefix="ts4-performance-") as temporary:
                home = Path(temporary) / "home"
                game = home / "Documents/Electronic Arts/The Sims 4"
                mods = game / "Mods"
                for index in range(args.mods):
                    group = mods / f"Collection {index:05}"
                    group.mkdir(parents=True)
                    group.joinpath(f"collection_{index:05}.package").write_bytes(b"synthetic performance fixture")
                files = sorted(mods.rglob("*.package"))
                before = {str(file.relative_to(mods)): file.read_bytes() for file in files}
                samples.append(sample(binary, kind, home, game, args.settle_seconds))
                after = {str(file.relative_to(mods)): file.read_bytes() for file in mods.rglob("*.package")}
                assert before == after, "Benchmark changed its mod inputs"
        report["results"][kind] = {"sha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
                                   "samples": samples, "medianMappedMs": statistics.median(sample["mappedMs"] for sample in samples),
                                   "medianSettledPssKiB": statistics.median(sample["settled"]["pssKiB"] for sample in samples)}
    rendered = json.dumps(report, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered)
    print(rendered, end="")


if __name__ == "__main__":
    main()
