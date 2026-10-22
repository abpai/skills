def slugify(text):
    """Lowercase `text` and replace every non-alphanumeric character with a hyphen."""
    return "".join(ch if ch.isalnum() else "-" for ch in text.lower())
