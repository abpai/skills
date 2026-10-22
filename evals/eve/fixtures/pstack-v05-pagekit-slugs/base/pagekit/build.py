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
