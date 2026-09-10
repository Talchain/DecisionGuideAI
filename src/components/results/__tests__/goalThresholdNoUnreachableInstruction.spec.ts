/**
 * THE GOAL-THRESHOLD WITHHOLD MUST NOT PRESCRIBE AN ACTION THE PRODUCT CANNOT DO.
 *
 * `GOAL_THRESHOLD_NOT_CONVERTIBLE`'s title shipped ending in an instruction —
 * "State the current level for your goal." — and NOTHING IN THE UI LETS A USER
 * STATE IT. Measured at UI `staging` 67b04e5b:
 *
 *   · `GoalPanel.tsx` (881 lines) — 0 `observed_state` references.
 *     Contrast control in the same sweep: 31 hits for `target`, so the probe
 *     discriminates; the zero is real absence, not a blind instrument.
 *   · `GoalThresholdEditor.tsx` (105 lines) — 0 `observed_state` references,
 *     contrast 6 hits for `target`. It is a TARGET editor only.
 *   · The canvas projection's one `observed_state` writer
 *     (`readinessStore.ts:379`) is gated `nodeKind === 'factor'` and emits
 *     `value`/`raw_value` only — never `baseline`, and never for the goal.
 *   · The starter drafts' own `fix_hint` points at the goal node's
 *     `observed_state.value`, which is exactly the field ISL refuses, on the
 *     stated grounds that repurposing "the current observed value" would be a
 *     second unattested frame assumption.
 *
 * So the user was told to state a level, given no control that states it, and
 * the one field they might have reached is rejected upstream. The missing
 * producer is ROADMAP 2.281 (nothing writes the goal node's
 * `observed_state.baseline`); until it lands, the honest copy prescribes
 * nothing. An instruction that cannot be followed is worse than none.
 *
 * ⛔ NOT THE DEFECT, AND NOT TOUCHED HERE: the withhold itself. ISL's resolver
 * is fail-closed — `if threshold is None: return None, None` — so no threshold
 * means SILENCE, not this warning. The sentence firing is positive evidence the
 * target DID arrive. That is why the replacement copy STATES THE CAPTURE as a
 * fact rather than implying the target was lost.
 *
 * ⭐ WHY THIS GUARD IS DERIVED AND NOT A LITERAL MATCH.
 * A spec that only asserted "the title no longer contains this sentence I also
 * wrote" is a guard agreeing with itself (trap 13b), and it would keep passing
 * forever — including on the day the instruction becomes LEGITIMATE. So the
 * absence of the instruction is pinned TO ITS REASON: the goal editors carry no
 * `observed_state` writer. Add one and this file REDs, which is the correct
 * moment to put the instruction back.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { humaniseCritique } from '../utils/humaniseCritique'
import type { UncertaintyItem } from '../types'

// cwd-relative: `import.meta.url` is not a file: URL under this vitest config,
// and a spec that cannot read its subject reports a clean sweep of nothing
// (trap 13 — an absence probe needs a positive control).
const GOAL_EDITOR_FILES = [
  'src/canvas/ui/inspector-v2/panels/GoalPanel.tsx',
  'src/canvas/ui/inspector/GoalThresholdEditor.tsx',
] as const

function item(code: string): UncertaintyItem {
  return {
    code,
    severity: 'warning',
    message: 'raw producer prose — must never render',
  } as UncertaintyItem
}

/**
 * Every string a user could read from this template, concatenated. The strip and
 * the Advanced list render the TITLE ALONE, but `suggestion` is a prescription
 * regardless of which surface picks it up, so the ban covers all of it.
 */
function userReadableStrings(code: string): string {
  const r = humaniseCritique(item(code))
  return [r.title, r.description, r.suggestion ?? '', r.displayText ?? ''].join('. ')
}

/**
 * Imperatives that would send the user to set the goal's current level. Written
 * as verb + object pairs so ordinary prose ABOUT the missing level ("no current
 * level is recorded for the goal") is not caught — the defect is the
 * PRESCRIPTION, not the fact.
 */
const PRESCRIBES_CURRENT_LEVEL =
  /\b(state|set|enter|record|add|provide|supply|specify|give|fill in|input|capture)\b[^.!?]{0,40}\b(current level|level for your goal|goal'?s current|present level|today'?s level|baseline)\b/i

describe('GOAL_THRESHOLD_NOT_CONVERTIBLE prescribes no action, because no action exists', () => {
  it('the goal editors have NO observed_state writer — the derived reason the instruction is unreachable', () => {
    for (const rel of GOAL_EDITOR_FILES) {
      const abs = resolve(process.cwd(), rel)
      // Positive controls first: the subject must exist and be readable, or
      // every assertion below passes by testing nothing.
      expect(existsSync(abs), `${rel} must exist — scope the sweep before claiming a zero`).toBe(true)
      const src = readFileSync(abs, 'utf8')
      expect(src.length, `${rel} must be non-empty`).toBeGreaterThan(1000)
      // Contrast control: a same-family token we expect PRESENT. Absence is
      // only proven when the target reads zero AND the contrast reads non-zero
      // in the same run.
      expect(
        (src.match(/target/gi) ?? []).length,
        `${rel} contrast control: 'target' must be present, or the probe is blind`,
      ).toBeGreaterThan(0)
      // The measurement the copy change rests on.
      expect(
        (src.match(/observed_state/gi) ?? []).length,
        `${rel} writes observed_state — if a goal current-level editor now exists, ` +
          `the instruction removed for ROADMAP 2.281 has become legitimate: restore it ` +
          `in humaniseCritique.ts GOAL_THRESHOLD_NOT_CONVERTIBLE and update this guard.`,
      ).toBe(0)
    }
  })

  it('no user-readable string tells the user to state a current level', () => {
    const text = userReadableStrings('GOAL_THRESHOLD_NOT_CONVERTIBLE')
    // The probe must be capable of firing. If this control ever fails the
    // matcher has rotted and the assertion below is vacuous.
    expect(
      PRESCRIBES_CURRENT_LEVEL.test('State the current level for your goal'),
      'matcher rot control: the removed instruction must still match',
    ).toBe(true)
    expect(
      PRESCRIBES_CURRENT_LEVEL.test('Set a baseline for the goal'),
      'matcher rot control: a reworded instruction must still match',
    ).toBe(true)
    // ...and it must NOT fire on the fact, only on the prescription.
    expect(
      PRESCRIBES_CURRENT_LEVEL.test('no current level is recorded for the goal'),
      'matcher must not catch prose stating the fact',
    ).toBe(false)

    expect(text).not.toMatch(PRESCRIBES_CURRENT_LEVEL)
  })

  it('carries no suggestion at all — there is no remedy to name', () => {
    const r = humaniseCritique(item('GOAL_THRESHOLD_NOT_CONVERTIBLE'))
    expect(r.suggestion).toBeUndefined()
  })

  it('keeps BOTH facts: the target was captured, and goal-fit was withheld', () => {
    const r = humaniseCritique(item('GOAL_THRESHOLD_NOT_CONVERTIBLE'))
    // Fact 1 — the target ARRIVED. ISL stays silent when no threshold is
    // requested, so this warning firing proves capture. The old wording
    // ("couldn't be measured for this run") read as "we could not find your
    // target", which is not what the code means.
    expect(r.title).toMatch(/\b(was|were)\s+(recorded|captured|received|saved)\b/i)
    // Fact 2 — the withhold, on the surface that actually renders.
    expect(r.title).toMatch(/withheld|left out/i)
    // Still goal-scoped, still banner-eligible, still no raw producer prose.
    expect(r.title.toLowerCase()).toContain('goal')
    expect(r.title.toLowerCase()).not.toContain('factor')
    expect(r.displayText).toBe(r.title)
    expect(r.title).not.toContain('raw producer prose')
    expect(r.description).not.toContain('raw producer prose')
  })

  it('CONTRAST: the sibling GOAL_THRESHOLD_FRAME_UNSPECIFIED keeps its instruction, which IS reachable', () => {
    // Restating the target as a level or a change is done in
    // `GoalThresholdEditor` — a target editor. That remedy has an acceptance
    // path, so its instruction stays. This is the discriminating half: a change
    // that stripped instructions from the whole family would RED here.
    const r = humaniseCritique(item('GOAL_THRESHOLD_FRAME_UNSPECIFIED'))
    expect(r.suggestion).toBeTruthy()
    expect(r.suggestion).toMatch(/level|change/i)
    expect(r.title).toMatch(/restate the target/i)
  })
})
