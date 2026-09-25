/**
 * ⭐ "THE RUN WITHHELD A RECOMMENDATION, AND HERE IS WHY" — on the canvas.
 *
 * ## The defect this closes, measured on a founder run
 *
 * Debug export `44e349fa` (UI `ab6ae8a6`, staging, 2026-09-14 17:41Z), replayed
 * through `mapV5AnalysisToReport` at these bytes:
 *
 *   - all four options resolved a support percentage, keyed by NODE ID
 *     (`868f8b07` → 0.72395, `14d36e6f` → 0.15975, `b5f75882` → 0.0943,
 *     `5d37cb33` → 0.022), every one `status: "computed"`, 10,000 samples,
 *     `validity_ratio: 1`;
 *   - `leading_option_id: null`;
 *   - `report.inference_warnings` carried `CONSTRAINT_TARGET_UNRELIABLE`,
 *     whose producer semantics are explicit: goal-fit probabilities were
 *     **withheld for this run rather than shown**, and the fix is to set a
 *     value or range on the constrained node.
 *
 * The canvas rendered none of that. The user was told *"no option can be put
 * forward yet"* and left with nowhere to go. ⛔ **A withheld result and an
 * absent one are different facts with different remedies, and the canvas was
 * showing the second while the producer had stated the first** — the estate's
 * "ABSENT is two findings" trap, on the surface the user actually looks at.
 *
 * ⚠ THE DISCLOSURE ALREADY EXISTED AND DID NOT REACH HIM. `humaniseCritique`
 * has carried a `CONSTRAINT_TARGET_UNRELIABLE` template since ROADMAP 1.12, and
 * the Analysis-tab warning strip renders it. The founder's standing scope
 * ruling is **Reasoning and Model tabs only — ignore the Analysis tab**, so the
 * one surface that told the truth was the one surface he was told not to open.
 * This is not new copy; it is the existing copy reaching the canvas.
 *
 * ## Why this is a leaf and not a hook
 *
 * `GoalNode` renders once per canvas node and already imports these leaves for
 * exactly that reason (see `readInferenceWarnings`'s R-6 header). A selector
 * over a report the caller already holds keeps it that way.
 *
 * ## ⛔ NEVER THE RAW `message`
 *
 * Producer messages carry internal identifiers
 * (`constraint_fac_customer_churn_max observed_state.value intercept=0`), which
 * is why the V14.3 no-message-render guard exists. Every string here comes from
 * the code-keyed template path via {@link humaniseInferenceWarning}; this module
 * reads `.code` and nothing else off the wire entry.
 */
import {
  humaniseInferenceWarning,
  type HumanisableInferenceWarning,
} from '../../components/results/utils/humaniseInferenceWarning'
import { readInferenceWarnings } from '../../components/results/utils/readInferenceWarnings'

/**
 * ⭐ THE EXPLICIT, CLOSED SET — and `withheldLeaderDisclosure.spec.ts` REDs if
 * it GROWS **or** SHRINKS.
 *
 * A code belongs here only when the producer's own semantics are *"a goal-fit
 * figure was computed-or-computable and deliberately NOT shown, RUN-WIDE"*.
 * That is a narrower claim than "something was wrong with a constraint", and
 * the narrowness is the point: this sentence tells the user why the product
 * declined to recommend, so a code that does not withhold the recommendation
 * must not appear under it.
 *
 * ⛔ `CONSTRAINT_DIRECTION_SUSPECT` IS DELIBERATELY EXCLUDED, and it is the
 * closest call. Its template also says the figure "isn't shown" — but its own
 * copy scopes that to **one option** (*"couldn't be confirmed for this option,
 * so its goal-fit isn't shown"*), and this surface is the run-wide Question
 * card. Listing it here would attribute a per-option withholding to the whole
 * run. Same reasoning excludes `CONSTRAINT_TARGET_NO_OBSERVED_VALUE` and the
 * `info`-severity defaulting family (`CONSTRAINT_NODE_DEFAULT_BASE`,
 * `ROOT_NODE_DEFAULT_VALUE`): those report a weakness in an input, not a
 * decision to withhold an output.
 *
 * ⚠ THIS IS A HAND-MAINTAINED LIST AND THERE IS NO DERIVATION AVAILABLE — the
 * withholding semantics live in prose inside each template, not in a structured
 * field. Stated rather than disguised (trap 12). The mitigation is that the
 * spec pins the set EXACTLY, so a code added here without its argument, or
 * removed from here silently, turns the suite red.
 */
export const LEADER_WITHHOLDING_CODES: readonly string[] = ['CONSTRAINT_TARGET_UNRELIABLE']

export interface WithheldLeaderDisclosure {
  /** The producer code that withheld. Carried so the render site can bind a
   *  testid to the CAUSE rather than to the sentence's text. */
  readonly code: string
  /** Code-keyed template title. Never the producer's `message`. */
  readonly title: string
  /** The concrete next move, from the same template. Empty only if the
   *  template carries none, in which case the caller renders title alone. */
  readonly suggestion: string
}

/** The minimum of `ResultsReport` this reads. Deliberately structural rather
 *  than an import of the 1,500-line results type: the canvas already passes
 *  `report as never` into `readInferenceWarnings` for the same reason. */
type ReportLike = Parameters<typeof readInferenceWarnings>[0]

/**
 * The producer's own reason a recommendation was withheld, humanised — or
 * `null` when it withheld nothing, which is the overwhelmingly common case.
 *
 * ⚠ GATED ON THE PRODUCER'S STATEMENT, NOT ON THE ABSENCE OF A LEADER. A run
 * can carry no leader for reasons that are not a withholding (a genuine tie, a
 * model with one option, an incomplete graph), and those have their own copy.
 * Reading `leading_option_id == null` as "withheld" would be this module
 * re-deriving a decision the producer already made and shipped — the exact
 * shape that produces two internally-consistent authorities disagreeing
 * (trap 21). If the producer did not say it withheld, this says nothing.
 */
/**
 * ⭐ ONE SENTENCE BOUNDARY, APPLIED ONCE, FOR EVERY CODE.
 *
 * `humaniseCritique`'s entries are TITLES — none carries terminal punctuation,
 * deliberately, because other surfaces render them as headings. The canvas
 * renders a title and a suggestion side by side as prose, and terminated only
 * the second one with a hardcoded `.`. Paul read the result on served
 * `1f77130d`:
 *
 *     "…can't be evaluated reliably Set a current value or range…"
 *
 * ⛔ FIXED AT THE OWNER, NOT AT THE TEMPLATE. Adding a full stop to one entry
 * would repair one card and leave its siblings — the failure mode
 * `humaniseCritique.ts:194-211` names about this very entry: *"the remedy
 * scoped to the instance while nothing swept its siblings."*
 *
 * ⚠ AND IT NEVER ADDS A SECOND. The hardcoded `.` it replaces would have
 * rendered `…?.` the day a template ended in a question — a latent defect that
 * this closes on the way past.
 */
export function endSentence(text: string): string {
  const t = text.trim()
  if (t.length === 0) return ''
  return /[.!?…]$/.test(t) ? t : `${t}.`
}

export function selectWithheldLeaderDisclosure(
  report: ReportLike,
  /** Node id → label from the graph store, for templates that name a node.
   *  Optional: without it the copy is the anonymous form, which is what
   *  `CONSTRAINT_TARGET_UNRELIABLE` renders today anyway — it arrives with no
   *  `field` and no `affected_nodes` (measured on export `44e349fa`). */
  nodeLabels?: ReadonlyMap<string, string>,
): WithheldLeaderDisclosure | null {
  return selectWithheldLeaderDisclosureFromWarnings(readInferenceWarnings(report), nodeLabels)
}

/**
 * ⭐ THE SAME SELECTION, FROM WARNINGS A CALLER HAS ALREADY READ. The Reasoning
 * tab holds `resultsSectionData.confidence.inferenceWarnings` — the output of
 * this same `readInferenceWarnings` — and never the raw report. One loop, two
 * entry points, so the canvas and the tab cannot drift into two authorities on
 * which codes withhold a recommendation (trap 21).
 */
export function selectWithheldLeaderDisclosureFromWarnings(
  raw: unknown,
  nodeLabels?: ReadonlyMap<string, string>,
): WithheldLeaderDisclosure | null {
  if (!Array.isArray(raw)) return null

  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const code = (entry as { code?: unknown }).code
    if (typeof code !== 'string' || !LEADER_WITHHOLDING_CODES.includes(code)) continue

    const humanised = humaniseInferenceWarning(entry as HumanisableInferenceWarning, nodeLabels)
    const title = typeof humanised.title === 'string' ? humanised.title.trim() : ''
    if (title.length === 0) continue

    const suggestion =
      typeof humanised.suggestion === 'string' ? humanised.suggestion.trim() : ''
    // Terminated HERE so every consumer gets readable prose without having to
    // remember — the renderer that forgot is the whole defect.
    return { code, title: endSentence(title), suggestion: endSentence(suggestion) }
  }

  return null
}
