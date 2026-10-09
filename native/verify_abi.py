#!/usr/bin/env python3
"""Reject Linux release binaries requiring glibc newer than Ubuntu 24.04."""
import argparse
from pathlib import Path
import re
import subprocess


def check_symbols(symbols, baseline):
    versions = {tuple(map(int, version.split(".")))
                for version in re.findall(r"\bGLIBC_(\d+(?:\.\d+)+)\b", symbols)}
    if not versions:
        raise ValueError("No glibc requirements found in this executable")
    required = max(versions)
    if required > baseline:
        raise ValueError(f"Binary requires glibc {'.'.join(map(str, required))}; "
                         f"release baseline is {'.'.join(map(str, baseline))}. "
                         "Build the release on Ubuntu 24.04.")
    return required


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, required=True)
    args = parser.parse_args()
    symbols = subprocess.check_output(["objdump", "-T", str(args.binary)], text=True)
    try:
        required = check_symbols(symbols, (2, 39))
    except ValueError as error:
        parser.error(str(error))
    print(f"glibc requirement {'.'.join(map(str, required))} passes release baseline 2.39")


if __name__ == "__main__":
    main()
