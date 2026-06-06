// dom-health-check.js — mechanical bug scanner + structural layout diff.
// Ported from jeffery-skills/e2e-testing-for-webapps/references/DIAGNOSTIC-TOOLS.md.
//
// Run programmatic diagnostics FIRST, screenshot SECOND. These functions catch
// mechanical bug classes the agent's vision reliably misses. All are pure
// Playwright + page.evaluate(), zero external dependencies.
//
//   const { domHealthCheck, captureLayoutSnapshot, diffLayoutSnapshots,
//           findObscuredInteractives, findPointerEventsDisabled,
//           stabilizeForScreenshot, BREAKPOINTS, STATE_MATRIX_HIGH_VALUE } =
//     require('./dom-health-check.js');
//
//   const health = await domHealthCheck(page);   // 10 mechanical checks
//   if (health.bySeverity.critical) { /* fix before screenshotting */ }

// ── domHealthCheck: 10 severity-ranked mechanical checks ────────────────────
// 1 page horizontal scroll (critical)  2 element beyond viewport (major)
// 3 clipped overflow w/o ellipsis (warn) 4 0x0-with-text (warn)
// 5 sub-44px touch target (minor)        6 image w/o dims => CLS (minor)
// 7 missing alt (minor)                  8 text color == bg (major)
// 9 overlapping interactives >30% (major) 10 unwanted scroll container (warn)
async function domHealthCheck(page) {
  return page.evaluate(() => {
    const issues = [];
    const vw = window.innerWidth, vh = window.innerHeight;
    const describe = (el) => {
      if (!el || el === document.body) return 'body';
      const tag = el.tagName.toLowerCase();
      const id = el.id ? '#' + el.id : '';
      const testId = el.dataset?.testid ? '[data-testid="' + el.dataset.testid + '"]' : '';
      const cls = (typeof el.className === 'string' && el.className)
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      return (tag + id + testId + cls).slice(0, 100);
    };
    const selector = (el) => {
      if (el.id) return '#' + el.id;
      if (el.dataset?.testid) return '[data-testid="' + el.dataset.testid + '"]';
      const tag = el.tagName.toLowerCase();
      const parent = el.parentElement;
      if (!parent || parent === document.documentElement) return tag;
      const sib = [...parent.children].filter(c => c.tagName === el.tagName);
      const nth = sib.length > 1 ? ':nth-of-type(' + (sib.indexOf(el) + 1) + ')' : '';
      return selector(parent) + ' > ' + tag + nth;
    };
    const isVisible = (el, s) => s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) !== 0;
    const isInteractive = (el) => el.matches(
      'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [onclick], [tabindex]:not([tabindex="-1"])');

    // 1. page-level horizontal scroll
    const docScrollW = document.documentElement.scrollWidth;
    if (docScrollW > vw + 2) issues.push({ severity: 'critical', category: 'viewport', selector: 'html',
      detail: 'Page has horizontal scroll (' + docScrollW + 'px content > ' + vw + 'px viewport)' });

    const allEls = document.querySelectorAll('body *');
    const interactiveRects = [];
    for (const el of allEls) {
      const style = getComputedStyle(el);
      if (!isVisible(el, style)) continue;
      const rect = el.getBoundingClientRect();
      const hasSize = rect.width > 0 && rect.height > 0;
      // 2. beyond viewport
      if (hasSize && rect.width > 10 && rect.height > 10) {
        if (rect.right > vw + 10) issues.push({ severity: 'major', category: 'viewport', selector: selector(el),
          detail: 'Extends ' + Math.round(rect.right - vw) + 'px beyond right viewport edge' });
        if (rect.left < -10) issues.push({ severity: 'major', category: 'viewport', selector: selector(el),
          detail: 'Extends ' + Math.round(Math.abs(rect.left)) + 'px beyond left viewport edge' });
      }
      // 3. clipped overflow without ellipsis
      if (hasSize) {
        if (el.scrollWidth > el.clientWidth + 2 && (style.overflowX === 'hidden' || style.overflow === 'hidden')
          && style.textOverflow !== 'ellipsis' && el.textContent.trim().length > 0)
          issues.push({ severity: 'warning', category: 'overflow', selector: selector(el),
            detail: 'Text overflows horizontally and is clipped without ellipsis' });
        if (el.scrollHeight > el.clientHeight + 2 && style.overflowY === 'hidden' && el.textContent.trim().length > 20)
          issues.push({ severity: 'warning', category: 'overflow', selector: selector(el),
            detail: 'Content overflows vertically and is clipped' });
      }
      // 4. zero-dimension element with direct text
      if (!hasSize && el.childNodes.length > 0) {
        if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
          issues.push({ severity: 'warning', category: 'layout', selector: selector(el),
            detail: 'Element has text content but renders at 0x0 pixels' });
      }
      if (hasSize && isInteractive(el)) {
        const tw = Math.max(rect.width, parseFloat(style.minWidth) || 0);
        const th = Math.max(rect.height, parseFloat(style.minHeight) || 0);
        // 5. small touch target
        if (tw < 44 || th < 44) issues.push({ severity: 'minor', category: 'accessibility', selector: selector(el),
          detail: 'Touch target too small (' + Math.round(tw) + 'x' + Math.round(th) + 'px, minimum 44x44)' });
        interactiveRects.push({ rect, desc: describe(el), sel: selector(el) });
      }
      // 6. image without dimensions => CLS
      if (el.tagName === 'IMG' && hasSize) {
        const hasAttr = el.hasAttribute('width') || el.hasAttribute('height');
        const hasCss = (style.width !== 'auto' && style.width !== '') || (style.height !== 'auto' && style.height !== '');
        if (!hasAttr && !hasCss) issues.push({ severity: 'minor', category: 'cls', selector: selector(el),
          detail: 'Image without explicit dimensions causes layout shift during loading' });
      }
      // 7. missing alt
      if (el.tagName === 'IMG' && !el.hasAttribute('alt'))
        issues.push({ severity: 'minor', category: 'accessibility', selector: selector(el), detail: 'Image missing alt attribute' });
      // 8. text color == background color
      if (el.childNodes.length > 0 && hasSize && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
        const c = style.color, bg = style.backgroundColor;
        if (c && bg && c === bg && bg !== 'rgba(0, 0, 0, 0)')
          issues.push({ severity: 'major', category: 'accessibility', selector: selector(el),
            detail: 'Text color matches background color: both are ' + c });
      }
    }
    // 9. overlapping interactives (>30% of smaller area)
    for (let i = 0; i < interactiveRects.length; i++) {
      for (let j = i + 1; j < interactiveRects.length; j++) {
        const a = interactiveRects[i].rect, b = interactiveRects[j].rect;
        const ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const area = ox * oy, smaller = Math.min(a.width * a.height, b.width * b.height);
        if (area > 0 && smaller > 0 && area / smaller > 0.3)
          issues.push({ severity: 'major', category: 'overlap', selector: interactiveRects[i].sel,
            detail: interactiveRects[i].desc + ' overlaps ' + interactiveRects[j].desc + ' by ' + Math.round(area / smaller * 100) + '% — users may tap the wrong one' });
      }
      if (interactiveRects.length > 100) break;
    }
    // 10. unwanted scroll container
    for (const el of allEls) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || el === document.documentElement || el === document.body) continue;
      if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 5) {
        if (!el.matches('[class*="scroll"], [class*="carousel"], [class*="slider"], [class*="overflow"], [role="tablist"], pre, code, table'))
          issues.push({ severity: 'warning', category: 'overflow', selector: selector(el),
            detail: 'Container has unintended horizontal scroll (' + el.scrollWidth + 'px content in ' + el.clientWidth + 'px container)' });
      }
    }

    const order = { critical: 0, major: 1, warning: 2, minor: 3 };
    issues.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
    const seen = new Set();
    const deduped = issues.filter(i => { const k = i.selector + '|' + i.category; if (seen.has(k)) return false; seen.add(k); return true; });
    return {
      url: location.href, viewport: { width: vw, height: vh }, issueCount: deduped.length,
      bySeverity: {
        critical: deduped.filter(i => i.severity === 'critical').length,
        major: deduped.filter(i => i.severity === 'major').length,
        warning: deduped.filter(i => i.severity === 'warning').length,
        minor: deduped.filter(i => i.severity === 'minor').length,
      },
      issues: deduped,
    };
  });
}

// ── Layout snapshot diff (structural verification, no vision) ───────────────
// captureLayoutSnapshot -> deterministic layout tree. diffLayoutSnapshots
// catches 5px moves, z-index/opacity/display/visibility changes, disappeared/
// appeared/shifted-sibling at 100% reliability. Pass {intent:{expect,noChange}}
// to flag any change to a noChange element as CRITICAL/unexpected.
async function captureLayoutSnapshot(page) {
  return page.evaluate(() => {
    const stable = (el) => {
      if (el.id) return '#' + el.id;
      if (el.dataset?.testid) return '[data-testid="' + el.dataset.testid + '"]';
      const tag = el.tagName.toLowerCase();
      const parent = el.parentElement;
      if (!parent || parent === document.documentElement) return tag;
      const sib = [...parent.children].filter(c => c.tagName === el.tagName);
      const nth = sib.length > 1 ? ':nth-of-type(' + (sib.indexOf(el) + 1) + ')' : '';
      return stable(parent) + ' > ' + tag + nth;
    };
    const elements = [];
    for (const el of document.querySelectorAll('body *')) {
      const s = getComputedStyle(el);
      if (s.display === 'none') continue;
      if (s.visibility === 'hidden' && s.position !== 'absolute') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean).join(' ').slice(0, 120);
      elements.push({
        selector: stable(el), tag: el.tagName.toLowerCase(), text: text || undefined,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        styles: {
          display: s.display, zIndex: s.zIndex !== 'auto' ? parseInt(s.zIndex) : undefined,
          opacity: s.opacity !== '1' ? parseFloat(s.opacity) : undefined,
          overflow: s.overflow !== 'visible' ? s.overflow : undefined,
          visibility: s.visibility !== 'visible' ? s.visibility : undefined,
        },
        interactive: el.matches('a[href], button, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])'),
      });
    }
    return { url: location.href, viewport: { width: innerWidth, height: innerHeight }, elementCount: elements.length, elements };
  });
}

function diffLayoutSnapshots(before, after, options = {}) {
  const { positionThreshold = 3, sizeThreshold = 3, intent = null } = options;
  const bMap = new Map(before.elements.map(e => [e.selector, e]));
  const aMap = new Map(after.elements.map(e => [e.selector, e]));
  const diffs = [];
  for (const [sel, b] of bMap) if (!aMap.has(sel)) diffs.push({ type: 'disappeared', selector: sel,
    severity: b.interactive ? 'critical' : 'major', detail: `${b.tag}${b.text ? ' "' + b.text.slice(0, 40) + '"' : ''} disappeared` });
  for (const [sel, a] of aMap) if (!bMap.has(sel)) diffs.push({ type: 'appeared', selector: sel, severity: 'info',
    detail: `${a.tag} appeared at (${a.rect.x},${a.rect.y}) ${a.rect.w}x${a.rect.h}` });
  for (const [sel, b] of bMap) {
    const a = aMap.get(sel); if (!a) continue;
    const changes = [];
    if (Math.abs(a.rect.x - b.rect.x) > positionThreshold || Math.abs(a.rect.y - b.rect.y) > positionThreshold)
      changes.push(`moved (${b.rect.x},${b.rect.y}) -> (${a.rect.x},${a.rect.y})`);
    if (Math.abs(a.rect.w - b.rect.w) > sizeThreshold || Math.abs(a.rect.h - b.rect.h) > sizeThreshold)
      changes.push(`resized ${b.rect.w}x${b.rect.h} -> ${a.rect.w}x${a.rect.h}`);
    if (b.text !== a.text && (b.text || a.text)) changes.push(`text "${(b.text || '').slice(0, 30)}" -> "${(a.text || '').slice(0, 30)}"`);
    for (const p of ['zIndex', 'display', 'opacity', 'overflow', 'visibility'])
      if (b.styles?.[p] !== a.styles?.[p]) changes.push(`${p} ${b.styles?.[p] ?? 'auto'} -> ${a.styles?.[p] ?? 'auto'}`);
    if (changes.length) diffs.push({ type: 'changed', selector: sel, interactive: a.interactive,
      severity: a.interactive ? 'major' : 'minor', detail: changes.join('; ') });
  }
  if (intent) for (const d of diffs) {
    const shouldNotChange = intent.noChange?.some(s => d.selector.includes(s) || d.selector === s);
    if (shouldNotChange && d.type !== 'appeared') { d.severity = 'critical'; d.unexpected = true; d.detail += ' [UNEXPECTED — element was declared noChange]'; }
  }
  const order = { critical: 0, major: 1, minor: 2, info: 3 };
  diffs.sort((x, y) => (order[x.severity] ?? 9) - (order[y.severity] ?? 9));
  const unexpected = diffs.filter(d => d.unexpected);
  return {
    summary: {
      totalDiffs: diffs.length,
      appeared: diffs.filter(d => d.type === 'appeared').length,
      disappeared: diffs.filter(d => d.type === 'disappeared').length,
      changed: diffs.filter(d => d.type === 'changed').length,
      unexpected: unexpected.length, hasUnexpected: unexpected.length > 0,
    },
    diffs,
  };
}

// ── Same bugs that make .click() fail, found programmatically ───────────────
async function findObscuredInteractives(page) {
  return page.evaluate(() => {
    const issues = [];
    for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [onclick]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (top && top !== el && !el.contains(top) && !top.closest(el.tagName === 'A' ? 'a' : el.tagName.toLowerCase())) {
        const text = (el.textContent || '').trim().slice(0, 30);
        const blkCls = (typeof top.className === 'string' && top.className) ? '.' + top.className.trim().split(/\s+/)[0] : '';
        issues.push({ element: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (text ? ' "' + text + '"' : ''),
          blockedBy: top.tagName.toLowerCase() + (top.id ? '#' + top.id : '') + blkCls, severity: 'critical',
          detail: 'Interactive element is obscured by another element — users cannot click it' });
      }
    }
    return issues;
  });
}

async function findPointerEventsDisabled(page) {
  return page.evaluate(() => {
    const issues = [];
    for (const el of document.querySelectorAll('a[href], button, input, [role="button"], [onclick]')) {
      if (getComputedStyle(el).pointerEvents === 'none') {
        const text = (el.textContent || '').trim().slice(0, 30);
        issues.push({ element: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (text ? ' "' + text + '"' : ''),
          severity: 'critical', detail: 'Interactive element has pointer-events: none — visually present but unclickable' });
      }
    }
    return issues;
  });
}

// ── Stabilize before ANY screenshot comparison (else false positives) ───────
// Zero animation/transition durations + transparent caret, fonts.ready,
// all images loaded, networkidle, aria-busy clear.
async function stabilizeForScreenshot(page) {
  await page.addStyleTag({ content: `
    *, *::before, *::after { animation-duration:0s !important; animation-delay:0s !important;
      transition-duration:0s !important; transition-delay:0s !important; caret-color:transparent !important; }
    ::-webkit-scrollbar { display:none !important; } * { scrollbar-width:none !important; }` });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all(Array.from(document.images).filter(i => !i.complete)
    .map(i => new Promise(res => { i.addEventListener('load', res); i.addEventListener('error', res); }))));
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(100);
  // Retina caveat: in native-window mode (viewport:null) on macOS Retina/Electron,
  // page.screenshot({scale:"css"}) can still return device-pixel size. If a screenshot
  // comes back at 2x the CSS dimensions, downscale via a canvas resize before comparing.
}

// Breakpoint sweep widths (320 -> 1920) and the high-value state combinations
// that catch the most bugs with the fewest tests.
const BREAKPOINTS = [
  { name: 'mobile-s', width: 320, height: 568 }, { name: 'mobile', width: 375, height: 667 },
  { name: 'mobile-l', width: 428, height: 926 }, { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 }, { name: 'desktop', width: 1440, height: 900 },
  { name: 'desktop-l', width: 1920, height: 1080 },
];
const STATE_MATRIX_HIGH_VALUE = [
  'mobile+empty', 'mobile+overflow', 'desktop+empty', 'dark+error', 'tablet+many-items',
  'mobile+dark+logged-out', // least-tested combination; often completely broken
];

module.exports = {
  domHealthCheck, captureLayoutSnapshot, diffLayoutSnapshots,
  findObscuredInteractives, findPointerEventsDisabled, stabilizeForScreenshot,
  BREAKPOINTS, STATE_MATRIX_HIGH_VALUE,
};
