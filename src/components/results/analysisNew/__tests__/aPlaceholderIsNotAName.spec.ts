/**
 * ⛔⛔ THE PANEL LED WITH THE WORD "Question" AT 18px, AND I SHIPPED IT.
 *
 * Witnessed on served `00805be1` — the deploy of #1654, the PR that added the
 * lead — as a guest, on a model drafted live by CEE from a real brief:
 *
 *   analysis-new-model-strip-lead  ->  "Question"   (18px, weight 600)
 *   subtitle                       ->  "replace our customer data platform…"
 *
 * The decision node's label IS the string `Question`, and the node says so
 * itself: `label_placeholder: true`. The producer knows the name is a
 * placeholder and stamps it. **Nothing in the UI read that flag** — zero
 * consumers repo-wide, against a contrast control of 53 `provenance` reads in
 * the same directory. A field computed, emitted, and never read.
 *
 * ⚠ AND THE LEAD MADE IT WORSE, NOT NEUTRAL. Before #1654 the strip's subject
 * was `goalLabel ?? NO_SUBJECT_LABEL`, so this model showed its goal. After it,
 * a placeholder is promoted to the largest type on the surface. That is a
 * regression on drafted models and it is mine.
 *
 * ⭐ THE GUARD IS STRUCTURAL, NOT A PREDICATE OVER LANGUAGE. It reads the
 * producer's own flag. It does not sniff for words that look like field names —
 * that would be the natural-language predicate class this estate has oscillated
 * on four times.
 *
 * ⚠ SCOPE: `label_placeholder` was observed on ONE live draft. The five
 * starters all carry real decision names and are unaffected — verified. So this
 * fixes a reachable minority path without touching the majority one.
 */
import { describe, expect, it } from 'vitest'
import { buildModelStrip } from '../buildModelStrip'

const node = (id: string, type: string, data: Record<string, unknown>) => ({ id, type, data })
const OPTION = node('o1', 'option', { label: 'Adopt Segment' })
const GOAL = 'replace our customer data platform before the current contract renews in March'

describe('a placeholder label is not a name', () => {
  /**
   * ⭐ THE ARM THAT WOULD HAVE CAUGHT WHAT I SHIPPED. The exact shape witnessed
   * on the served build, pinned as a fixture so it cannot recur silently.
   */
  it('⭐ a decision whose label the producer marked as a placeholder does not become the decision name', () => {
    const strip = buildModelStrip([
      node('d1', 'decision', { label: 'Question', label_placeholder: true }),
      node('g1', 'goal', { label: GOAL }),
      OPTION,
    ])
    expect(strip.decisionLabel).toBeNull()
    // The goal still names the subject, exactly as it did before the lead existed.
    expect(strip.goalLabel).toBe(GOAL)
  })

  it('⛔ and it does not leak through the goalLabel fallback either', () => {
    // `goalLabel` falls back to the decision when no goal node exists. A
    // placeholder must not arrive by that route and become the subject line.
    const strip = buildModelStrip([
      node('d1', 'decision', { label: 'Question', label_placeholder: true }),
      OPTION,
    ])
    expect(strip.decisionLabel).toBeNull()
    expect(strip.goalLabel).toBeNull()
  })

  /**
   * ⭐ THE DISCRIMINATING ARM. Every assertion above would pass if the guard
   * simply refused every decision label, which would silently delete the
   * feature #1654 shipped. This pins that a REAL name still leads.
   */
  it('⭐ a real decision name is untouched — the guard reads the flag, not the words', () => {
    const strip = buildModelStrip([
      node('d1', 'decision', { label: 'Customer Data Platform Selection' }),
      node('g1', 'goal', { label: GOAL }),
      OPTION,
    ])
    expect(strip.decisionLabel).toBe('Customer Data Platform Selection')
    expect(strip.goalLabel).toBe(GOAL)
  })

  it('⛔ does not sniff the words — a decision genuinely named "Question" with no flag still leads', () => {
    // If this ever needs to change it is a product decision, not a tidy-up: the
    // flag is the producer's claim and the words are the user's.
    const strip = buildModelStrip([node('d1', 'decision', { label: 'Question' }), OPTION])
    expect(strip.decisionLabel).toBe('Question')
  })

  it('treats an explicit false the same as an absent flag', () => {
    const strip = buildModelStrip([
      node('d1', 'decision', { label: 'Replace the CDP', label_placeholder: false }),
      OPTION,
    ])
    expect(strip.decisionLabel).toBe('Replace the CDP')
  })

  /**
   * ⚠ The same stamp on a GOAL node. Scoped deliberately: the goal is the other
   * string the subject line can carry, so a placeholder there would surface by
   * the same route.
   */
  it('a placeholder GOAL label does not become the subject either', () => {
    const strip = buildModelStrip([node('g1', 'goal', { label: 'Goal', label_placeholder: true }), OPTION])
    expect(strip.goalLabel).toBeNull()
  })
})
