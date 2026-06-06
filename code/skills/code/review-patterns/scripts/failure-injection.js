// failure-injection.js — resilience pass (run AFTER happy path is confirmed).
// Ported from jeffery-skills/e2e-testing-for-webapps/references/FAILURE-INJECTION.md.
//
// Testing error handling on BROKEN code just generates noise — confirm the happy
// path first, then break things on purpose to verify graceful degradation.
// Pure Playwright (page.route / page.evaluate), zero external dependencies.
//
//   const { resilienceSmokeTest, injectNetworkFailure, corruptSessionState,
//           rapidInteractionTest, inputStressTest, INPUT_STRESS_VECTORS } =
//     require('./failure-injection.js');
//
//   await resilienceSmokeTest(page, 'http://127.0.0.1:3000/dashboard'); // 30s

// ── Network failure modes ───────────────────────────────────────────────────
// abort | timeout | status(500/503/401/429) | empty({}) | malformed(bad JSON)
// | slow(added latency) | partial(truncated body)
// Graceful-degradation judgment (per FAILURE-INJECTION.md):
//   blank page / raw TypeError / crash      = critical (fix now)
//   error message + retry, data preserved   = acceptable
async function injectNetworkFailure(page, urlPattern, mode, options = {}) {
  const { status = 500, delay = 10000, body = null, contentType = 'application/json', log = true } = options;
  let intercepted = 0;
  const handler = async (route) => {
    intercepted++;
    if (log) console.log(`[INJECT] ${mode} -> ${route.request().method()} ${route.request().url()} (#${intercepted})`);
    switch (mode) {
      case 'abort': return route.abort('failed');
      case 'timeout': await new Promise(r => setTimeout(r, delay)); return route.abort('timedout');
      case 'status': return route.fulfill({ status, contentType, body: body ?? JSON.stringify({ error: `Injected ${status}`, status }) });
      case 'empty': return route.fulfill({ status: 200, contentType, body: body ?? '{}' });
      case 'malformed': return route.fulfill({ status: 200, contentType, body: body ?? '{"data": [{"id": 1, "name": "trunca' });
      case 'slow': await new Promise(r => setTimeout(r, delay)); return route.continue();
      case 'partial': {
        try { const resp = await route.fetch(); const real = await resp.text();
          return route.fulfill({ status: 200, contentType, body: real.slice(0, Math.max(10, Math.floor(real.length / 3))) }); }
        catch { return route.fulfill({ status: 200, contentType, body: '{"dat' }); }
      }
      default: return route.continue();
    }
  };
  await page.route(urlPattern, handler);
  return { interceptedCount: () => intercepted, remove: async () => page.unroute(urlPattern, handler) };
}

// ── State corruption modes ──────────────────────────────────────────────────
// expire-auth | wipe-storage | corrupt-storage | expire-token-header | stale-version(426)
async function corruptSessionState(page, mode, options = {}) {
  const { waitAfter = 1000 } = options;
  switch (mode) {
    case 'expire-auth': {
      const cookies = await page.context().cookies();
      await page.context().clearCookies();
      const keep = cookies.filter(c => !/token|session|auth|sb-/i.test(c.name));
      if (keep.length) await page.context().addCookies(keep);
      await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/token|session|auth|sb-|supabase/i.test(k)) localStorage.removeItem(k); });
      break;
    }
    case 'wipe-storage':
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); break;
    case 'corrupt-storage':
      await page.evaluate(() => { for (const k of Object.keys(localStorage)) { const v = localStorage.getItem(k);
        if (v && (v.startsWith('{') || v.startsWith('['))) localStorage.setItem(k, v.slice(0, Math.max(5, Math.floor(v.length / 3)))); } }); break;
    case 'expire-token-header':
      await page.route('**/*', async (route) => { const h = route.request().headers();
        if (h['authorization']) h['authorization'] = 'Bearer expired_invalid_token_000'; await route.continue({ headers: h }); }); break;
    case 'stale-version':
      await page.route('**/api/**', async (route) => route.fulfill({ status: 426, contentType: 'application/json',
        body: JSON.stringify({ error: 'Upgrade Required', minVersion: '99.0.0' }) })); break;
    default: throw new Error(`Unknown corruption mode: ${mode}`);
  }
  await page.waitForTimeout(waitAfter);
}

// ── Double-submit / duplicate-submission detection ──────────────────────────
// Clicks N times at intervalMs; counts mutating (POST/PUT/PATCH) requests.
//   >1 mutating request                      = CRITICAL duplicate submission
//   1 request but button not disabled after  = warning (dupes on slow networks)
async function rapidInteractionTest(page, selector, options = {}) {
  const { action = 'click', count = 5, intervalMs = 50 } = options;
  const el = page.locator(selector);
  if (!(await el.isVisible())) return { error: `Element not visible: ${selector}` };
  const requests = [];
  const reqHandler = (r) => { if (r.resourceType() === 'fetch' || r.resourceType() === 'xhr') requests.push({ url: r.url(), method: r.method() }); };
  const errHandler = (m) => { if (m.type() === 'error') errs.push(m.text()); };
  const errs = [];
  page.on('request', reqHandler); page.on('console', errHandler);
  for (let i = 0; i < count; i++) {
    try {
      if (action === 'click') await el.click({ timeout: 2000 }).catch(() => {});
      else if (action === 'dblclick') await el.dblclick({ timeout: 2000 }).catch(() => {});
      else if (action === 'enter') await el.press('Enter', { timeout: 2000 }).catch(() => {});
    } catch { break; }
    if (intervalMs > 0) await page.waitForTimeout(intervalMs);
  }
  await page.waitForTimeout(2000);
  page.removeListener('request', reqHandler); page.removeListener('console', errHandler);
  const mutating = requests.filter(r => ['POST', 'PUT', 'PATCH'].includes(r.method));
  const disabledAfter = await el.isDisabled().catch(() => true);
  const hiddenAfter = !(await el.isVisible().catch(() => false));
  let severity = 'ok', detail = 'Rapid interaction handled correctly';
  if (mutating.length > 1) { severity = 'critical'; detail = `${mutating.length} duplicate submissions detected`; }
  else if (errs.length) { severity = 'major'; detail = `Console errors during rapid interaction: ${errs[0].slice(0, 100)}`; }
  else if (mutating.length === 1 && !disabledAfter && !hiddenAfter) { severity = 'warning'; detail = 'Button not disabled after submission — could duplicate on slow networks'; }
  return { selector, attemptedClicks: count, mutatingRequests: mutating.length, consoleErrors: errs.length, severity, detail };
}

// ── Input stress vectors ────────────────────────────────────────────────────
// Injection payloads must be DISPLAYED, not EXECUTED. Detection flags page-level
// horizontal scroll, parent overflow, and actual XSS execution.
const INPUT_STRESS_VECTORS = {
  empty: '', single: 'A', maxLength: 'A'.repeat(10000), pasteBomb: 'A'.repeat(50000),
  unicode: '\u{1F4A9}\u{1F600}❤️\u{1F525}', rtl: '‮This text is reversed‬',
  zalgo: 'T̶͙h͔̤i̴s̷ i̵s̶ Z̷a̴l̴g̵o̶',
  cjk: '你好世界！こんにちは안녕하세요',
  nullByte: 'before\x00after',
  xssScript: '<script>alert("xss")</script>', xssImg: '<img src=x onerror=alert(1)>',
  sqlInjection: "' OR '1'='1'; DROP TABLE users; --", templateLiteral: '${process.env.SECRET}',
};

async function inputStressTest(page, selector, options = {}) {
  const { vectors = INPUT_STRESS_VECTORS } = options;
  const input = page.locator(selector);
  if (!(await input.isVisible())) return { error: `Input not visible: ${selector}`, results: [] };
  const results = [];
  for (const [name, value] of Object.entries(vectors)) {
    await input.clear();
    try { await input.fill(value); } catch (e) { results.push({ vector: name, severity: 'ok', detail: 'Input rejected value' }); continue; }
    await page.waitForTimeout(100);
    const dmg = await page.evaluate((sel) => {
      const el = document.querySelector(sel); if (!el) return null;
      const r = el.getBoundingClientRect(); const p = el.parentElement?.getBoundingClientRect();
      return { overflowsParent: p ? r.right > p.right + 5 || r.bottom > p.bottom + 50 : false,
        pageHorizontalScroll: document.documentElement.scrollWidth > innerWidth + 2 };
    }, selector);
    let xss = false;
    if (name.startsWith('xss') || name.startsWith('sql') || name.startsWith('template'))
      xss = await page.evaluate(() => document.querySelectorAll('img[src="x"]').length > 0 || document.querySelectorAll('script:not([src])').length > 1);
    let severity = 'ok', detail = 'Input handled correctly';
    if (xss) { severity = 'critical'; detail = 'XSS payload was executed — input is not sanitized'; }
    else if (dmg?.pageHorizontalScroll) { severity = 'major'; detail = `Input caused page-level horizontal scroll (${name})`; }
    else if (dmg?.overflowsParent) { severity = 'major'; detail = 'Input overflows its parent container'; }
    results.push({ vector: name, severity, detail });
  }
  await input.clear();
  return { selector, results, issueCount: results.filter(r => r.severity !== 'ok').length };
}

// ── 30-second minimum-viable resilience smoke test ──────────────────────────
// (1) block all **/api/** and check for blank page  (2) wipe storage, reload, check crash
async function resilienceSmokeTest(page, url) {
  const inj = await injectNetworkFailure(page, '**/api/**', 'abort', { log: false });
  await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  const blankOnAbort = await page.evaluate(() => document.body.innerText.trim().length < 20);
  await inj.remove();
  await page.goto(url, { waitUntil: 'networkidle' });
  await corruptSessionState(page, 'wipe-storage');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2000);
  const blankOnWipe = await page.evaluate(() => document.body.innerText.trim().length < 20);
  const report = {
    allApisDown: blankOnAbort ? 'FAIL (blank page)' : 'PASS (error state shown)',
    storageWiped: blankOnWipe ? 'FAIL (blank page)' : 'PASS (recovered)',
  };
  console.log('=== RESILIENCE SMOKE TEST ===\nAll APIs down: ' + report.allApisDown + '\nStorage wiped:  ' + report.storageWiped);
  return report;
}

module.exports = {
  injectNetworkFailure, corruptSessionState, rapidInteractionTest, inputStressTest,
  resilienceSmokeTest, INPUT_STRESS_VECTORS,
};
