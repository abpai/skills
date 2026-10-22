import unittest

from pagekit.slug import slugify


class SlugTests(unittest.TestCase):
    def test_spaces_become_hyphens(self):
        self.assertEqual(slugify("Getting Started"), "getting-started")

    def test_keeps_non_ascii_letters(self):
        self.assertEqual(slugify("Café Society"), "café-society")

    def test_underscores_become_hyphens(self):
        self.assertEqual(slugify("snake_case_title"), "snake-case-title")
