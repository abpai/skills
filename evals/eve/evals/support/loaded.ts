import { satisfies } from "eve/evals/expect"

/**
 * Skill-load assertions over a turn's `events`.
 *
 * Since eve 0.83 a skill load is not a tool call: it is a `load-skill` action
 * request paired with an `action.result` whose result kind is
 * `load-skill-result` (this is the pairing eve's own `skillLoads` fact uses).
 * `turn.toolCalls` no longer contains it, so a check over `toolCalls` for a
 * `load_skill` call finds nothing and passes vacuously. Always pass
 * `turn.events` to the helpers here and to `noFailedSkillLoads`.
 */
export type SkillLoad = { readonly skill: string; readonly status: string }

type StreamEvent = {
  type?: string
  data?: {
    status?: string
    actions?: ReadonlyArray<{ kind?: string; callId?: string; name?: string }>
    result?: { kind?: string; callId?: string }
  }
}

/** Skill loads in a turn's events, or null when `events` is not an event list. */
export function skillLoadsOf(events: unknown): SkillLoad[] | null {
  if (!Array.isArray(events)) return null
  const byCall = new Map<string, { skill: string; status: string }>()
  for (const event of events as StreamEvent[]) {
    if (event?.type === "actions.requested") {
      for (const action of event.data?.actions ?? []) {
        if (action.kind === "load-skill" && action.callId && action.name) {
          byCall.set(action.callId, { skill: action.name, status: "pending" })
        }
      }
    } else if (event?.type === "action.result") {
      const result = event.data?.result
      const load = result?.kind === "load-skill-result" && result.callId ? byCall.get(result.callId) : undefined
      if (load) load.status = event.data?.status ?? load.status
    }
  }
  return [...byCall.values()]
}

/** Assert the ABSENCE of a load of `skillId` ("prompt X must NOT load skill Y"). */
export function notLoadedSkill(skillId: string) {
  return satisfies((events: unknown) => {
    const loads = skillLoadsOf(events)
    return loads !== null && !loads.some((l) => l.skill === skillId)
  }, `did not load skill ${skillId}`)
}

/** Assert this turn loaded `skillId` (per turn; `t.loadedSkill` spans every session). */
export function turnLoadedSkill(skillId: string) {
  return satisfies((events: unknown) => {
    const loads = skillLoadsOf(events)
    return loads !== null && loads.some((l) => l.skill === skillId && l.status === "completed")
  }, `loaded skill ${skillId}`)
}

/** Assert the turn loaded no skill at all (plain factual questions). */
export function loadedNoSkills() {
  return satisfies((events: unknown) => {
    const loads = skillLoadsOf(events)
    return loads !== null && loads.length === 0
  }, "loaded no skills")
}
