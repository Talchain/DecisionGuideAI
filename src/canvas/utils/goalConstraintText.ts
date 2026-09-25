import type { CEEGoalConstraint } from '../../adapters/cee/types'
import { formatStatedLimitValue, renderLimitOperator } from '../../components/results/decision-overview/statedLimits'
import { classifyUnit } from '../../utils/unitClassifier'
import { resolveElementLabel } from '../domain/elementLabel'

/** State the recorded boundary and its origin, independently of probability or evidence quality. */
/**
 * Magnitude + unit, in the one place both paths read.
 *
 * ⚠ EXTRACTED RATHER THAN COPIED. The audit-trail path and the reconstruction
 * path format the same kind of thing, and two copies of currency/percent/ISO
 * handling is precisely the mirror that let `<=` reach a reader and a unit go
 * missing before `goalConstraintText` existed.
 */
function formatLimitMagnitude(value: number, unit: string | null | undefined): string {
  const { kind, canonical } = classifyUnit(unit ?? null)
  let out = formatStatedLimitValue(value, unit ?? undefined)
  if (kind === 'iso') out = `${canonical} ${value.toLocaleString('en-GB')}`
  else if (kind === 'symbol') out = `${canonical}${value.toLocaleString('en-GB')}`
  else if (kind === 'percent') out = `${value}%`
  else if (kind === 'other' && canonical.toLowerCase() !== 'count') out += ` ${canonical}`
  return out
}

/**
 * ⭐⭐ DOES THE LIMIT SENTENCE ITSELF CARRY THE READER'S VERBATIM WORDS?
 *
 * Exported so the separate `You said: "…"` provenance line can STAND DOWN in
 * exactly the case where the limit already is that quote — otherwise the Model
 * tab prints one sentence twice, once as the limit and once as its own source.
 * One predicate, both readers, so they cannot drift into disagreeing about
 * which surface is carrying the quote.
 */
/**
 * ⭐⭐ UNITS WHOSE VALUE HAS ALREADY BEEN REWRITTEN OUT OF THE READER'S SCALE.
 *
 * Witnessed on deployed `79866c44` (fresh draft, guest, settled at the
 * product's own terminal beat). The brief said *"keeping monthly churn under
 * 4%"*. The card printed:
 *
 *     Limit ≤ 0.04 fraction
 *
 * The producer's own constraint LABEL on the same row reads *"Keep monthly
 * churn at or below 4%"*, and its `source_quote` reads *"while keeping monthly
 * churn under 4%"* — both correct, both present, and the card showed neither,
 * because `omitLabel` drops the label (the card's title already names the
 * factor) and the reconstruction path then formats the machine value.
 *
 * ⛔ THE FIX IS NOT TO MULTIPLY BY 100. Converting `0.04` to `4%` would be this
 * surface deciding what scale a number is in — the exact mechanism behind the
 * 100× defect found this morning, where `1.1` was rendered `1.1%` against a
 * brief saying 110%. **Never infer scale from magnitude.**
 *
 * ⚠ WHY THESE UNITS AND NOT "ANYTHING NON-PERCENT". A currency limit
 * reconstructs EXACTLY — `49` + `£` is `£49`, the reader's own figure — which
 * is why `factorGoalContent.spec` caught an earlier over-wide version of this
 * preference. These four are different in kind: each NAMES a rewrite. A unit
 * of `fraction` is a statement that the value is no longer in whatever scale
 * the reader used, and nothing on the wire says what that was. Where the stated
 * magnitude cannot be recovered, the reader's own sentence is the only honest
 * rendering available.
 *
 * ⚠ HAND-MAINTAINED, AND SAID OUT LOUD. There is no wire field declaring
 * "this value was rewritten" — that is `provenance_unit_normalised`, which the
 * producer does not populate (measured; the request is open). When it arrives,
 * rung 1 supersedes this and this set should shrink, not grow.
 */
/**
 * ⛔⛔ NARROWED TO THE WITNESSED MEMBER — 16 Sep 2026, on an independent review.
 *
 * This set held `fraction`, `ratio`, `proportion` and `unit_interval`. Measured
 * in-repo with contrast controls that FIRE, three of the four have no witness:
 *
 *     fraction      22 hits          contrast: count                23
 *     ratio          2 hits — and BOTH are `goal_threshold_unit`,
 *                    a DIFFERENT FIELD from `constraint.unit`
 *     proportion     0 hits          contrast: percent              15
 *     unit_interval  0 hits          contrast: goal_threshold_unit 114
 *
 * ⛔ AND EVERY MEMBER COSTS SOMETHING. Membership SUPPRESSES a reconstructable
 * number in favour of a sentence — the header above says so itself: *"it cannot
 * be compared against the other limits"*. A genuine ratio limit ("keep the
 * ratio under 3") reconstructs EXACTLY and would lose its comparable numeric
 * form for nothing. That is the same over-reach this file already records being
 * caught once, on currency.
 *
 * ⭐ The rule was already written three paragraphs up — *"this set should
 * shrink, not grow"* — and three members were added past it on a semantic
 * argument with no wire witness. Knowing the rule is not the same as applying
 * it, so the set now contains only what has been observed.
 *
 * TO ADD A MEMBER: produce a wire witness of that unit on `constraint.unit`,
 * not an argument that it belongs by kind.
 */
const REWRITTEN_SCALE_UNITS: ReadonlySet<string> = new Set([
  'fraction',
])

/**
 * ⭐⭐⭐ PROVENANCE DESCRIBES A VALUE. CHANGE THE VALUE AND IT STOPS BEING TRUE.
 *
 * ⛔ FOUND BY AN INDEPENDENT POST-MERGE REVIEW OF #1592 AND REPRODUCED AT THE
 * FORMATTER: an audited churn ceiling `{value: 0.04, original_value: 4,
 * original_unit: '%'}` renders `≤ 4%`; apply the Goal panel's ACTUAL edit
 * (`{...pc, value: parsed}`) to set the value to 5, and it STILL renders
 * `≤ 4%`. The reader edits their own limit and the card shows the old one.
 *
 * ⭐ THE FORMATTER CANNOT FIX THIS AND SHOULD NOT TRY. It is handed two facts
 * and no way to know whether they still agree — and a formatter that checked
 * the arithmetic would be deciding what a producer's rule means. **The WRITER
 * knows the value changed.** So invalidation belongs at the edit site: the one
 * place in the product with both the old constraint and the new number.
 *
 * ⚠ THE QUOTE GOES WITH IT, and that is not tidying. `source_quote` is the
 * reader's sentence about the OLD figure; after an edit it is a quotation
 * attached to a number the reader never said. #1597 widens the quote's
 * authority to rewritten-scale units, so leaving it behind would widen this
 * defect at the same time.
 *
 * ⚠ THIS IS NOT "clear provenance on every write". Only on a value change —
 * `parsed === c.value` already returns early at the call site, and a change to
 * some other field leaves both fields alone, because they are still true.
 */
export function constraintWithEditedValue(
  constraint: CEEGoalConstraint,
  value: number,
): CEEGoalConstraint {
  const {
    provenance_unit_normalised: _audit,
    source_quote: _quote,
    ...rest
  } = constraint as CEEGoalConstraint & { provenance_unit_normalised?: unknown; source_quote?: unknown }
  return { ...rest, value } as CEEGoalConstraint
}

export function goalConstraintTextUsesQuote(constraint: CEEGoalConstraint): boolean {
  const q = typeof constraint.source_quote === 'string' ? constraint.source_quote.trim() : ''
  if (!q) return false
  if (classifyUnit(constraint.unit ?? null).kind === 'percent') return true
  const unit = typeof constraint.unit === 'string' ? constraint.unit.trim().toLowerCase() : ''
  return REWRITTEN_SCALE_UNITS.has(unit)
}

/**
 * ⭐ `omitLabel` EXISTS SO THERE IS STILL EXACTLY ONE FORMATTER.
 *
 * On the constrained factor's own card the target's name is the card's title,
 * so "Monthly churn ≤ 4%" prints it twice and costs a line of height on a
 * surface already fighting for it. The obvious shortcut is to format the
 * operator and value at the call site — which is how this estate's label
 * surfaces drifted apart in the first place, and `FactorNode` had already done
 * exactly that (see its constraint note). Unit classification, the `≤`
 * rendering, the `limit not captured` refusal and the provenance suffix all
 * stay here; only the name is suppressed.
 */
export interface GoalConstraintTextOptions {
  /** True on a surface that already names the constrained element. */
  readonly omitLabel?: boolean
}

/**
 * ⭐ A11 AUDIT — THE LABEL SOMETIMES ALREADY IS THE LIMIT SENTENCE.
 *
 * Witnessed on Paul's staging: `label: "Annual PA salary < 40000GBP/year"`
 * arrives with its own operator and value baked in by the producer.
 * Appending the reconstructed "≤ 40,000 GBP/year" after it states the same
 * limit twice, with two different operators. When the label already carries
 * a comparison glyph and a digit, it IS the limit sentence — show it alone,
 * never alongside a second reconstructed operator.
 */
const LABEL_OPERATOR_PATTERN = /[<>≤≥]=?/

function labelAlreadyStatesLimit(label: string): boolean {
  return LABEL_OPERATOR_PATTERN.test(label) && /\d/.test(label)
}

export function goalConstraintText(
  constraint: CEEGoalConstraint,
  nodes: readonly { id: string; data?: unknown }[] = [],
  options: GoalConstraintTextOptions = {},
): string {
  const target = constraint.node_id ? nodes.find(n => n.id === constraint.node_id) : undefined
  const label = (typeof constraint.label === 'string' ? constraint.label.trim() : '') || (target ? resolveElementLabel(target.data) : 'Constraint')
  // Explicit constraints may come from the brief or a panel edit; neither means verified.
  const origin = constraint.provenance === 'inferred' ? ' · Inferred limit'
    : constraint.provenance === 'proxy' ? ' · Proxy limit' : ''
  const prefix = options.omitLabel ? '' : `${label} `

  /**
   * ⭐⭐⭐ ON A PERCENT LIMIT, THE READER'S OWN WORDS BEAT OUR RECONSTRUCTION —
   * and this was found in the running app, not in the code.
   *
   * The `pricing-model` starter states *"net revenue retention above 110%"*.
   * The producer sends that constraint as `value: 1.1, unit: '%'`, so the
   * reconstruction below appended the glyph to the ratio and rendered
   * **"≥ 1.1%"** — a hundred times under the brief, while the goal card two
   * inches away rendered **"Target: 110%"** off the same quantity. Measured at
   * the live store in the running app.
   *
   * ⛔ THE GOAL PATH ONLY GETS IT RIGHT BECAUSE THE PRODUCER SENDS IT TWICE:
   * `goal_threshold: 1.1` for compute and `goal_threshold_raw: 110` to display.
   * A constraint has NO raw twin, so on a percent unit there is nothing honest
   * to reconstruct from — multiplying by a hundred would be this function
   * guessing the producer's scale convention, which is the whole class of thing
   * the UI must not do.
   *
   * ⚠ SCOPED TO `percent`, AND THE NARROWNESS IS THE POINT. A first cut
   * preferred the quote for EVERY unit and `factorGoalContent.spec` caught it:
   * a currency limit reconstructs EXACTLY — `value: 49, unit: '£'` is £49, no
   * scale ambiguity anywhere — and "Monthly price ≤ £49" is tidier on a card
   * than "Keep the monthly price at or below £49". Two different harms were
   * sharing one predicate: a WRONG figure, and a merely longer one. Only the
   * first is worth the trade.
   *
   * `source_quote` is declared "verbatim span from the brief that produced this
   * constraint" — the reader's own sentence, recorded by the producer, needing
   * no interpretation. Where a percent limit carries none, the reconstruction
   * still runs and is still 100× out; that is a producer gap this layer cannot
   * close, and it is stated here rather than hidden.
   */
  /**
   * ⭐⭐⭐ THE READER'S OWN FIGURE, WHEN THE PRODUCER HANDS IT TO US.
   *
   * `provenance_unit_normalised` is the contract's audit trail for CEE's
   * percent→fraction rewrite, and `original_value` is the number the reader
   * actually stated — 110, not 1.1. When it is present there is nothing left to
   * guess and nothing to work around: we render their figure, in their unit.
   *
   * ⭐ THIS OUTRANKS THE QUOTE DELIBERATELY. Quoting the brief is true, and it
   * is what we fall back to, but it is a SENTENCE where this is a NUMBER — it
   * cannot be compared against the other limits on the card, it does not format
   * with them, and it costs a line of height. A figure is the thinner
   * representation.
   *
   * ⚠ NOTHING IN THIS ESTATE POPULATES IT YET (swept at 0.55.0: zero
   * occurrences, contrast control `source_quote` 28 files). It is requested
   * from CEE, and this is the read path waiting for it — built now so the value
   * appears the moment it is sent, rather than arriving and being silently
   * ignored the way the field itself was until today.
   */
  const audit = constraint.provenance_unit_normalised
  if (
    audit &&
    typeof audit.original_value === 'number' &&
    Number.isFinite(audit.original_value) &&
    constraint.operator
  ) {
    const stated = formatLimitMagnitude(audit.original_value, audit.original_unit)
    const op = renderLimitOperator(constraint.operator)
    return options.omitLabel ? `${op} ${stated}${origin}` : `${label} ${op} ${stated}${origin}`
  }

  const quote = typeof constraint.source_quote === 'string' ? constraint.source_quote.trim() : ''
  if (goalConstraintTextUsesQuote(constraint)) {
    return options.omitLabel ? `\u201c${quote}\u201d${origin}` : `${label} \u00b7 \u201c${quote}\u201d${origin}`
  }

  if (typeof constraint.value !== 'number' || !Number.isFinite(constraint.value) || !constraint.operator) {
    // ⛔ Still never invents a direction — the ruled behaviour, unchanged. With
    // the label omitted the separator goes too, or it opens with a stray "·".
    return options.omitLabel ? `Limit not captured${origin}` : `${label} · limit not captured${origin}`
  }
  if (!options.omitLabel && labelAlreadyStatesLimit(label)) {
    return `${label}${origin}`
  }
  const value = formatLimitMagnitude(constraint.value, constraint.unit)
  return `${prefix}${renderLimitOperator(constraint.operator)} ${value}${origin}`
}
