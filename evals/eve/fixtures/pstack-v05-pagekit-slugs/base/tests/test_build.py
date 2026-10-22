import os
import tempfile
import unittest

from pagekit.build import build, page_path

CONTENT = os.path.join(os.path.dirname(__file__), "..", "content")


class BuildTests(unittest.TestCase):
    def test_explicit_slug_wins(self):
        self.assertEqual(page_path({"slug": "custom", "title": "Ignored"}, "x"), "custom.html")

    def test_falls_back_to_page_id(self):
        self.assertEqual(page_path({}, "about"), "about.html")

    def test_builds_every_page(self):
        with tempfile.TemporaryDirectory() as out:
            written = build(CONTENT, out)
            self.assertEqual(len(written), 4)
            self.assertEqual(sorted(os.listdir(out)), written)
