/**
 * THE AUTO-RECOVERED GRAPH KEEPS ITS OWN SCENARIO — the silent-data-loss guard.
 *
 * ⚠ THE DEFECT THIS PINS, MEASURED ON THE DEPLOYED BUILD (staging `a206cca9`,
 * 31 Aug 2026, guest, scenario `73c56180-195c-46f4-b910-e89aded4fc26`):
 *
 * The boot arbiter restored the autosaved GRAPH and then resolved its scenario
 * identity from a DIFFERENT record — `localStorage['olumi-canvas-current-
 * scenario-id']` — calling `clearCurrentScenarioId()` when that pointer was
 * missing, even though the record it had just restored carried its own
 * `scenarioId`. `useConversation.sendTurn` then minted a fresh UUID, and every
 * later turn was addressed to a scenario CEE holds no graph for. A
 * `factor_value_edit` left the browser perfectly formed, matched no node at the
 * server, and the optimistic value was reverted minutes later with no
 * explanation. The user's number was silently lost.
 *
 * One variable, opposite outcomes, both captured at the wire:
 *   pointer ABSENT  → `scenario_id: e2b272ba…` (0 nodes server-side); the graph
 *                     on screen (`73c56180…`) stayed at `value 0.5,
 *                     cee_inference`.
 *   pointer PRESENT → `scenario_id: 73c56180…`; cold read after the identical
 *                     click: `raw_value 0.85, source user_override`.
 *
 * ⚠⚠ WHY THERE ARE TWO KINDS OF TEST HERE, and it is this repo's own lesson.
 * `reactFlowGraph.restoreFreshnessOnBoot.spec.ts` records that
 * `resolveRestoredFreshnessUpdate` had a 10/10 unit kit with five biting
 * mutants — and DELETING ITS SOLE PRODUCTION CALL SITE survived that kit and a
 * 1,122-test sweep with zero reds. **A pure function with a perfect unit kit is
 * not evidence that the product calls it.** So:
 *
 *   §1 UNIT — the rule itself, including the case the defect lived in.
 *   §2 CALL SITE — a source scan proving the autosave-restore branch actually
 *      passes `autosave.scenarioId` into that rule, and that the old
 *      pointer-only read is gone. Every absence claim carries a POSITIVE
 *      CONTROL run through the SAME pipeline as the real assertion, because a
 *      matcher broken by a typo reports a clean sweep by testing nothing.
 *
 * ⚠ WHAT §2 DOES **NOT** PROVE, stated so nobody reads more into it: it is a
 * SOURCE scan, not an execution witness. It cannot show the branch RUNS at
 * boot (that branch lives inside a `useEffect` in a component this suite cannot
 * mount). It proves the rule is wired in at the one site, which is exactly the
 * thing the freshness lane found a unit kit blind to. The execution evidence for
 * this defect is the deployed-wire measurement quoted above, not this file.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveRestoredScenarioId } from '../ReactFlowGraph'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE_PATH = join(HERE, '..', 'ReactFlowGraph.tsx')

/** The two ids from the live measurement, used verbatim so the fixture is the finding. */
const GRAPH_OWN_ID = '73c56180-195c-46f4-b910-e89aded4fc26'
const POINTER_ID = 'e2b272ba-1250-4d6b-9d73-d5fe854769bb'

// ─── §1 THE RULE ──────────────────────────────────────────────────────────────

describe('resolveRestoredScenarioId', () => {
  /**
   * ⭐ THE DEFECT CASE. Before the fix this resolved to `null` and the boot path
   * went on to CLEAR the pointer — orphaning a graph that knew its own id.
   */
  it('falls back to the id carried IN the restored record when the pointer is missing', () => {
    expect(resolveRestoredScenarioId(null, GRAPH_OWN_ID)).toBe(GRAPH_OWN_ID)
  })

  it('falls back to the record when the pointer is a legacy non-UUID', () => {
    expect(resolveRestoredScenarioId('scenario-1712345678-ab12', GRAPH_OWN_ID)).toBe(GRAPH_OWN_ID)
  })

  /**
   * PRECEDENCE, and it is not incidental: the pointer is the LIVE conversation's
   * id and the autosave record can be one projection behind it. A fix that
   * preferred the record would rebind a live conversation to a stale id — the
   * same harm in the other direction.
   */
  it('prefers the pointer over the record when both are well-formed and DIFFER', () => {
    expect(resolveRestoredScenarioId(POINTER_ID, GRAPH_OWN_ID)).toBe(POINTER_ID)
  })

  /**
   * The "drop into draft mode" behaviour the original branch was written for
   * SURVIVES — it is narrowed to the case where nothing anywhere states an id,
   * not removed. `null` here is what makes the caller clear the pointer.
   */
  it('returns null when neither record states a usable id', () => {
    expect(resolveRestoredScenarioId(null, undefined)).toBeNull()
    expect(resolveRestoredScenarioId(null, null)).toBeNull()
    expect(resolveRestoredScenarioId('', '')).toBeNull()
    expect(resolveRestoredScenarioId('scenario-1712345678-ab12', 'scenario-99-zz')).toBeNull()
  })
})

// ─── §2 THE CALL SITE ────────────────────────────────────────────────────────

/**
 * Extract the body of the `loadSource === 'autosave'` branch by brace-matching
 * from its own condition, so the scan reads THAT branch and not the whole file.
 * Returns null when the anchor is absent — which the tests treat as a failure,
 * never as a clean sweep (an extractor that finds nothing agrees with every
 * other extractor that finds nothing).
 */
function autosaveRestoreBranch(source: string): string | null {
  const anchor = source.indexOf("if (loadSource === 'autosave' && autosave)")
  if (anchor === -1) return null
  const open = source.indexOf('{', anchor)
  if (open === -1) return null
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  return null
}

describe('the autosave-restore branch is wired to the rule', () => {
  const source = readFileSync(SOURCE_PATH, 'utf8')
  const branch = autosaveRestoreBranch(source)

  it('the extractor found a NON-EMPTY branch (instrument check, not a claim)', () => {
    expect(branch).not.toBeNull()
    // A brace-matched extraction that returned a stub would make every
    // assertion below vacuous, so the size is asserted rather than assumed.
    expect((branch as string).length).toBeGreaterThan(500)
  })

  it('resolves the scenario id THROUGH the rule, passing the record\'s own id', () => {
    const b = branch as string
    expect(b).toContain('resolveRestoredScenarioId(')
    expect(b).toContain('autosave.scenarioId')
  })

  it('re-persists the resolved id so the two records reconverge', () => {
    expect(branch as string).toContain('scenarios.setCurrentScenarioId(')
  })

  /**
   * The defect in its exact original spelling. Its return would mean the branch
   * had gone back to reading only the pointer.
   *
   * POSITIVE CONTROL: the same matcher, over the same kind of input, MUST see
   * the string when it is genuinely present — otherwise this assertion passes by
   * being unable to look.
   */
  it('no longer resolves the id from the pointer ALONE', () => {
    const readsPointerOnly = (text: string) =>
      /const\s+persistedScenarioId\s*=\s*scenarios\.getCurrentScenarioId\(\)/.test(text)

    // Positive control, through the SAME matcher the claim uses.
    expect(
      readsPointerOnly('const persistedScenarioId = scenarios.getCurrentScenarioId()\n'),
    ).toBe(true)

    expect(readsPointerOnly(branch as string)).toBe(false)
  })
})
