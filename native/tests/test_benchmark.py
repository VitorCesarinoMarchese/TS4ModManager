import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("benchmark", Path(__file__).parents[1] / "benchmark.py")
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)


class MemorySampling(unittest.TestCase):
    def test_samples_only_the_launched_process_and_its_descendants(self):
        with tempfile.TemporaryDirectory() as directory:
            proc = Path(directory)
            for pid, parent, rss, pss in [(100, 1, 100, 40), (200, 100, 150, 70), (300, 1, 900, 700)]:
                entry = proc / str(pid)
                entry.mkdir()
                (entry / "status").write_text(f"PPid:\t{parent}\n")
                (entry / "smaps_rollup").write_text(f"Rss: {rss} kB\nPss: {pss} kB\n")
            self.assertEqual(benchmark.memory_totals(100, proc),
                             {"processes": 2, "rssKiB": 250, "pssKiB": 110})
            self.assertEqual(benchmark.memory_totals(999, proc),
                             {"processes": 0, "rssKiB": 0, "pssKiB": 0})


if __name__ == "__main__":
    unittest.main()
