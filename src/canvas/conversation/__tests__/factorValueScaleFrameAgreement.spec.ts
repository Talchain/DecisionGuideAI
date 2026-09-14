/**
 * ⭐⭐ THE UI's "HAS THIS FACTOR A USABLE SCALE?" MUST AGREE WITH THE ENGINE'S.
 *
 * ── THE DEFECT THIS PINS ───────────────────────────────────────────────────
 * `factorValueHasNoUsableScale` read only `cap`, `unit` and `value`. It never
 * read `raw_value`. So on a CAPLESS FRAMED PAIR — `{value: 7, raw_value: 70}`,
 * the shape CEE's own records projector and canonical edit writer PRODUCE — the
 * panel told the user the factor had "no scale recorded" while the engine had
 * already resolved its frame (10) and the run gate EXEMPTED it.
 *
 * The user then follows the prescribed remedy, "Ask Olumi to set the range it
 * can move between", and Olumi refuses it: *"I can set X to a single value, but
 * I can't currently store a movable range like 0 to 100 on it."* A false alarm
 * that terminates in a refusal is worse than silence, which is why this is
 * pinned rather than left to the next capture.
 *
 * ── THE PREMISE THAT WAS FALSE, NAMED (it is the root cause) ────────────────
 * Both this predicate's header and the panel's said: *"a factor with no cap and
 * no unit holds `value` AS the model scale — CEE persists `raw_value = value`
 * on that shape."* **That is refuted at CEE's bytes.** The records projector
 * (pass 3d) writes magnitude-scaled factors as CAPLESS FRAMED PAIRS: `value` is
 * the level (raw ÷ frame) and `raw_value` is the user's magnitude, and the frame
 * is deliberately NOT persisted as a `cap` because a stored cap would flip every
 * later edit to cap-normalised writes. Capless therefore does NOT imply
 * `raw_value === value`; it is precisely where the pair carries the frame.
 * (`olumi-assistants-service` `staging` @ `c6c16885`,
 * `src/orchestrator-v5/tools/handlers/d1-shared/scale-frame.ts:1-38`.)
 *
 * ── CEE's ALGORITHM, DERIVED AT THE BYTES (not inferred from the symptom) ───
 * `recoverScaleFrame({value, raw_value})` — same file, lines 39-52:
 *   value finite number · raw finite number · `value > 0` · `raw > value` ·
 *   `frame = raw / value` finite and `> 1` ⇒ the frame. Otherwise `undefined`.
 * Its consumer, the run gate `findScaleIncoherentBaselineFactorIds`
 * (`src/orchestrator-v5/tools/plot-intervention-scale.ts:813`), CONTINUES —
 * i.e. exempts the factor — whenever that call returns a frame.
 *
 * ⚠⚠ THIS IS A CROSS-REPO MIRROR AND IT CANNOT BE IMPORTED. CEE's function
 * lives in a different service; there is no shared package carrying it (swept
 * at `b93904c9`: `recoverScaleFrame|scale_frame|scaleFrame` = 0 files across
 * the UI's `src`, against a contrast control of `raw_value` = 188 files, so the
 * absence is real and not instrument blindness). Duplicating a rule is this
 * estate's dominant defect class (CLAUDE.md trap 12), so the duplication is
 * made LOUD rather than left implicit: the `ceeFrame` column below is CEE's
 * OWN output, executed against the extracted function body, and every row
 * asserts the UI predicate against it. If CEE's rule changes, these rows RED
 * here instead of surfacing as a user-visible contradiction.
 *
 * ── WHAT WOULD MAKE THEM DRIFT ─────────────────────────────────────────────
 * A change to any of `recoverScaleFrame`'s four preconditions, or to the gate's
 * decision to consult it. Nothing in either repo enforces the coupling at build
 * time — this spec is the whole of it.
 *
 * ⛔ WHAT THIS DOES NOT CLAIM. Not that the UI predicate reproduces the GATE.
 * The gate carries exemptions this call site structurally cannot see — a
 * `cap` at `data.cap`/`node.cap` (the UI reads only `observed_state.cap`), and
 * the round-5 "self-framed" exemption, which depends on the factor's per-option
 * intervention values and is not reachable from one node's `data`. Those
 * residuals leave the UI warning WIDER than the gate in known shapes; they are
 * reported in the PR body, not silently closed here. This spec pins exactly one
 * question: the pair-encoded frame.
 *
 * RED-first at pristine `b93904c9`, named signature:
 *   `factorValueHasNoUsableScale({observedState: {value: 7, raw_value: 70}})`
 *   returned `true` while `recoverScaleFrame({value: 7, raw_value: 70})`
 *   returns `10` — the row labelled "capless framed pair" below.
 *
 * ⚠ ASSERTIONS BIND BY IDENTITY — each row is addressed by its own `label`, and
 * the failure message names it, so a row cannot pass on a sibling's behalf
 * (CLAUDE.md trap 19).
 */

import { describe, it, expect } from 'vitest'
import { factorValueHasNoUsableScale, recoverScaleFrameFromPair } from '../factorValueEdit'

/**
 * One stored shape, CEE's verdict on it, and the UI verdict that must follow.
 *
 * `ceeFrame` is NOT this file's opinion. It is the value CEE's
 * `recoverScaleFrame` returns, executed 2026-09-11 against the function body
 * extracted verbatim from `scale-frame.ts:43-52` at `c6c16885` (body md5
 * `4b5fb76435c545ea01f9116c3f607c9d`). The transcript is in the PR body.
 */
interface AgreementRow {
  readonly label: string
  /** The `observed_state` as stored on the node. */
  readonly observedState: Record<string, unknown>
  /** What `recoverScaleFrame` returns for this shape. `undefined` = no frame. */
  readonly ceeFrame: number | undefined
  /** What `factorValueHasNoUsableScale` must answer. */
  readonly expectNoUsableScale: boolean
  /**
   * Set where the UI answers `false` for a reason CEE's frame recovery does not
   * model (a cap or a unit). On those rows the two agree on the OUTCOME but not
   * via the frame, so the derived cross-check below does not apply.
   */
  readonly exemptBeforeFrame?: true
}

const ROWS: readonly AgreementRow[] = [
  // ── THE DISAGREEING ROW — the whole reason this file exists ──────────────
  {
    label: 'capless framed pair {value: 7, raw_value: 70} — frame 10 IS recoverable',
    observedState: { value: 7, raw_value: 70, source: 'user' },
    ceeFrame: 10,
    expectNoUsableScale: false,
  },
  // ── THE ROW THAT MUST KEEP WARNING — this is not a deletion ──────────────
  {
    label: 'bare raw baseline {value: 70, raw_value: 70} — raw > value fails, no frame',
    observedState: { value: 70, raw_value: 70, source: 'user' },
    ceeFrame: undefined,
    expectNoUsableScale: true,
  },
  {
    label: 'capped {value: 0.55, raw_value: 55, cap: 100} — the cap IS the scale',
    observedState: { value: 0.55, raw_value: 55, cap: 100, source: 'user' },
    // NOT 100. `55 / 0.55` is `99.99999999999999` in IEEE-754 double, and the
    // literal round-trips exactly. This row was first written as `100` from the
    // brief's "~100" and the fidelity check below REDed on it — which is the
    // check earning its place: an approximated expectation is an opinion, and
    // the mirror must reproduce CEE's ARITHMETIC, not a tidy number near it.
    ceeFrame: 99.99999999999999,
    expectNoUsableScale: false,
    exemptBeforeFrame: true,
  },

  // ── BOUNDARIES OF EACH PRECONDITION, one row per clause ──────────────────
  {
    label: 'value === raw exactly (`raw > value` is strict): no frame',
    observedState: { value: 5, raw_value: 5 },
    ceeFrame: undefined,
    expectNoUsableScale: true,
  },
  {
    label: 'raw a hair above value: a frame just over 1 still counts',
    observedState: { value: 5, raw_value: 5.0000001 },
    ceeFrame: 1.00000002,
    expectNoUsableScale: false,
  },
  {
    label: 'negative value beside a positive magnitude (`value > 0` fails)',
    observedState: { value: -7, raw_value: 70 },
    ceeFrame: undefined,
    expectNoUsableScale: true,
  },
  {
    label: 'negative pair — frames divide positives, refused sign-symmetrically',
    observedState: { value: -7, raw_value: -70 },
    ceeFrame: undefined,
    expectNoUsableScale: true,
  },
  {
    label: 'raw BELOW value {value: 70, raw_value: 7} — inverted, no frame',
    observedState: { value: 70, raw_value: 7 },
    ceeFrame: undefined,
    expectNoUsableScale: true,
  },
  {
    label: 'no raw_value at all — a level with no magnitude beside it',
    observedState: { value: 7 },
    ceeFrame: undefined,
    expectNoUsableScale: true,
  },
  {
    label: 'raw_value null — not a number, no frame',
    observedState: { value: 7, raw_value: null },
    ceeFrame: undefined,
    expectNoUsableScale: true,
  },
  {
    label: 'over-frame edit {value: 5, raw_value: 500000} — honest 5x, frame 100000',
    observedState: { value: 5, raw_value: 500000 },
    ceeFrame: 100000,
    expectNoUsableScale: false,
  },
  {
    label: 'framed pair INSIDE [0,1] {value: 0.74, raw_value: 74000}',
    observedState: { value: 0.74, raw_value: 74000 },
    ceeFrame: 100000,
    expectNoUsableScale: false,
    exemptBeforeFrame: true,
  },
  {
    label: 'unit without a cap {value: 40000, unit: "£"} — the unit reads the magnitude',
    observedState: { value: 40000, raw_value: 40000, unit: '£' },
    ceeFrame: undefined,
    expectNoUsableScale: false,
    exemptBeforeFrame: true,
  },
]

describe('the UI scale disclosure agrees with CEE`s recoverScaleFrame', () => {
  for (const row of ROWS) {
    it(`${row.expectNoUsableScale ? 'DISCLOSES' : 'stays silent'} — ${row.label}`, () => {
      expect(
        factorValueHasNoUsableScale({ observedState: row.observedState }),
        `disagreement on: ${row.label} (CEE frame: ${String(row.ceeFrame)})`,
      ).toBe(row.expectNoUsableScale)
    })
  }

  /**
   * ⭐ THE TABLE IS CHECKED AGAINST THE RULE, not just against itself.
   *
   * Without this, a future edit could "fix" a RED row by rewriting its
   * `expectNoUsableScale` and the suite would go green on a fresh
   * disagreement. This asserts the derivation that generates the column: where
   * the UI is not exempted earlier by a cap or a unit, the disclosure fires
   * EXACTLY when CEE recovers no frame.
   */
  it('every non-exempt row`s expectation IS CEE`s verdict, not a free-standing opinion', () => {
    const derived = ROWS.filter(r => r.exemptBeforeFrame !== true).map(r => ({
      label: r.label,
      expected: r.expectNoUsableScale,
      fromCee: r.ceeFrame === undefined,
    }))
    expect(derived.length, 'the derived-row set must not be empty').toBeGreaterThan(0)
    for (const d of derived) {
      expect(d.expected, `row states an expectation CEE does not support: ${d.label}`).toBe(
        d.fromCee,
      )
    }
  })

  /**
   * ⭐⭐ THE MIRROR'S NUMBERS, NOT JUST ITS BOOLEAN.
   *
   * The predicate rows above would still pass if `recoverScaleFrameFromPair`
   * returned a WRONG frame that happened to be non-`undefined` on the same
   * rows — a mirror agreeing with itself. This asserts the actual quotient
   * against CEE's own executed output, so a drift in the arithmetic (not only
   * in the preconditions) REDs here.
   */
  it('recoverScaleFrameFromPair reproduces CEE`s frame exactly, row by row', () => {
    let recovered = 0
    let none = 0
    for (const row of ROWS) {
      const mine = recoverScaleFrameFromPair(row.observedState.value, row.observedState.raw_value)
      if (mine === undefined) none++
      else recovered++
      expect(mine, `mirror diverged from CEE on: ${row.label}`).toBe(row.ceeFrame)
    }
    // The instrument must DISCRIMINATE: a mirror that returned `undefined` for
    // everything would satisfy every `undefined` row and prove nothing
    // (CLAUDE.md trap 13 — an absence probe needs a positive control).
    expect(recovered, 'no row recovered a frame — the mirror is not discriminating').toBeGreaterThan(0)
    expect(none, 'no row refused a frame — the mirror is not discriminating').toBeGreaterThan(0)
  })

  /**
   * PRECONDITION PIN (CLAUDE.md trap 13b): the table must contain BOTH verdicts.
   * A table that had drifted to all-silent would pass every assertion above
   * while pinning nothing — the disclosure could be deleted outright.
   */
  it('the table discriminates — it contains both a disclosing and a silent row', () => {
    expect(ROWS.some(r => r.expectNoUsableScale)).toBe(true)
    expect(ROWS.some(r => !r.expectNoUsableScale)).toBe(true)
  })
})
