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
