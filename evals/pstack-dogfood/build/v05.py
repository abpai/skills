import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from mk import fixture_root, write_tree, commit, diff_fingerprint

root = fixture_root("v05-pagekit-slugs")
base = {}
base[".gitignore"] = "__pycache__/\n_site/\n"
base["README.md"] = r'''
# pagekit

Minimal static site builder for the docs microsite. Each `content/*.md` file
has a front-matter block; pages are written to `_site/<slug>.html`.

```sh
python -m pagekit build content _site
python -m unittest
```
'''
base["pagekit/__init__.py"] = ""
base["pagekit/__main__.py"] = r'''
import sys

from .build import main

sys.exit(main(sys.argv[1:]))
'''
base["pagekit/slug.py"] = r'''
def slugify(text):
    """Lowercase `text` and replace every non-alphanumeric character with a hyphen."""
    return "".join(ch if ch.isalnum() else "-" for ch in text.lower())
'''
base["pagekit/frontmatter.py"] = r'''
def split(source):
    """Return (meta, body) for a document with an optional `---` front-matter block."""
    if not source.startswith("---\n"):
        return {}, source
    end = source.find("\n---\n", 4)
    if end == -1:
        raise ValueError("unterminated front matter")
    meta = {}
    for line in source[4:end].splitlines():
        if not line.strip():
            continue
        key, sep, value = line.partition(":")
        if not sep:
            raise ValueError(f"bad front-matter line: {line!r}")
        meta[key.strip()] = value.strip()
    return meta, source[end + 5 :]
'''
base["pagekit/build.py"] = r'''
import html
import os

from . import frontmatter
from .slug import slugify


def page_path(meta, page_id):
    slug = meta.get("slug") or slugify(meta.get("title", "")) or page_id
    return f"{slug}.html"


def render(meta, body):
    title = html.escape(meta.get("title", "Untitled"))
    paragraphs = "".join(f"<p>{html.escape(p.strip())}</p>" for p in body.split("\n\n") if p.strip())
    return f"<!doctype html><title>{title}</title><h1>{title}</h1>{paragraphs}\n"


def build(content_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    written = {}
    for name in sorted(os.listdir(content_dir)):
        if not name.endswith(".md"):
            continue
        page_id = name[:-3]
        with open(os.path.join(content_dir, name)) as fh:
            meta, body = frontmatter.split(fh.read())
        rel = page_path(meta, page_id)
        if rel in written:
            raise ValueError(f"{name} and {written[rel]} both map to {rel}")
        written[rel] = name
        with open(os.path.join(out_dir, rel), "w") as fh:
            fh.write(render(meta, body))
    return sorted(written)


def main(argv):
    if len(argv) != 3 or argv[0] != "build":
        print("usage: python -m pagekit build CONTENT_DIR OUT_DIR")
        return 2
    for rel in build(argv[1], argv[2]):
        print(rel)
    return 0
'''
base["content/getting-started.md"] = r'''
---
title: Getting Started
---
Install the CLI and run your first build.

That's all there is to it.
'''
base["content/faq.md"] = r'''
---
title: FAQ & Troubleshooting
---
Answers to common questions.
'''
base["content/release-notes.md"] = r'''
---
title: Release Notes -- 2026.10
---
Highlights from this release.
'''
base["content/cafe.md"] = r'''
---
title: Café Integrations
---
Point-of-sale integrations.
'''
base["tests/__init__.py"] = ""
base["tests/test_slug.py"] = r'''
import unittest

from pagekit.slug import slugify


class SlugTests(unittest.TestCase):
    def test_spaces_become_hyphens(self):
        self.assertEqual(slugify("Getting Started"), "getting-started")

    def test_keeps_non_ascii_letters(self):
        self.assertEqual(slugify("Café Society"), "café-society")

    def test_underscores_become_hyphens(self):
        self.assertEqual(slugify("snake_case_title"), "snake-case-title")
'''
base["tests/test_build.py"] = r'''
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
'''

change = {}
change["pagekit/slug.py"] = r'''
def slugify(text):
    """Lowercase `text`, join runs of alphanumeric characters with single hyphens.

    Any run of other characters becomes one hyphen, and the result never starts
    or ends with a hyphen.
    """
    words = []
    current = []
    for ch in text.lower():
        if ch.isalnum():
            current.append(ch)
        elif current:
            words.append("".join(current))
            current = []
    if current:
        words.append("".join(current))
    return "-".join(words)
'''
change["tests/test_slug.py"] = r'''
import unittest

from pagekit.slug import slugify


class SlugTests(unittest.TestCase):
    def test_spaces_become_hyphens(self):
        self.assertEqual(slugify("Getting Started"), "getting-started")

    def test_keeps_non_ascii_letters(self):
        self.assertEqual(slugify("Café Society"), "café-society")

    def test_underscores_become_hyphens(self):
        self.assertEqual(slugify("snake_case_title"), "snake-case-title")

    def test_collapses_runs_of_separators(self):
        self.assertEqual(slugify("  Hello -- World! "), "hello-world")

    def test_symbols_collapse(self):
        self.assertEqual(slugify("C++ & Rust"), "c-rust")

    def test_only_separators_gives_empty_slug(self):
        self.assertEqual(slugify("!!!"), "")
'''

write_tree(root, base)
commit(root)
write_tree(root, change)
print(diff_fingerprint(root))
