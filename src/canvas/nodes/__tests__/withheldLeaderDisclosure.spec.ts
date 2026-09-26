import { describe, it, expect } from 'vitest'
import {
  selectWithheldLeaderDisclosure,
  LEADER_WITHHOLDING_CODES,
} from '../withheldLeaderDisclosure'

/**
 * The corpus is the FOUNDER RUN, not an invention.
 *
 * Every entry below is copied from debug export `44e349fa` (UI `ab6ae8a6`,
 * staging, 2026-09-14 17:41Z) — the run that produced the complaint. The
 * `CONSTRAINT_TARGET_UNRELIABLE` entry carries NO `field` and NO
 * `affected_nodes`, which is why the anonymous template form is the expected
 * output rather than a named one; that is a measurement, not a shortcut.
 *
 * ⚠ THE MESSAGE STRINGS ARE KEPT VERBATIM ON PURPOSE. They are what the
 * producer actually emitted, and the no-raw-message assertion below is only
 * meaningful against the real text.
 */
const REAL_WARNINGS = [
  {
    code: 'CONSTRAINT_TARGET_UNRELIABLE',
    message:
      'The target on "Subscriber Churn Rate" can\'t be scored against this model: "Subscriber Churn Rate" is calculated from the factors feeding into it, so the analysis produces a modelled change for it, not a reading on the same scale as your target.',
    severity: 'warning',
  },
  {
    code: 'CONSTRAINT_NODE_DEFAULT_BASE',
    message: "Node '8b73e070' has no ParameterUncertainty — base offset defaulted to 0",
    severity: 'info',
    field: 'nodes[8b73e070].base',
  },
  {
    code: 'CONSTRAINT_FRAME_UNSPECIFIED',
    message: 'constraint value=0.07 was supplied without goal_constraints[0].value_frame',
    severity: 'warning',
    field: 'goal_constraints[0].value_frame',
  },
] as const

describe('selectWithheldLeaderDisclosure — why no option was put forward', () => {
  it('returns the producer reason and the concrete move, on the founder payload', () => {
    const got = selectWithheldLeaderDisclosure({
      inference_warnings: [...REAL_WARNINGS],
    } as never)

    expect(got).not.toBeNull()
    // Bound to the CAUSE by identity, not to the sentence's wording.
    expect(got!.code).toBe('CONSTRAINT_TARGET_UNRELIABLE')
    // Template-owned substrings — the object here is the template, so these
    // bind to it rather than to a full string another template could match.
    // ⚠ NARROWED from "success target can't be evaluated reliably". The
    // anonymous form reads "A success target ON YOUR MODEL can't be evaluated
    // reliably", so the old contiguous substring cannot match it — the words it
    // spans are interrupted by the very clause that removes the fabricated kind.
    // This fragment is present in BOTH the named and the anonymous form, so the
    // assertion binds to the template rather than to one of its two branches.
    expect(got!.title).toContain("can't be evaluated reliably")
    expect(got!.title).toContain('success target')
    // ⚠ THIS ASSERTION USED TO READ `toContain('Set a value or range for')` — the
    // NAMED form's exact prefix. `REAL_WARNINGS` carries no `affected_nodes` and
    // no resolvable id (measured: the producer sends `{code, message, severity}`),
    // so this payload takes the ANONYMOUS branch, whose suggestion is worded for
    // a sentence with no subject. Binding to the named prefix bound this test to
    // a string the fixture could never produce once the anonymous form existed.
    // It now binds to what the test is actually for: a concrete route out
    // survives when the label does not. See `anUnresolvedLabelIsNotAName.spec.ts`.
    // ⛔ REVERSED, 26 Sep 2026 (AI Quality, #70 5843266323: the wire cannot tell a missing value from an uncheckable target, and on Paul's churn limit PLoT said a value "would not change that"): no remedy is prescribed.
    expect(got!.suggestion).toBe('')
    // And the sentinel never reaches this surface — the defect that occasioned
    // the change was this exact selector rendering it on the Question card.
    expect(`${got!.title} ${got!.suggestion}`).not.toContain('This factor')
  })

  it('⛔ NEVER ECHOES THE PRODUCER MESSAGE — the V14.3 no-raw-message rule', () => {
    const got = selectWithheldLeaderDisclosure({
      inference_warnings: [...REAL_WARNINGS],
    } as never)!

    const rendered = `${got.title} ${got.suggestion}`
    // The real message's distinctive internal phrasing must not survive.
    expect(rendered).not.toContain('is calculated from the factors feeding into it')
    expect(rendered).not.toContain('goal_constraints[0]')
    expect(rendered).not.toContain('8b73e070')
  })

  it('reads the LEGACY robustness slot too, so a mapper on either slot discloses', () => {
    const got = selectWithheldLeaderDisclosure({
      robustness: { inference_warnings: [REAL_WARNINGS[0]] },
    } as never)
    expect(got?.code).toBe('CONSTRAINT_TARGET_UNRELIABLE')
  })

  /**
   * ⭐ THE CONTRAST CONTROL. Without it, a selector that returned a disclosure
   * for EVERY warning would pass the first test — and this surface's whole
   * value is that it fires only when the producer says it withheld.
   */
  it('says nothing when the run carried warnings but withheld no recommendation', () => {
    const got = selectWithheldLeaderDisclosure({
      inference_warnings: [REAL_WARNINGS[1], REAL_WARNINGS[2]],
    } as never)
    expect(got).toBeNull()
  })

  it('says nothing on a report with no warnings, an absent key, or a non-array', () => {
    expect(selectWithheldLeaderDisclosure({ inference_warnings: [] } as never)).toBeNull()
    expect(selectWithheldLeaderDisclosure({} as never)).toBeNull()
    expect(selectWithheldLeaderDisclosure(null as never)).toBeNull()
    expect(
      selectWithheldLeaderDisclosure({ inference_warnings: { items: [] } } as never),
    ).toBeNull()
  })

  /**
   * ⭐⭐ THE SET IS PINNED EXACTLY — RED IF IT GROWS *OR* SHRINKS.
   *
   * `LEADER_WITHHOLDING_CODES` is a hand-maintained list and the module says so:
   * the withholding semantics live in each template's prose, not in a
   * structured field, so there is nothing to derive from. This is the
   * mitigation. A code added without its argument REDs here; a code silently
   * dropped REDs here too.
   */
  it('pins the withholding set to exactly one code', () => {
    expect([...LEADER_WITHHOLDING_CODES].sort()).toEqual(['CONSTRAINT_TARGET_UNRELIABLE'])
  })

  /**
   * ⛔ THE DELIBERATE EXCLUSION, PINNED AS A BEHAVIOUR RATHER THAN AS A COMMENT.
   *
   * `CONSTRAINT_DIRECTION_SUSPECT`'s template also says a goal-fit figure
   * "isn't shown" — but scoped to ONE OPTION. This surface is the run-wide
   * Question card, so attributing it here would tell the user the whole run was
   * withheld when one option was. If a later change decides that code belongs,
   * this test is the place the argument has to be made.
   */
  it('does not treat a PER-OPTION withholding as a run-wide one', () => {
    const got = selectWithheldLeaderDisclosure({
      inference_warnings: [
        {
          code: 'CONSTRAINT_DIRECTION_SUSPECT',
          message: "constraint direction for fac_churn could not be confirmed",
          severity: 'warning',
        },
      ],
    } as never)
    expect(got).toBeNull()
  })
})
