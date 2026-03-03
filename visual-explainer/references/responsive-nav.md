# Responsive Section Navigation

Two-column CSS Grid: sticky sidebar TOC on desktop, horizontal scrollable bar on mobile. Use for pages with 4+ sections.

```html
<div class="wrap">
  <nav class="toc" id="toc">
    <div class="toc-title">Contents</div>
    <a href="#s1">1. First Section</a>
    <a href="#s2">2. Second Section</a>
  </nav>
  <div class="main">
    <div id="s1" class="sec-head">1 — First Section</div>
    <div id="s2" class="sec-head">2 — Second Section</div>
  </div>
</div>
```

## CSS

### Wrap (grid layout)

```css
.wrap {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 170px 1fr;
  gap: 0 40px;
}
.main { min-width: 0; }
```

### TOC — Desktop (sticky sidebar)

```css
.toc {
  position: sticky;
  top: 24px;
  align-self: start;
  padding: 14px 0;
  grid-row: 1 / -1;
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
}
.toc::-webkit-scrollbar { width: 3px; }
.toc::-webkit-scrollbar-thumb { background: var(--surface-elevated); border-radius: 2px; }

.toc-title {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--text-dim);
  padding: 0 0 10px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.toc a {
  display: block;
  font-size: 11px;
  color: var(--text-dim);
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 5px;
  border-left: 2px solid transparent;
  transition: all 0.15s;
  line-height: 1.4;
  margin-bottom: 1px;
}
.toc a:hover { color: var(--text); background: var(--bg-secondary); }
.toc a.active { color: var(--text); border-left-color: var(--accent); }
```

### TOC — Mobile (sticky horizontal bar)

```css
@media (max-width: 1000px) {
  .wrap { grid-template-columns: 1fr; padding-top: 0; }
  body { padding-top: 0; }

  .toc {
    position: sticky;
    top: 0;
    z-index: 200;
    max-height: none;
    display: flex;
    gap: 4px;
    align-items: center;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    padding: 10px 0;
    margin: 0 -40px;
    padding-left: 40px;
    padding-right: 40px;
    grid-row: auto;
  }
  .toc::-webkit-scrollbar { display: none; }
  .toc-title { display: none; }

  .toc a {
    white-space: nowrap;
    flex-shrink: 0;
    border-left: none;
    border-bottom: 2px solid transparent;
    border-radius: 4px 4px 0 0;
    padding: 6px 10px;
    font-size: 10px;
  }
  .toc a.active {
    border-left: none;
    border-bottom-color: var(--accent);
    background: var(--surface);
  }

  .main { padding-top: 20px; }

  /* Offset scroll target so headings clear the sticky bar */
  .sec-head { scroll-margin-top: 52px; }
}
```

## JavaScript — Scroll Spy

```html
<script>
(function() {
  var toc = document.getElementById('toc'), links = toc.querySelectorAll('a'), sections = [];
  links.forEach(function(link) {
    var el = document.getElementById(link.getAttribute('href').slice(1));
    if (el) sections.push({ el: el, link: link });
  });
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      links.forEach(function(l) { l.classList.remove('active'); });
      var match = sections.find(function(s) { return s.el === entry.target; });
      if (match) {
        match.link.classList.add('active');
        if (window.innerWidth <= 1000)
          match.link.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });
  }, { rootMargin: '-10% 0px -80% 0px' });
  sections.forEach(function(s) { observer.observe(s.el); });
  links.forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var el = document.getElementById(link.getAttribute('href').slice(1));
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', '#' + link.getAttribute('href').slice(0)); }
    });
  });
})();
</script>
```
