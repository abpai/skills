import { defineEval } from "eve/evals"
import { prompt } from "../support/text"
import { noFailedSkillLoads, noWrites } from "../support/tools"
import {
  MODULE,
  atMostPrinciples,
  captureState,
  checkUnchanged,
  doesNotSelectPrinciple,
  linksPrincipleFiles,
  mentionsAll,
  noReadMatching,
  packRepo,
  readFileMatching,
  seedRepo,
  selectsPrinciple,
  staysShort,
} from "../support/pstack"

// Contract (SKILL.md: "strip a leading `--`"; plan.md): `pstack --plan X` is
// the plan route, not a usage error, and an internal API migration plan moves
// every caller and deletes the old API in the same change.
//
// Fixture pstack-p02-ledger-client: `legacyRequest` (callback, status passed
// to the callback) is replaced by `fetchJson` (throws `HttpError` on non-2xx).
// Callers branch on 404 and 422; neither status appears in the prompt, so a
// plan that names them read the callers. Attack the premise is the "must NOT
// select" direction here: no repeated failing fix exists, while
// plan-attack-premise requires it.
export default defineEval({
  description:
    "pstack --plan routes like plan and plans a full caller migration that deletes the legacy API.",
  tags: ["live", "pstack", "routing", "contract"],
  timeoutMs: 600_000,
  async test(t) {
    const repo = packRepo("pstack-p02-ledger-client", "ledger-client")
    const session = await seedRepo(t, repo)

    const turn = await session.send(
      prompt(
        "pstack --plan Move every caller off legacyRequest onto fetchJson and delete",
        "legacyRequest. src/lib/http.ts is internal to this package; nothing outside",
        "src/ imports it.",
      ),
    )
    t.succeeded()
    t.loadedSkill("pstack")
    t.check(turn.events, noFailedSkillLoads())

    // Routing: `--plan` reaches the plan module.
    t.check(turn.toolCalls, readFileMatching(MODULE.plan, "read pstack/plan.md"))
    t.check(turn.toolCalls, noReadMatching(MODULE.verify, "did not read pstack/verify.md"))
    t.check(turn.toolCalls, noReadMatching(MODULE.auto, "did not read pstack/auto.md"))

    // Researched content: the status-dependent branches the callers rely on.
    t.check(
      turn.message,
      mentionsAll(
        [/legacyRequest/, /\b404\b|\bnull\b/, /\b422\b|ValidationError/],
        "keeps the 404 -> null and 422 -> ValidationError caller behavior in view",
      ),
    )
    // Final-state check: a leftover search plus the test suite.
    t.check(
      turn.message,
      mentionsAll(
        [
          /\bgrep\b|\brg\b|\bsearch\b|\b(no|zero)\b[^.\n]{0,40}(legacyRequest|references?)[^.\n]{0,40}\bremain|\bno remaining\b/i,
          /bun test|test suite|run (the )?tests/i,
        ],
        "names a leftover-reference check and the test suite as success checks",
      ),
    )

    t.check(turn.message, linksPrincipleFiles())
    t.check(turn.message, selectsPrinciple("migrate-callers-then-delete-legacy-apis"))
    t.check(turn.message, doesNotSelectPrinciple("attack-the-premise"))
    t.check(turn.message, doesNotSelectPrinciple("exhaust-the-design-space"))
    t.check(turn.message, atMostPrinciples(5))
    t.check(turn.message, staysShort(500))

    t.check(turn.message, selectsPrinciple("test-behavior-not-implementation")).soft()
    t.judge(
      prompt(
        "Does this plan migrate every caller and delete legacyRequest and its",
        "types in the same change, with no adapter, shim, deprecated alias, or",
        "later-PR removal, and does it say tests that spy on legacyRequest must",
        "be rewritten to check behavior through the transport fake rather than",
        "re-pointed at fetchJson? Answer NO if it keeps any compatibility layer.",
      ),
      { on: turn.message },
    )

    t.check(turn.toolCalls, noWrites())
    checkUnchanged(t, repo, await captureState(session, repo))
  },
})
