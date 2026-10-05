/**
 * ⭐ WHETHER A MODEL OPENED IS ANSWERED BY ONE AUTHORITY: CEE'S CANONICAL GRAPH READ (DL 0df0e1, 5 Oct 2026).
 *
 * Witnessed on the served UI 30d464f8 (Acceptance, signed-in cold load of a58f1537 at 00:35:53Z): CEE's
 * `scenario_graph.v1` read answered HTTP 200 with the right graph for the route's scenario, and the canvas opened it.
 * Yet the user was told "This model could not be opened", because the DIRECT Supabase row read
 * (`useScenario.loadScenario`, RLS owner-only) found no row and acted as a second authority on the same question.
 *
 * So the not-found notice now asks THIS module. `hydrateCanvasFromServer` records the read's answer for the scenario
 * it read: 'opened' only when CEE served that SAME `scenario_id` (a graph, or a known scenario with none yet), and
 * 'not_opened' otherwise. Answers are sequence-stamped, so a waiter only accepts one recorded after its own load
 * began. An answer left over from an earlier read (or an earlier account) never decides a later load.
 */
export type CanonicalOpenOutcome = 'opened' | 'not_opened'

let seq = 0
const answers = new Map<string, { outcome: CanonicalOpenOutcome; seq: number }>()
const waiters = new Map<string, Set<(answer: { outcome: CanonicalOpenOutcome; seq: number }) => void>>()

/** The current sequence point: an answer recorded AFTER this was taken is newer than it. */
export function canonicalOpenSequence(): number {
  return seq
}

/** CEE's canonical read for `scenarioId` answered `outcome`. */
export function recordCanonicalOpen(scenarioId: string, outcome: CanonicalOpenOutcome): void {
  seq += 1
  const answer = { outcome, seq }
  answers.set(scenarioId, answer)
  const pending = waiters.get(scenarioId)
  if (pending) for (const notify of [...pending]) notify(answer)
}

/**
 * CEE's answer for `scenarioId` recorded after `since`, or 'timeout' when none arrives within `timeoutMs`
 * (the read never answered; the caller then reports as it did before).
 */
export function awaitCanonicalOpen(
  scenarioId: string,
  since: number,
  timeoutMs: number,
): Promise<CanonicalOpenOutcome | 'timeout'> {
  const known = answers.get(scenarioId)
  if (known && known.seq > since) return Promise.resolve(known.outcome)
  return new Promise((resolve) => {
    const set = waiters.get(scenarioId) ?? new Set()
    waiters.set(scenarioId, set)
    const finish = (value: CanonicalOpenOutcome | 'timeout') => {
      clearTimeout(timer)
      set.delete(onAnswer)
      if (set.size === 0) waiters.delete(scenarioId)
      resolve(value)
    }
    const onAnswer = (answer: { outcome: CanonicalOpenOutcome; seq: number }) => {
      if (answer.seq > since) finish(answer.outcome)
    }
    const timer = setTimeout(() => finish('timeout'), timeoutMs)
    set.add(onAnswer)
  })
}

export function __resetCanonicalOpenForTests(): void {
  answers.clear()
  waiters.clear()
}
