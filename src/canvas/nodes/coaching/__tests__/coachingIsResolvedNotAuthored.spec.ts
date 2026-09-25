/**
 * ⭐⭐ THE FOLD STAYS FOLDED — a guard against the scatter coming back.
 *
 * `resolveNodeCoaching` removes the duplication that was there on the day it
 * landed. It does nothing at all to stop the NEXT change re-authoring a chip
 * inline, and that is how this defect arrived the first time: `NodeChip` was
 * shared from the start, so every inline chip looked like reuse. Nothing
 * compared the copies, so they drifted, and the drift always read as green.
 *
 * ⚠ THIS IS A HAND-MAINTAINED ALLOWLIST OF TWO, AND IT IS THE PERMITTED FORM.
 * CLAUDE.md trap 12 bans a mirror that ASSUMES GOOD on drift. This one FAILS
 * LOUD: a new inline `<NodeChip>` in any migrated node file reds this test and
 * the message names the file and the chip id. The allowlist can only ever
 * shrink silently — and a separate assertion below catches that too, because an
 * allowlist entry that stops matching is a stale licence.
 *
 * ── WHY THE TWO ENTRIES ARE NOT COACHING ───────────────────────────────────
 *
 * `goal_run_analysis` and `decision_run_analysis` are RUN affordances. Both
 * files' own comments say so — GoalNode: *"This stays in the body because it's a
 * primary action button rather than coaching"*; DecisionNode: *"Exception:
 * pre-analysis body still shows the 'Run analysis' CTA when the model is ready,
 * because that's a primary action button rather than coaching."* They carry
 * `actionType="run_analysis"`, which `NodeChip` routes through
 * `canonicalRunRegistry` — a different code path with a readiness gate, an
 * autosave barrier and a goal-threshold re-attachment that coaching chips have
 * no business touching.
 *
 * They answer a different question, so they are NAMED APART rather than
 * collapsed (CLAUDE.md trap 21: reconciling two authorities that answer
 * different questions is the wrong move). Folding them would have normalised a
 * distinction two authors drew on purpose.
 *
 * ── SCOPE, STATED EXACTLY ──────────────────────────────────────────────────
 *
 * The seven node files that render node-card coaching:
 * Factor, Risk, Option, Outcome, Goal, Action, Decision.
 *
 * ⛔ `src/canvas/edges/StyledEdge.tsx` IS DELIBERATELY OUT OF SCOPE. It renders
 * EDGE coaching, it was outside this lane's fence, and it has its own open work.
 * Naming it here would be this guard claiming a reach it does not have.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { stripComments } from '../../../../../tests/helpers/stripSourceComments'

const NODE_FILES = [
  'FactorNode.tsx',
  'RiskNode.tsx',
  'OptionNode.tsx',
  'OutcomeNode.tsx',
  'GoalNode.tsx',
  'ActionNode.tsx',
  'DecisionNode.tsx',
] as const

/**
 * The only two `<NodeChip>` usages permitted to remain inline, by chip id, each
 * because its own file classifies it as a primary action rather than coaching.
 */
// Locked Canvas design (23 Sep 2026): the Goal card's duplicate "Run
// analysis" chip was removed (its Question card carried the run), and the
// Question card's run was a RAIL action through the shared
// `runAnalysisFromCard` — the same canonical pipeline and the same chip id,
// just not a text chip. The allowlist kept that one live run affordance.
//
// DESIGN-GAP-AUDIT row 5(b), 24 Sep 2026 (gap-frame-footer lane): the
// Question card's rail action is ALSO removed — contract v3.1 §02's rail is
// edit + coaching only, and running lives in the panel's Analyse button. No
// card authors a run affordance any more, so the allowlist is EMPTY rather
// than deleted: an empty array still documents that the exception class
// existed and was retired, which is what the next reader needs to know if a
// run chip ever reappears on a card.
const RUN_AFFORDANCES = [] as const

const readNode = (file: string) =>
  stripComments(readFileSync(resolve(__dirname, '../..', file), 'utf8'), file)

/** Every `<NodeChip …>` occurrence's chipId, or `'(no chipId)'` when it has none. */
const inlineChipIds = (source: string): string[] => [
  // A run affordance may also be the rail's action through the shared run
  // function (`runAnalysisFromCard('<chip id>', …)`) — same id, same pipeline.
  ...[...source.matchAll(/runAnalysisFromCard\(\s*["']([^"']+)["']/g)].map(m => m[1]),
  ...[...source.matchAll(/<NodeChip\b[\s\S]{0,600}?\/>/g)].map(
    m => m[0].match(/chipId=["']([^"']+)["']/)?.[1] ?? '(no literal chipId)',
  ),
]

describe('node coaching is resolved, never authored inline', () => {
  /**
   * ⚠ POSITIVE CONTROL FIRST. Every assertion below is an ABSENCE claim, and an
   * absence claim from a matcher that cannot match anything is vacuous (trap
   * 13). This proves the matcher finds a chip when one is present, and finds
   * none in text that has none — so a zero later is evidence rather than
   * blindness.
   */
  it('the matcher discriminates — positive and negative controls', () => {
    const present = '<NodeChip chipId="fake_chip" actionType={null} label="L" message="M" />'
    expect(inlineChipIds(present)).toEqual(['fake_chip'])
    expect(inlineChipIds('const x = 1')).toEqual([])
    // A chip with no literal chipId must still be COUNTED, not skipped —
    // otherwise `chipId={someVar}` would be an invisible way back in.
    expect(inlineChipIds('<NodeChip chipId={dynamicId} label="L" message="M" />')).toEqual([
      '(no literal chipId)',
    ])
  })

  /**
   * ⚠ THE CONTRAST CONTROL, in the same sweep: the files must be READ. A guard
   * whose `readFileSync` resolved to the wrong directory would report zero
   * inline chips for every file and look like a clean pass — CLAUDE.md trap
   * 13e, where a probe's own blindness returned a plausible zero. So each file
   * must be non-empty AND contain a marker every node file certainly has.
   */
  it('every file in scope was actually read — contrast control', () => {
    for (const file of NODE_FILES) {
      const src = readNode(file)
      expect(src.length, `${file} read as empty — the sweep below would be blind`).toBeGreaterThan(1000)
      expect(src, `${file} does not look like a node component — wrong path?`).toContain('BaseNode')
    }
  })

  it('no migrated node file authors a coaching chip inline', () => {
    const offenders: string[] = []
    for (const file of NODE_FILES) {
      for (const id of inlineChipIds(readNode(file))) {
        if (!RUN_AFFORDANCES.includes(id as (typeof RUN_AFFORDANCES)[number])) {
          offenders.push(`${file}: <NodeChip chipId="${id}">`)
        }
      }
    }
    expect(
      offenders,
      'These chips are authored inline instead of resolved by `resolveNodeCoaching`. ' +
        'Add the decision to the resolver so the card and any future panel cannot ' +
        'drift apart, or — if it is genuinely a primary action rather than ' +
        `coaching — add its id to RUN_AFFORDANCES with the reason:\n  ${offenders.join('\n  ')}`,
    ).toEqual([])
  })

  /**
   * ⭐ THE ALLOWLIST MUST NOT ROT INTO A LICENCE. If a run affordance is removed
   * or renamed, its entry here stops matching anything and silently starts
   * permitting nothing — which is harmless — but it also stops documenting a
   * real exception, and the next reader cannot tell a live exemption from a dead
   * one. Every entry must still be found.
   *
   * DESIGN-GAP-AUDIT row 5(b), 24 Sep 2026: `RUN_AFFORDANCES` is now EMPTY —
   * the Question card's rail action (the last surviving entry,
   * `decision_run_analysis`) was removed, so this loop is vacuously true by
   * construction. Asserted explicitly rather than left to run zero times
   * silently, so a later re-add of an entry without updating this comment is
   * visible as a diff here too.
   */
  it('both allowlisted run affordances are still present — a stale entry is a dead licence', () => {
    expect(RUN_AFFORDANCES, 'no card authors a run affordance any more — see the constant’s own header').toEqual([])
    const allIds = NODE_FILES.flatMap(f => inlineChipIds(readNode(f)))
    for (const id of RUN_AFFORDANCES) {
      expect(allIds, `allowlisted "${id}" no longer exists — remove it from RUN_AFFORDANCES`).toContain(id)
    }
  })

  /**
   * The counterpart claim: every file in scope that USED to author coaching now
   * imports the resolver. Without this, a file could pass the absence check by
   * having had its chips deleted rather than folded — an absence that looks
   * identical from outside (CLAUDE.md trap 13's shape at the module level).
   */
  it('every migrated node file consumes the resolver', () => {
    for (const file of NODE_FILES) {
      expect(readNode(file), `${file} authors no inline chip but does not consume the resolver either`).toContain(
        'resolveNodeCoaching',
      )
    }
  })
})
