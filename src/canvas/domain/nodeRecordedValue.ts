/**
 * ⭐⭐ THE QUANTITY A NODE RECORDS, IN ITS OWN UNIT — one owner, and a measured
 * account of which kinds can actually answer.
 *
 * ⛔ THE DEFECT, MEASURED RATHER THAN REASONED (17 Sep 2026). `RiskNode.tsx`
 * contains **zero** references to `observedState`, against a contrast control of
 * **20** in its sibling `FactorNode.tsx`. So a risk labelled *"Time to Reach
 * Customer Target"* carries `raw_value: 12, unit: "months"` in its own node data
 * and renders a bridge strength instead.
 *
 * ⚠⚠ AND THE FIGURE THE CARD *IS* BUILT AROUND NEVER ARRIVES. Across the
 * staging golden path, the CEE response fixtures and the starter captures —
 * **23 unique risk nodes — `probability` is present on 0 and `impact` on 0.**
 * The severity badge, the *"N% likely"* line and the *"High impact"* line are
 * dark on every risk in the corpus, while 4 of 23 carry a recorded value nothing
 * reads. The card asks for what a risk lacks and ignores what it has — the same
 * defect `shared/lodMetricLine.ts` was written to close for the reduced line,
 * still open on the full card one surface up.
 *
 * ⭐ THE PRODUCER COVERAGE, so no later design asks for a number that does not
 * exist (the review that prompted this work asked for exactly this table):
 *
 *     factor    51 nodes   display_value 47, observed_state 30   → rendered today
 *     option    31 nodes   interventions 27, is_baseline 31      → rendered today
 *     risk      23 nodes   display_value  4, observed_state  4   → THIS MODULE
 *     goal       8 nodes   goal_threshold*  4                    → rendered today
 *     outcome   15 nodes   provenance only — NO quantity at all
 *     decision   8 nodes   provenance only — NO quantity at all
 *
 * ⛔⛔ OUTCOME AND DECISION CARDS HAVE NO PRODUCER, and that is a finding, not a
 * gap to fill here. 15 outcome nodes carry `id`, `kind`, `label`, `provenance`
 * and nothing else — no unit, no current value, no effect. A design asking an
 * outcome card to show *"£15,300/month today"* is requesting a calculation CEE
 * does not make. Wiring this module into `OutcomeNode` would ship dark: it was
 * written for that card first and moved here when the corpus refuted the
 * premise. ⚠ The contrast control fires — outcomes are PRESENT (15) while
 * factors carry values (47) — so the zero is a real absence, not a blind probe.
 * Record: `output/node-system-20260917/MEASURED-WHAT-THE-CARDS-CAN-SAY.md`.
 *
 * ⭐ THIS MODULE FORMATS NOTHING. `factorDisplayText` already owns the read and
 * the formatting — unit classification, placeholder-unit suppression, the
 * display-value precedence chain and its contradiction guard. A second formatter
 * here is how one datum comes to have two answers two pixels apart (CLAUDE.md
 * trap 12), and a card is the worst place for that, because the panel it would
 * disagree with is six inches to the right.
 *
 * ⚠ IS THAT FORMATTER REALLY KIND-AGNOSTIC? Asked as a question and settled at
 * the bytes, because the premise is what carries this module's weight.
 * `factorDisplayText` takes a bare `Record<string, unknown>`, not a factor type,
 * and reads `label`, `observedState` and `category`. Its one kind-specific
 * branch is `category === 'external'`, a factor category; a risk does not carry
 * it, and were one ever to, that branch returns `null`, which is exactly what
 * this module wants for "nothing recorded" anyway. The name is factor-shaped for
 * historical reasons; the behaviour is not.
 *
 * ⚠ SCOPE, STATED SO IT CANNOT BE INHERITED AS MORE THAN IT IS (trap 20). This
 * answers *"is a value RECORDED, and how is it written?"*. It says nothing about
 * whether that value is current, whether a run covers it, whether the node is in
 * a comparison, or who supplied the number. Those are four different questions;
 * pooling them under one grey dash is the defect the design review named.
 * Provenance already has an owner and is already rendered for every kind:
 * `NodeProvenanceMark`, mounted in `BaseNode`.
 */
import { factorDisplayText } from '../../utils/formatFactorDisplayValue'

/**
 * The node's recorded value as a display string in its own unit, or `null` when
 * the model holds none.
 *
 * ⚠ `null` MEANS "NOTHING RECORDED", AND THE CALLER OWNS WHAT THAT LOOKS LIKE.
 * This deliberately returns no placeholder text: a shared string here would put
 * one noun in front of what are, at the call sites, different facts.
 */
export function nodeRecordedValue(
  data: Record<string, unknown> | null | undefined,
): string | null {
  if (!data || typeof data !== 'object') return null

  /**
   * ⛔⛔ A ZERO MAGNITUDE IS NOT A RECORDED SIZE — AND IT IS WHERE THE KNOWN
   * FABRICATIONS LIVE. Found by running this module against the four real risk
   * payloads before shipping it, which is the only reason it was caught:
   *
   *   "Budget Overrun"       CEE: "£400,000 budget cap"          → "No cost allocated"
   *   "Budget Overrun Risk"  CEE: "No budget pressure currently" → "£0"
   *
   * Both are minted by `formatFactorDisplayValue`'s zero branches: one is a
   * sentence the UI authors over the producer's own, the other a currency figure
   * asserting a measured zero. **Two of four.** Those risk cards render nothing
   * today, so admitting them would make an existing fabrication NEWLY VISIBLE on
   * a surface that did not have it — a regression in honesty dressed as a
   * feature.
   *
   * ⚠ NOT A FORMATTER FIX. Repairing the zero branches needs a bounded
   * display-freshness rule that tells a CAP mentioned in prose from the CURRENT
   * amount, and an independent review already returned an attempt at that for
   * reopening a stale-value defect. This module simply declines to ask the
   * question at zero, which is honest on its own terms: nobody has recorded a
   * size, so there is none to state. The remaining two payloads — "4 months",
   * "12 months" — are unaffected and are the whole point.
   */
  const observed = (data as { observedState?: Record<string, unknown> }).observedState
  const raw = observed?.raw_value
  const numericRaw = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if (numericRaw === 0) return null

  const text = factorDisplayText(data)
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  return trimmed.length > 0 ? trimmed : null
}
