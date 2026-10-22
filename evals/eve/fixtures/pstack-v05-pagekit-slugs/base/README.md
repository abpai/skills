# pagekit

Minimal static site builder for the docs microsite. Each `content/*.md` file
has a front-matter block; pages are written to `_site/<slug>.html`.

```sh
python -m pagekit build content _site
python -m unittest
```
