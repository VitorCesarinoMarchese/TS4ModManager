"""Verify release library requirements rather than assuming portability."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "verify_abi.py"


class LinuxAbi(unittest.TestCase):
    def test_ubuntu_24_baseline_accepts_older_symbols(self):
        spec = importlib.util.spec_from_file_location("verify_abi", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertEqual(module.check_symbols("(GLIBC_2.9) x\n(GLIBC_2.39) y", (2, 39)), (2, 39))

    def test_newer_build_is_rejected(self):
        spec = importlib.util.spec_from_file_location("verify_abi", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with self.assertRaisesRegex(ValueError, "2.43"):
            module.check_symbols("(GLIBC_2.43) acosf", (2, 39))


if __name__ == "__main__":
    unittest.main()
