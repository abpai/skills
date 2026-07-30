import { satisfies } from "eve/evals/expect"

/**
 * Assert the ABSENCE of a `load_skill` call whose input names `skillId`.
 *
 * Eve exposes `loadedSkill`, `notCalledTool`, and `usedNoTools` — but there is
 * no `notLoadedSkill`. Confirmed shape from live artifacts
 * (`.eve/evals/.../*.json`): tool name `load_skill`, input `{ skill: "<id>" }`.
 *
 * Use this for "prompt X must NOT load skill Y". Reserve
 * `notCalledTool("load_skill")` / `usedNoTools()` for the stronger claim that
 * nothing loads at all (plain factual questions).
 */
export function notLoadedSkill(skillId: string) {
  return satisfies((calls: unknown) => {
    if (!Array.isArray(calls)) return false
    return !calls.some((c) => {
      const call = c as { name?: string; input?: { skill?: unknown } }
      return call.name === "load_skill" && call.input?.skill === skillId
    })
  }, `did not load_skill(${skillId})`)
}
