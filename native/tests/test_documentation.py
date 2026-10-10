"""Keep the public README and current documentation navigable."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


class Documentation(unittest.TestCase):
    def test_current_documentation_links_resolve(self):
        pages = [ROOT / "README.md", *(ROOT / "docs").glob("*.md")]
        for page in pages:
            with self.subTest(page=page.relative_to(ROOT)):
                for target in re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", page.read_text()):
                    if "://" in target or target.startswith("#"):
                        continue
                    path = target.split("#", 1)[0]
                    self.assertTrue((page.parent / path).exists(), f"{page}: missing {target}")

    def test_developer_guides_live_in_docs(self):
        for name in ["README.md", "development.md", "native-app.md", "native-design.md"]:
            self.assertTrue((ROOT / "docs" / name).is_file(), name)
        self.assertFalse((ROOT / "native/DESIGN.md").exists())
        readme = (ROOT / "README.md").read_text()
        self.assertNotIn("```bash", readme)
        self.assertNotIn("cargo test", readme)
        self.assertIn("docs/", readme)


if __name__ == "__main__":
    unittest.main()
