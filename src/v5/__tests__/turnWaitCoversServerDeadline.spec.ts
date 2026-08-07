/**
 * ROADMAP 2.665 (b) — the client's wait must outlast the server's deadline.
 *
 * WHY THIS IS THE SHAPE OF THE GUARD. The defect was not "one number was too
 * small"; it was that the budget was selected from a HAND-LISTED set of turn
 * types believed to be slow (`explicit_generate`, `run_analysis`, `analyse_now`,
 * stage `frame`). That list is a mirror of CEE's behaviour maintained on the
 * wrong side of the wire, and it drifted the moment CEE grew a second
 * composition on an ordinary `conversation` turn: the live witness measured the
 * server answering at 118.5s and 123.1s while this client waited 60s.
 *
 * So the guard does not assert a number. It asserts the RELATIONSHIP, over the
 * whole input domain the call sites can produce — including the exact
 * combination the witness captured. A future edit that reintroduces a shorter
 * budget for any turn shape REDs here regardless of which shape it picks.
 *
 * The domain is enumerated from the two call sites in
 * `canvas/conversation/useConversation.ts`:
 *   getTimeoutMs(resolvedTurnType, triggerSurface, derivedStage)
 *   getTimeoutMs(resolvedTurnType, triggerSurface)
 * `resolvedTurnType` comes from `resolveUserTurnType` / 'system_event';
 * `derivedStage` from the V5 `StageType` union.
 */
import { describe, it, expect } from 'vitest'

import { getTimeoutMs, SERVER_TURN_DEADLINE_MS, TURN_WAIT_MS } from '../getTimeoutMs'

/** Every turn type the call sites can resolve, plus absent. */
const TURN_TYPES = [
  undefined,
  'conversation',
  'explicit_generate',
  'run_analysis',
  'explain',
  'system_event',
] as const

/** Every trigger surface reaching the timeout selection, plus absent. */
const TRIGGER_SURFACES = [
  undefined,
  'composer',
  'chip',
  'analyse_now',
  'right_panel',
  'hero',
] as const

/** The V5 stage union, plus absent. */
const DERIVED_STAGES = [undefined, 'frame', 'analyse', 'decide', 'review'] as const

describe('turn wait covers the server deadline', () => {
  it('the floor is above CEE’s browser-proxy deadline', () => {
    // The relationship the whole guard rests on. CEE clamps its V5 turn budget
    // to BROWSER_PROXY_TIMEOUT_MS (125_000 by config default) minus response
    // headroom, so a client waiting longer than that always receives a real
    // outcome instead of inventing one.
    expect(TURN_WAIT_MS).toBeGreaterThan(SERVER_TURN_DEADLINE_MS)
  })

  it('no argument combination yields a wait below the server deadline', () => {
    const offenders: string[] = []
    for (const turnType of TURN_TYPES) {
      for (const triggerSurface of TRIGGER_SURFACES) {
        for (const derivedStage of DERIVED_STAGES) {
          const ms = getTimeoutMs(turnType, triggerSurface, derivedStage)
          if (ms <= SERVER_TURN_DEADLINE_MS) {
            offenders.push(`${turnType}/${triggerSurface}/${derivedStage} = ${ms}ms`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('the live-witnessed composer-path turn shape gets a wait that outlasts it', () => {
    // splitter-final-witness-2026-08-07.md: an ordinary composer message on a
    // canvas that already holds a graph. Server-side elapsed_ms 118494 and
    // 123139, both committed. Bound by identity to that shape, not by a value
    // predicate another shape could satisfy.
    const witnessed = getTimeoutMs('conversation', 'composer', 'analyse')
    expect(witnessed).toBeGreaterThan(123_139)
    expect(witnessed).toBeGreaterThan(SERVER_TURN_DEADLINE_MS)
  })
})
