---
description: Generate an index page listing all diagrams in ~/.agent/diagrams/
---
Load the visual-explainer skill, then generate an index page for all HTML files in ~/.agent/diagrams/.

Scan the directory: `ls -lt ~/.agent/diagrams/*.html`

For each file:
- Extract the `<title>` content (grep or head the first 10 lines)
- Get file size and modification date from `ls -l`

Generate an HTML index page with:
- Card grid layout (same editorial design system)
- Each card: title, date, file size, link to open the file
- Search/filter input to filter by title
- Sort by date (default: newest first)

Write to `~/.agent/diagrams/index.html` and open in browser.
