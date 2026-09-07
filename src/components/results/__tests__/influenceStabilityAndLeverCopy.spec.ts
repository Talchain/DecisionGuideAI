/**
 * THE FIGURE SAYS WHETHER IT MOVES, AND WHICH KIND OF ROW IT IS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE FOUNDING QUESTION, AND WHY NEITHER ANSWER WAS ON SCREEN
 * ═══════════════════════════════════════════════════════════════════════════
 * The question put to this product was whether it builds poor models or
 * displays good ones badly. The measured answer is neither: on the structural
 * basis the factor influence figure is not an output of the run at all. It is
 * a normalised sum over paths of products of authored edge strengths, computed
 * independently of the ISL result. So a re-run moves the option shares and
 * leaves every factor figure standing still, and nothing on screen says so.
 *
 * Two independent proofs, both recorded in `influenceScaleCopy.ts`:
 *   · `importance_basis` reads `"graph_structural"` on 67 of 67 stamped factor
 *     rows across 12 captures, with no other value anywhere in the corpus;
 *   · a founder added an option, the leading option changed outright, and all
 *     five canvas influence numbers were byte-identical across both runs.
 *
 * ⚠ THE FIX IS DISCLOSURE, NEVER REMOVAL. The figure is real and useful —
 * honest structural leverage is exactly what a team needs when deciding where
 * to push. What was wrong is the sentence attached to it, and there was no
 * sentence at all.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO QUESTIONS, TWO GATES, AND THE SECOND GATE IS STRICTLY THE STRONGER
 * ═══════════════════════════════════════════════════════════════════════════
 * PR #1270 shipped the QUANTITY disclosure ("these show structural influence")
 * and gated it so that only an UNRECOGNISED stamp withholds it; an absent stamp
 * still renders, because blanking the noun on 56 of 123 legacy rows would be a
 * regression rather than caution.
 *
 * ⚠⚠ THAT GATE IS CORRECT FOR ITS OWN CLAIM AND TOO WEAK FOR THIS ONE, AND
 * COLLAPSING THE TWO IS THE AVAILABLE MISTAKE (CLAUDE.md trap 21). The two
 * sentences answer different questions:
 *
 *   · "which quantity is this?"      -> supported by the fallback wording even
 *                                       when nothing is stamped, because the
 *                                       app knows what IT computed.
 *   · "does this move when I re-run?" -> a claim about WHICH PRODUCER built the
 *                                       response, and only the stamp says that.
 *
 * `importance_basis` is closed at two values in the producer
 * (`graph_structural | isl_uncertainty`), and on the ISL arm `influence_score`
 * is Monte-Carlo output, which DOES move between runs. So an unstamped payload
 * cannot support an invariance claim: we do not know which arm produced it.
 * Hence `confirmed` only, which is strictly stronger than #1270's gate.
 *
 * This is not a hypothetical narrowing. It is the difference between a true
 * sentence and a false one on a run this codebase can already receive.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE LEVER, WHICH IS THE SAME NUMBER MEANING THE OPPOSITE THING
 * ═══════════════════════════════════════════════════════════════════════════
 * A factor the user's own options control has its sensitivity DELIBERATELY
 * suppressed by the producer and is stamped `zero_reason: 'intervention_override'`
 * (measured in `influenceScaleCopy.ts`: all 36 stamped rows where `elasticity`
 * and `influence_score` disagree carry exactly that stamp, with `elasticity === 0`
 * and `influence_score > 0` on every one).
 *
 * So such a factor can rank at the very top of this panel AND be correctly
 * absent from "what is worth resolving". Both are right, and a reader given
 * neither sentence is left to conclude the product contradicts itself. Saying
 * which kind of row it is, is the product.
 *
 * ⚠ THE LEVER SENTENCE IS GATED ON THE STRUCTURAL BASIS, AND THAT IS A FACT
 * ABOUT THE FILTER, NOT A PREFERENCE. On the fallback basis a demoted lever
 * carries a near-zero magnitude, so the >= 0.01 visibility filter removes it
 * from the rendered list entirely. A sentence about rows the reader cannot see
 * would be furniture.
 */

import { describe, it, expect } from 'vitest'

import {
  INFLUENCE_STABILITY_DISCLOSURE,
  INFLUENCE_LEVER_DISCLOSURE,
  influenceStabilityDisclosureForRun,
  influenceLeverDisclosureForRun,
  influenceQuantityRunDisclosureForRun,
  ZERO_REASON_BADGE_LABELS,
  IMPORTANCE_BASIS_GRAPH_STRUCTURAL,
} from '../influenceScaleCopy'

const CONFIRMED = [IMPORTANCE_BASIS_GRAPH_STRUCTURAL, IMPORTANCE_BASIS_GRAPH_STRUCTURAL]
const UNSTAMPED = [undefined, null, '']
const UNRECOGNISED = [IMPORTANCE_BASIS_GRAPH_STRUCTURAL, 'isl_uncertainty']

const LEVER = ['intervention_override' as const]
const NO_LEVER = ['disconnected' as const, 'zero_outcome_diff' as const, null]

describe('the stability disclosure — does this figure move when I re-run?', () => {
  it('POSITIVE CONTROL: the copy exists, is real prose, and is reachable', () => {
    // Without this every "withheld" assertion below could pass on an export
    // that was renamed or blanked — an instrument that cannot fail (trap 13).
    expect(INFLUENCE_STABILITY_DISCLOSURE).toBeTruthy()
    expect(INFLUENCE_STABILITY_DISCLOSURE.length).toBeGreaterThan(20)
    expect(influenceStabilityDisclosureForRun('influence_score', CONFIRMED))
      .toBe(INFLUENCE_STABILITY_DISCLOSURE)
  })

  it('says the figure does not change on a re-run, which is the whole point', () => {
    // Bound to the PROPERTY the founding question asked about, not to one
    // phrasing: a rewording that dropped the invariance claim must RED here.
    expect(INFLUENCE_STABILITY_DISCLOSURE).toMatch(/re-?run/i)
    expect(INFLUENCE_STABILITY_DISCLOSURE).toMatch(/not change|does not change/i)
  })

  /**
   * ⭐⭐ THE DISCRIMINATING PAIR FOR THE GATE, BOTH ARMS ASSERTED.
   *
   * `confirmed` renders and BOTH other trust states withhold. Either half alone
   * would survive the gate being inverted or deleted; the pair does not.
   */
  it('renders ONLY on a confirmed producer stamp', () => {
    expect(influenceStabilityDisclosureForRun('influence_score', CONFIRMED))
      .toBe(INFLUENCE_STABILITY_DISCLOSURE)
    expect(influenceStabilityDisclosureForRun('influence_score', UNSTAMPED)).toBeNull()
    expect(influenceStabilityDisclosureForRun('influence_score', UNRECOGNISED)).toBeNull()
  })

  it('is STRICTLY STRONGER than the quantity gate on an unstamped run', () => {
    /**
     * ⭐ THE ASSERTION THAT PROVES THE TWO GATES ARE NOT THE SAME GATE.
     *
     * On an unstamped run #1270's quantity disclosure RENDERS and this one is
     * WITHHELD. A refactor that "tidied" the two into one predicate would make
     * these two expectations contradict each other, which is exactly the
     * collapse trap 21 warns about. Pinning both sides in one test means the
     * collapse cannot happen quietly in either direction.
     */
    expect(influenceQuantityRunDisclosureForRun('influence_score', UNSTAMPED)).toBeTruthy()
    expect(influenceStabilityDisclosureForRun('influence_score', UNSTAMPED)).toBeNull()
  })

  it('is withheld on the fallback basis, whose figures are not run-invariant', () => {
    expect(influenceStabilityDisclosureForRun('normalised_elasticity', CONFIRMED)).toBeNull()
    expect(influenceStabilityDisclosureForRun(null, CONFIRMED)).toBeNull()
  })
})

describe('the lever disclosure — which kind of row is this?', () => {
  it('POSITIVE CONTROL: the copy exists and is reachable on a lever run', () => {
    expect(INFLUENCE_LEVER_DISCLOSURE).toBeTruthy()
    expect(INFLUENCE_LEVER_DISCLOSURE.length).toBeGreaterThan(20)
    expect(influenceLeverDisclosureForRun('influence_score', CONFIRMED, LEVER))
      .toBe(INFLUENCE_LEVER_DISCLOSURE)
  })

  it('QUOTES THE BADGE, DERIVED — so the two spellings cannot drift apart', () => {
    /**
     * The sentence points the reader at a badge rendered on the row. If the
     * badge label is ever reworded and this sentence is not, the sentence names
     * a badge that does not exist. Derived from the same record rather than
     * copied (CLAUDE.md trap 12), and asserted so that a later hand-typed
     * literal REDs here.
     */
    expect(INFLUENCE_LEVER_DISCLOSURE)
      .toContain(ZERO_REASON_BADGE_LABELS.intervention_override)
  })

  it('says both halves: nothing to resolve, and it can still rank at the top', () => {
    // The defect is a reader concluding the product contradicts itself. Only
    // BOTH clauses together dissolve that, so both are pinned.
    expect(INFLUENCE_LEVER_DISCLOSURE).toMatch(/nothing to resolve/i)
    expect(INFLUENCE_LEVER_DISCLOSURE).toMatch(/rank/i)
  })

  /**
   * ⭐⭐ THE DISCRIMINATING PAIR FOR THE LEVER PREDICATE.
   *
   * Present -> rendered; every other producer stamp -> withheld. The negative
   * arm uses the OTHER TWO REAL CODES rather than an empty list, so the test
   * cannot pass merely because nothing was stamped: it proves the predicate
   * discriminates BETWEEN codes, not merely between something and nothing.
   */
  it('renders only when a visible row is actually an option-controlled lever', () => {
    expect(influenceLeverDisclosureForRun('influence_score', CONFIRMED, LEVER))
      .toBe(INFLUENCE_LEVER_DISCLOSURE)
    expect(influenceLeverDisclosureForRun('influence_score', CONFIRMED, NO_LEVER)).toBeNull()
    expect(influenceLeverDisclosureForRun('influence_score', CONFIRMED, [])).toBeNull()
  })

  it('inherits the confirmed-stamp gate and the structural basis', () => {
    expect(influenceLeverDisclosureForRun('influence_score', UNSTAMPED, LEVER)).toBeNull()
    expect(influenceLeverDisclosureForRun('influence_score', UNRECOGNISED, LEVER)).toBeNull()
    expect(influenceLeverDisclosureForRun('normalised_elasticity', CONFIRMED, LEVER)).toBeNull()
  })
})

describe('both sentences obey the copy rules this estate already enforces', () => {
  const NEW_COPY: Array<[string, string]> = [
    ['INFLUENCE_STABILITY_DISCLOSURE', INFLUENCE_STABILITY_DISCLOSURE],
    ['INFLUENCE_LEVER_DISCLOSURE', INFLUENCE_LEVER_DISCLOSURE],
  ]

  it.each(NEW_COPY)('%s introduces no contest framing', (_name, copy) => {
    // The founder has ruled out race framing outright, and a sibling lane is
    // rewriting the copy that still carries it. This lane must add none.
    expect(copy).not.toMatch(/\b(winner|wins|ahead|leads|leading|beats|beat|loser|race)\b/i)
  })

  it.each(NEW_COPY)('%s does not attribute the figure to the run', (_name, copy) => {
    // The same property `influenceScaleCopy.noRunProvenance.spec.ts` enforces
    // over the rest of the module. The stability sentence DENIES the
    // attribution, so it must be careful not to assert it in passing.
    expect(copy).not.toMatch(/from the analysis/i)
    expect(copy).not.toMatch(/from the run\b/i)
    expect(copy).not.toMatch(/\bproduced by the (analysis|run)\b/i)
  })

  it.each(NEW_COPY)('%s claims no absolute scale', (_name, copy) => {
    expect(copy.toLowerCase()).not.toContain('absolute')
  })
})
