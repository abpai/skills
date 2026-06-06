// console-monitor.js — capture + categorize console messages.
// Ported from jeffery-skills/e2e-testing-for-webapps/references/CONSOLE-MONITORING.md.
//
// Console monitoring catches invisible bugs that pass every assertion (hydration
// mismatch, failed API with fallback, swallowed TypeError, CSP violation).
// Hydration is ranked MOST serious. A known-safe allowlist keeps it signal, not noise.
//
//   const { ConsoleMonitor } = require('./console-monitor.js');
//   const monitor = new ConsoleMonitor(page);   // attaches in constructor
//   await page.goto(url); await runUserPath(page);
//   const errs = monitor.getUnexpectedErrors();  // filtered, allowlist applied
//   if (monitor.hasHydrationErrors()) { /* CRITICAL — SSR/client mismatch */ }

// Categorization order matters: hydration is tested first and ranked critical.
function categorize(text) {
  if (/hydrat|server.*different.*client|content.*mismatch|text content does not match/i.test(text)) return 'hydration'; // CRITICAL
  if (/^warning:\s|react|hook|useeffect|usestate|setstate.*unmounted/i.test(text)) return 'react';
  if (/net::err|failed to (load|fetch)|cors|fetch.*failed|timeout|aborted/i.test(text)) return 'network';
  if (/csp|content security policy|refused to|blocked by cors|unsafe-eval/i.test(text)) return 'security';
  if (/typeerror|referenceerror|syntaxerror|rangeerror|uncaught|error:/i.test(text)) return 'runtime';
  if (/deprecat|will be removed|no longer supported/i.test(text)) return 'deprecation';
  return 'other';
}

// Filter these out so console checks surface real bugs without noise.
const KNOWN_SAFE_PATTERNS = [
  /download the react devtools/i, /fast refresh/i, /chrome-extension/i, /moz-extension/i,
  /gtag|google.*analytics/i, /facebook.*pixel/i, /hotjar/i, /intercom/i, /sentry/i, /posthog/i,
  /ResizeObserver loop/i, // browser quirk, not a bug
];

class ConsoleMonitor {
  constructor(page) {
    this.page = page;
    this.messages = [];
    page.on('console', (msg) => {
      const loc = msg.location();
      this.messages.push({ level: msg.type(), text: msg.text(), category: categorize(msg.text()),
        url: loc.url, lineNumber: loc.lineNumber, timestamp: Date.now() });
    });
    page.on('pageerror', (err) => {
      this.messages.push({ level: 'error', text: String(err), category: categorize(String(err)), timestamp: Date.now() });
    });
  }
  getErrors(category) { return this.messages.filter(m => m.level === 'error' && (!category || m.category === category)); }
  getUnexpectedErrors() { return this.getErrors().filter(m => !KNOWN_SAFE_PATTERNS.some(p => p.test(m.text))); }
  hasHydrationErrors() { return this.getErrors('hydration').length > 0; }
  getSummary() {
    const cats = ['runtime', 'network', 'react', 'security', 'hydration', 'deprecation', 'other'];
    const s = {}; for (const c of cats) s[c] = { errors: 0, warnings: 0 };
    for (const m of this.messages) { if (m.level === 'error') s[m.category].errors++; else if (m.level === 'warning') s[m.category].warnings++; }
    return s;
  }
  clear() { this.messages = []; }
}

module.exports = { ConsoleMonitor, categorize, KNOWN_SAFE_PATTERNS };
