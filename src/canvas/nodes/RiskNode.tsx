import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY, RiskNodeDataSchema } from '../domain/nodes'
import { calculateRiskSeverity, cleanDisplayLabel } from '../utils/graphDisplayCalculations'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { METRIC_UNSET } from './shared/metricVocabulary'
import { composeCounterfactualQuestion } from './shared/counterfactualQuestion'

import { useNodeConnections } from '../hooks/useNodeConnections'
import { usePreAnalysisInbound } from '../hooks/usePreAnalysisInbound'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { ConnRow, ConnRowsOverflow, Sep, NodePopover, ScienceIcon, PreAnalysisInboundRows, PreAnalysisDrivenByLine } from './shared'
import { CoachingChipRow } from './coaching/CoachingChipRow'
import { resolveNodeCoaching } from './coaching/resolveNodeCoaching'
import { useGuidanceStore } from '../stores/guidanceStore'
import { nodeRecordedValue } from '../domain/nodeRecordedValue'
import { factorValueSourceMark, ValueSourceMark } from './shared/valueSourceMark'
import { openNodeInspector } from './shared/openNodeInspector'

/**
 * ⭐⭐⭐ A THIN CARD MUST SAY THAT THE MODEL IS THIN, NOT LOOK LIKE A THIN TOOL.
 *
 * Paul's product ruling: *"We are a reasoning enhancement tool. If it doesn't
 * enhance critical and creative thinking, it has no value."* A board of cards
 * carrying a name and nothing else reads as *"this tool is empty"* when the
 * truth is *"this model is empty, and here is the next thing to put in it"*.
 * That is a coaching moment the product was throwing away.
 *
 * ⭐ MEASURED, NOT ARGUED — AND IT IS THE MODAL STATE, NOT AN EDGE CASE.
 * Across all five committed starters (`canvas/starters/data/*.draft.json`),
 * **14 of 14 risk nodes carry exactly `id`, `kind`, `label`, `provenance` and
 * nothing else.** No `probability`, no `impact`, no value of any kind. So the
 * card this branch renders is not a hypothetical — it is what every shipped
 * starter ships, on every risk.
 *
 *   ⚠ CONTRAST CONTROL, SAME SCAN, SAME FILES (an absence claim needs one —
 *   CLAUDE.md trap 13e): the 34 FACTOR nodes in those files carry six content
 *   keys between them — `category`, `display_value`, `encoding_map`,
 *   `extractionType`, `observed_state`, `prior`. The probe discriminates; the
 *   zero on risks is the data, not a blind instrument.
 *
 * ⭐⭐ WHY THE RISK CARD WAS THE ONE THAT SAID NOTHING. `BaseNode`'s
 * `isIncomplete` has arms for `factor`, `goal`, `decision` and `option`, then
 * `return false`. **`risk` and `outcome` have no arm at all**, so they can
 * never reach the `Needs input` StatusPill. Every other kind already has a
 * channel for this:
 *
 *     factor    `Needs input` pill + `Help me estimate this` chip
 *     goal      `Target not captured` (GOAL_NO_TARGET_STATE)
 *     option    `Not in this analysis` (CEE-stamped, selectOptionExclusionMessage)
 *     decision  `Needs input` via the !hasOptions arm
 *     risk      — nothing —
 *
 * And it is silent by CONSTRUCTION rather than by omission: `exposureReadout`
 * joins the two halves with `.filter(Boolean)`, so when neither exists the join
 * is `''`, `riskExposureLine` is `null`, and the card renders no row. The
 * "honest absence" that refuses to fabricate a `0%` also refuses to say that
 * nothing was recorded. This line is the second half of that honesty.
 *
 * ⛔ IT STATES A FACT ABOUT THE MODEL, NEVER A VERDICT ON THE RISK. *"Likelihood
 * and impact not set yet"* is a claim about what Olumi holds. *"This risk is
 * minor"* would be a claim about the world, and it is not ours to make — the
 * same boundary `TierInvitation`'s header draws when it refuses to say *"your
 * risks are thin"*. Nothing here reads the label, ranks the risk, or implies
 * that an unsized risk matters less than a sized one.
 *
 * ⛔ AND IT MUST NOT MAKE THE CARD LOOK COMPLETE. The fix for a sparse board is
 * NOT to fill cards with plausible-looking text; it is to say plainly that the
 * model holds little here. No figure is invented, no bar is drawn, and the
 * severity badge stays absent — `calculateRiskSeverity` still returns nothing,
 * exactly as before.
 *
 * ⚠ `not set yet` IS DERIVED FROM `METRIC_UNSET.inline`, NEVER RE-TYPED, and
 * that is load-bearing rather than tidiness. The same three words declare an
 * unset link strength on the connection (`EdgePills`, the edge hover); this
 * card no longer shows that row (contract v3.1). Hand-typed copies of one
 * register word are the hand-maintained mirror this estate
 * keeps paying for (CLAUDE.md trap 12), and `metricVocabulary.ts`'s own header
 * spends a paragraph on why the word travels by reference. Re-word the register
 * and this sentence follows; it cannot drift out of step with the row beside it.
 *
 * ⚠ AND WHY "yet" SURVIVES THE COMPOSITION. `METRIC_UNSET`'s header states the
 * reason and it applies unchanged here: *"'Not set' is a deficit; 'not set yet'
 * is an invitation… a card that reads as an apology for missing data teaches a
 * reader to ignore it."*
 *
 * ⚠ TWO DIFFERENT ABSENCES, NAMED APART (CLAUDE.md trap 21). An unset
 * strength on the CONNECTION from this risk to the goal is an edge property,
 * settled by `strengthIsHumanSettled` and shown on the connection since
 * contract v3.1 took the row off this card. This line is about the risk's OWN
 * size. Pooling the two under one sentence is the reconciliation that keeps
 * costing this estate real time.
 *
 * ⛔⛔ IT NAMES TWO FIELDS AND NEVER SAYS "NOTHING" — AND THIS CARD HAS ALREADY
 * SHIPPED THE DEFECT THAT RULES OUT THE SHORTER SENTENCE (recorded in the
 * pre-v3.1 `lodMetric` header, now in git history): a risk carrying a recorded
 * `4 months` sat under **`Strength not set yet`**, and *"the card announced
 * that nothing was recorded while holding the thing that was."* A risk can carry its own magnitude through
 * `nodeRecordedValue`/`observed_state` independently of `probability` and
 * `impact`, so *"Nothing recorded yet"* — the obvious phrasing, and the one the
 * backlog reaches for — would be FALSE on exactly that card. Naming the two
 * fields keeps the sentence true of every state the data admits, and it is
 * still the useful thing to say: a reader who recorded a duration and no
 * likelihood has a real gap, and the shorter sentence would have hidden it
 * behind a falsehood.
 *
 * ⚠ NOT PHASE-GATED, ON THIS FILE'S NEIGHBOUR'S OWN RULING. `BaseNode`'s
 * `isIncomplete` note: *"An analysis does not resolve an unknown; it proceeds
 * despite one. Hiding the marker on completion tells the user the gap closed."*
 * CEE writes neither field on a run — 14 of 14 starter risks arrive without
 * them and stay that way — so a post-run risk with no likelihood still has no
 * likelihood. The sentence follows the data, not the phase.
 *
 * ⚠ NO ROUTE IS PROMISED, AND THAT IS DERIVED. `RiskPanel` renders a real
 * `risk-probability-input`, but `InspectorRouter` admits only
 * `factor-controllable`, `factor-external` and `option` to `panelOwnsAuthority`
 * — every other panel body is wrapped in `<fieldset disabled>`, which natively
 * inerts it. So "open its details and set one" would be the exact promise
 * `GoalNode` had to withdraw when its threshold editor turned out to be inert.
 * The sentence states the fact; the CHIP beside it is the route, and it goes
 * somewhere that demonstrably answers.
 *
 * ⚠ NO FULL STOP — contract v3.1 (OR-02): the fixture's risk state line is
 * `Likelihood and impact not set yet`, a state label like its sibling
 * `Outcome not quantified` on the outcome card, not a sentence.
 */
export const RISK_EXPOSURE_UNSET_LINE = `Likelihood and impact ${METRIC_UNSET.inline}`

/**
 * ⭐ THE UNSET STATE'S RESTING FORM ON THE STANDARD CARD — the register's own
 * standalone word, by reference (`METRIC_UNSET.standalone`, "Not set yet").
 *
 * Experience Design #63 5809278282 (24 Sep 2026): *"Landing / quiet: repeated
 * cards may reduce to **title + one primary line** inside the fixed fit-safe
 * box … Outcome/Risk = state."* At the landing floor (`--canvas-label-scale` 2,
 * a 260-unit card) a line holds ~19 characters; `RISK_EXPOSURE_UNSET_LINE` is
 * 33, so as the ONE line it either wraps (a second 28-unit row of reserved
 * height on every risk) or is cut — and a cut at 19 characters eats the STATE
 * ("Likelihood and impa…") and keeps the label, the one cut the fit may never
 * make. The short form is the sentence's own tail: the state survives, the
 * leading label moves.
 *
 * ⛔ THE FULL SENTENCE IS NOT DELETED, it is carried three ways: the line's
 * `title`, an `sr-only` copy (announced with no interaction), and the node
 * popover (hover, tap, keyboard focus). Detailed keeps it inline. ⛔ AND THE
 * SHORT FORM IS NEVER SHOWN BESIDE A RECORDED SIZE — "12 months · Not set yet"
 * would read as "nothing is set" over a value the card holds, the defect this
 * file's header already records; there the size is the line and the sentence
 * rides `sr-only`, `title` and the popover.
 */
export const RISK_EXPOSURE_UNSET_SHORT = METRIC_UNSET.standalone
/*
 * ⛔ NO LONGER THE STANDARD CARD'S RESTING FORM — contract v3.1 (DESIGN-GAP-v31
 * #34) shows the whole `RISK_EXPOSURE_UNSET_LINE` on the card, wrapping where it
 * must. Kept, and exported, as the register's short form for any surface that
 * genuinely has one line of ~19 characters; the Standard card is no longer one.
 */

/**
 * The qualifier the entered likelihood/impact pair carries in full — the 9 Sep
 * risk/outcome design names it ("the card therefore labels these as entered
 * estimates"). On the Standard card it rides the full sentence (title, sr-only,
 * popover) and the pair itself is the line: the 43-character sentence cannot
 * be one landing line (~19 characters), and the figures must lead.
 */
const RISK_ENTERED_QUALIFIER = 'Entered estimate'

export const RiskNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.risk

  // Read the existing input contract; malformed imports must not become a risk estimate.
  const probabilityInput = RiskNodeDataSchema.shape.probability.safeParse(props.data?.probability)
  const impactInput = RiskNodeDataSchema.shape.impact.safeParse(props.data?.impact)
  const probability = probabilityInput.success ? probabilityInput.data : undefined
  const impact = impactInput.success ? impactInput.data : undefined
  const severity = calculateRiskSeverity(probability, impact)

  // The defining probability × impact pair (P1.7). Honest absence: each half only
  // renders when its value exists — never a fabricated 0% or default impact. The
  // percentage is display formatting of the 0-1 probability (same untagged pattern
  // as confidence display in lib/format.ts), not a semantic transform.
  //
  // ⚠ LIFTED ABOVE THE CHIP CLUSTER, UNCHANGED, AND THE MOVE IS THE POINT. The
  // face chip below now has to know whether this card said anything about its
  // own size, and the alternative was to re-derive that from `probability` and
  // `impact` beside the chip — a second opinion about one question, which is how
  // two surfaces on one card come to disagree. One join, read twice.
  const probabilityPct = typeof probability === 'number' ? Math.round(probability * 100) : null
  const exposureReadout = [
    probabilityPct != null ? `${probabilityPct}% likely` : null,
    impact ? `${impact.charAt(0).toUpperCase()}${impact.slice(1)} impact` : null,
  ].filter(Boolean).join(' · ')
  /**
   * ⭐ THE PREDICATE IS THE COMPONENT'S OWN JOIN, NOT A SECOND OPINION ABOUT IT.
   *
   * `exposureReadout` is already the authority for "what does this card have to
   * say about its own size" — both halves feed it and `.filter(Boolean)` drops
   * the absent ones. Reading its emptiness means the sentence and the readout
   * cannot disagree: there is no state where a figure renders AND the card
   * claims nothing is set, because they are two branches of one value.
   *
   * ⛔ DELIBERATELY NOT `severity == null`. `calculateRiskSeverity` needs BOTH
   * halves, so it is null on a risk carrying a likelihood and no impact — a
   * card which demonstrably HAS recorded something and must not be told it has
   * not. That mutant is pinned in the spec; it is trap 19 in miniature (a
   * predicate another population also satisfies).
   */
  const exposureUnstated = exposureReadout === ''

  /**
   * ⭐ THE RISK'S OWN SIZE, IN ITS OWN UNIT. The two lines above parse
   * `probability` and `impact`; measured across the staging golden path, the CEE
   * fixtures and the starter captures, **both are present on 0 of 23 risk
   * nodes**. This is the datum 4 of those 23 actually carry — `12 months`,
   * `4 months`, and two cost figures — and nothing read it.
   * See `domain/nodeRecordedValue` for the coverage table and the contrast
   * control that makes the zero readable.
   */
  const recordedValue = useMemo(
    () => nodeRecordedValue(props.data as Record<string, unknown> | undefined),
    [props.data],
  )
  /**
   * ⭐ WHOSE NUMBER THE RISK'S OWN SIZE IS — contract v3.1 point 1 (OR-06):
   * "Do not rely on 'unmarked = Olumi'." The same owner FactorNode reads
   * (`factorValueSourceMark`), over the same carrier `nodeRecordedValue` reads
   * (`observedState`), so the mark and the value cannot describe two records.
   *
   * ⚠ `ValueSourceMark` FOR EVERY KIND, INCLUDING `est.` — NOT `EstimateMarker`.
   * The visible token is identical (`VALUE_SOURCE_MARK_TOKEN.olumi` IS the
   * served `est.` token), but `EstimateMarker`'s hover promises "Open the
   * details to set or confirm it", and this file's header records that the
   * risk panel is fenced `<fieldset disabled>`. A mark must not promise a route
   * the card does not have.
   */
  const recordedValueMark = recordedValue ? factorValueSourceMark(props.data) : null

  const cleanedLabel = cleanDisplayLabel(typeof props.data?.label === 'string' ? props.data.label : undefined)
  const description = typeof props.data?.description === 'string' && props.data.description.trim() ? props.data.description : null
  const body = typeof props.data?.body === 'string' && props.data.body.trim() ? props.data.body : null
  const summary = description ?? body
  // Compose only the display copy: both authored fields stay available through
  // the existing chevron, while the canonical node and Ask context stay intact.
  const fullDescription = description && body && body.trim() !== description.trim()
    ? `${description}\n\n${body}`
    : summary
  const cleanedData = { ...props.data, label: cleanedLabel || 'Untitled risk', description: fullDescription ?? undefined }
  const riskContext = fullDescription ? `\nRisk context: ${fullDescription}` : ''

  const resultsStatus = useCanvasStore(state => state.results.status)
  const viewMode = useCanvasStore(state => state.viewMode)
  const isPostAnalysis = resultsStatus === 'complete'
  const isDetailed = viewMode === 'expert'

  // Popover hover
  const { showPopover, nodeHandlers, popoverHandlers, nodeElRef } = usePopoverHover()

  // Science icons (spec Section 4.1)
  const scienceIcons = useScienceIcons(props.id, 'risk')

  /**
   * The reduced line this card keeps below the legibility floor: the risk's
   * OWN recorded size, or nothing.
   *
   * ⛔ NO LINK-STRENGTH LINE — contract v3.1 (VC-01): "Outcome/risk records are
   * distinct from the strength of their connections" (served as gap U1, 24 Sep).
   * This used to fall back to `Link strength · …` from the goal bridge edge; that
   * is the CONNECTION's fact, carried by its line, hover and inspector. With no
   * recorded size the line is `null`, so `BaseNode` keeps the body (the
   * likelihood/impact statement) rather than blanking it, and the central
   * resolver may still name a severity band from the risk's own entered data.
   *
   * ⭐ RULE 2 STILL HOLDS: the node's own unit comes first — `recordedValue`
   * (months, pounds) from `observedState`. See `domain/nodeRecordedValue`.
   */
  const lodMetric = recordedValue ?? null

  // ConnRow data: "Depends on:" — inbound edges from factors (post-analysis only)
  const inboundConnections = useNodeConnections(props.id, 'inbound')

  // Pre-analysis inbound edges with strengths (for popover). Provenance-gated
  // and shared with OutcomeNode — see `usePreAnalysisInbound`.
  const { items: preAnalysisInbound, topSetItem: preAnalysisTopSet } = usePreAnalysisInbound(props.id)

  // Top factor for actionable guidance
  const topFactor = inboundConnections.length > 0 ? inboundConnections[0] : null

  // The counterfactual affordance's ONE sentence — rendered AND sent. Null when
  // there is no top factor, or its label is blank: no affordance rather than a
  // degenerate question.
  const counterfactualQuestion = composeCounterfactualQuestion(topFactor?.connectedNodeLabel)

  /**
   * ⭐ ONE QUESTION REACHES THE CARD FACE. The rest stay in the popover.
   *
   * The line this replaces read "Body never renders chips directly; they live
   * in popovers (Standard) or inline in Detailed view" — accurate, and the
   * reason a real user in the DEFAULT view sees no coaching at all.
   *
   * MEASURED on deployed `9748b336`, Standard view, post-analysis, in the
   * resting state (no hover): `What reduces this` **0**, `Explore mitigation`
   * **0**, `What would we see first` **0**. Contrast controls in the same
   * probe: 71 `react-flow__node` and 26 `Influence` — the probe could read the
   * page. `NodePopover.tsx:129` is `if (!visible) return null`, so a hidden
   * popover's children are ABSENT FROM THE DOM, not merely invisible.
   *
   * ⚠ AND THE SUITE CANNOT SEE THIS. `render-matrix.spec.tsx:66-70` MOCKS
   * `NodePopover` into a plain always-rendering div — deliberately, so the
   * content is readable without a 300ms hover delay. So "Standard post: same
   * two chips" passes against content no user can reach without hovering.
   * jsdom cannot prove visibility (CLAUDE.md trap 3); here the mock removes
   * the very gate that hides the chips, so the test is green *because* of the
   * thing that makes the defect invisible.
   *
   * The precedent is in this estate and this is the same move: `DecisionNode`
   * put its pre-analysis pair on the card with the note "THE INVITATIONS
   * BELONG ON THE CARD, NOT BEHIND A HOVER".
   *
   * WHY THE LEADING INDICATOR IS THE ONE PROMOTED: the other two both ask how
   * to REDUCE the risk; only this one asks how you would KNOW it was
   * happening, so without it a risk can reach a decision with no agreed
   * trigger for acting on it. Promoted in BOTH phases — a leading indicator is
   * as useful while framing as it is after a run.
   *
   * It is promoted, NOT duplicated: it leaves `riskPopoverChips` so hovering
   * never shows the same question twice. Detailed view still renders all three
   * inline and is unchanged.
   */
  /**
   * ⭐⭐ THE DIAGNOSIS IS HALF A COACHING MOMENT; THIS IS THE OTHER HALF.
   *
   * *"Likelihood and impact not set yet"* on its own is a diagnosis. Paired
   * with a question the reader can actually ask, it is the thing this product
   * claims to be. The sentence says what the model holds; this says what would
   * be worth putting in it.
   *
   * ⛔ ADDED, NOT SWAPPED. Promoting the leading-indicator question to the card
   * face was a reasoned decision with its own measurement (see the block above:
   * *"without it a risk can reach a decision with no agreed trigger for acting
   * on it"*,
   * and it is deliberately phase-independent). Since 14 of 14 starter risks are
   * unsized, swapping on this predicate would delete that question from every
   * risk on every shipped starter — reversing a settled ruling by side effect,
   * on evidence that says nothing about it.
   *
   * ⭐ IT REUSES `NodeChip` RATHER THAN INVENTING A CONTROL, and that buys the
   * touch target for free: `NodeChip`'s `before:` pseudo-element expands it to
   * the WCAG 2.2 AA 2.5.8 24px box without changing the painted size, and its
   * chrome already recedes at rest. A hand-rolled button here would be an
   * 18.5px target and a fourth amber-adjacent vocabulary.
   *
   * ⚠ IT ASKS; IT NEVER WRITES. `NodeChip` with a null `actionType` dispatches a
   * coaching prompt into the conversation — the user reads the answer and
   * decides. A control that silently wrote a probability onto the node would
   * make the AI the author of the user's risk assessment, which is the line
   * `TierInvitation`'s header draws and `CLAUDE.md` ratifies: *"Humans remain
   * the authors and the decision-makers."*
   *
   * ⚠ DENSITY, STATED RATHER THAN HOPED. This puts a SECOND chip on the face of
   * an unsized risk, and Paul's 15 Sep note — *"it looks an absolute mess"* —
   * was about exactly this kind of accumulation. Three things bound it: the
   * chips share one `flex-wrap` row rather than adding a block; the chrome is
   * transparent at rest after #1061's quietening, so at rest this is one more
   * short line of text, not one more bordered box; and it is gated on a card
   * that currently renders NOTHING in that region, which is the emptiest card
   * class on the board (median risk height 86px against option 250, factor
   * 141 — `nodeLayoutConstants.ts`). If it is still too much, this chip can be
   * withdrawn on its own and the sentence above stands without it.
   */
  // ⚠ The three surfaces ask for three DIFFERENT resolutions, and the card's
  // order is deliberately not the Detailed order — see the resolver's docblock.
  const riskCoachingState = useMemo(() => ({ exposureUnstated }), [exposureUnstated])
  const riskCoachingContext = useMemo(
    () => ({ label: cleanedLabel, riskContext }),
    [cleanedLabel, riskContext],
  )

  const riskFaceCoaching = useMemo(
    () => resolveNodeCoaching({ kind: 'risk', surface: 'card', state: riskCoachingState, context: riskCoachingContext }),
    [riskCoachingState, riskCoachingContext],
  )

  const riskPopoverChips = useMemo(() => (
    <CoachingChipRow
      className="flex gap-1 flex-wrap mt-1.5"
      chips={resolveNodeCoaching({ kind: 'risk', surface: 'popover', state: riskCoachingState, context: riskCoachingContext })}
    />
  ), [riskCoachingState, riskCoachingContext])

  // Detailed view keeps all three inline, exactly as before.
  const riskChips = useMemo(() => (
    <CoachingChipRow
      className="flex gap-1 flex-wrap mt-1.5"
      chips={resolveNodeCoaching({ kind: 'risk', surface: 'detailed', state: riskCoachingState, context: riskCoachingContext })}
    />
  ), [riskCoachingState, riskCoachingContext])

  /**
   * ⭐ ONE ROW RHYTHM, AND NOTHING TRAILING — contract v3.1 (RHY-06): `.node`
   * is a column with `gap: 4px`. BaseNode's header already gives the first row
   * its 4px, so the FIRST body row carries no top margin and every later row
   * carries `mt-1`. The trailing `mb-1`s this replaces left 4px of dead space
   * above the card's bottom band and put a recorded value flush against the
   * line beneath it. Heights only shrink or stay: the rows are unchanged, and
   * a card whose last row carried `mb-1` loses that 4px.
   */
  const showSeverityBadge = isDetailed && severity != null
  const severityBadgeMargin = recordedValue ? ' mt-1' : ''
  const exposureLineMargin = recordedValue || showSeverityBadge ? ' mt-1' : ''

  // Severity badge — derived from node probability × impact via calculateRiskSeverity
  // (the existing probability×impact derivation, reused not re-added). P1.7 put it
  // in the Standard body; since the locked Canvas design (23 Sep 2026) it is
  // DETAILED-ONLY — its cut-offs are UI-chosen, so it is not a resting claim.
  const detailedMetrics = severity ? (
    <div
      // The `textAlign: 'center'` that was here is gone, and the badge is now a
      // `w-fit` pill, not a full-bleed block, so its copy sits left like every
      // other line of the node.
      //
      // ⛔ Paul 23 Sep contract feedback point 9: "risk = existing Danger
      // treatment … do not invent new colours". `getRiskSeverityColors` painted
      // low/medium in Tailwind yellow/orange defaults that are not in the design
      // system, and high/critical as `text-danger`, which fails small-text
      // contrast (`nodeSystem.semanticColourOnText.spec.ts`). Every band is now
      // the design-system outlined pill — danger border at /30, body text — and
      // the WORD carries the severity, not a colour.
      //
      // ⭐ Contract v3.1 pill grammar (FRAME-15, OR-12): `border-radius: 999px`
      // and ~6px horizontal padding, the same `rounded-full px-1.5 py-0.5
      // bg-panel border` every other in-card pill uses (GoalNode's constraint
      // pills). It was the only 4px-radius rectangle on the canvas. `flex w-fit`
      // rather than `inline-flex`: a block-level box sits on no line box, so the
      // body's strut cannot add height to it. Same padding and border as
      // before, so the badge is no taller; the `mt-1` wrapper and the trailing
      // `mb-1` are gone (RHY-06 rhythm above).
      className={`${typography.edgeLabel} flex w-fit items-center bg-panel border border-danger/30 text-text-body rounded-full px-1.5 py-0.5${severityBadgeMargin}`}
      data-testid="risk-severity-badge"
    >
      {/* Sentence case (DS v5 §2; contract v3.1 T13): "High risk", not "High Risk". */}
      {severity.charAt(0).toUpperCase() + severity.slice(1)} risk
    </div>
  ) : null

  /** The exposure state as a whole sentence — Detailed's line, the popover's, and the sr-only copy. */
  const exposureFull = exposureReadout ? `${RISK_ENTERED_QUALIFIER} · ${exposureReadout}` : RISK_EXPOSURE_UNSET_LINE

  // Detailed (expert) view keeps the full inline anatomy, unchanged.
  const riskExposureLineDetailed = exposureReadout ? (
    <div className={`${typography.edgeLabel} text-text-light${exposureLineMargin}`} data-testid="risk-exposure-line">{RISK_ENTERED_QUALIFIER} · {exposureReadout}</div>
  ) : (
    <div className={`${typography.edgeLabel} text-text-light${exposureLineMargin}`} data-testid="risk-exposure-unset">
      {RISK_EXPOSURE_UNSET_LINE}
    </div>
  )

  /**
   * ⭐⭐ THE STANDARD CARD'S ONE PRIMARY LINE — Experience Design #63
   * 5809278282 (24 Sep 2026): *"repeated cards may reduce to title + one
   * primary line inside the fixed fit-safe box … Outcome/Risk = state … Keep one
   * stable layout geometry"* (no rung-triggered re-layout: this line is the same
   * DOM at every rung, so a Normal-zoom card is never taller than the landing
   * one).
   *
   * Which state is THE state, in order:
   *   1. a recorded size (`nodeRecordedValue`, with its source mark) — the risk's
   *      own magnitude in its own unit, the same datum the reduced line speaks
   *      (rule 2: the node's own unit first). The exposure sentence rides
   *      `sr-only`, `title` and the popover — never "Not set yet" beside it.
   *   2. the entered likelihood/impact pair, figures first (`90% likely · High
   *      impact`); `Entered estimate` rides `title`, `sr-only` and the popover.
   *   3. the unset state, `Not set yet`; the sentence rides the same three.
   *
   * ONE VISUAL LINE (`whitespace-nowrap overflow-hidden`): a text state takes
   * `text-ellipsis`, and since each short form ends in the state, anything an
   * ellipsis could reach is a trailing LABEL word; the recorded row keeps the
   * value `shrink-0` and first, so the value is never what gives way.
   *
   * ⚠ THE TESTIDS ARE THE ONES THESE STATES ALREADY HAD (`risk-recorded-value`,
   * `risk-exposure-line`, `risk-exposure-unset`), now on the one element that
   * states them; `data-card-primary-line` marks it as the body's only row.
   *
   * ⚠ THE RECORDED ROW IS ONE ELEMENT FOR BOTH VIEWS, NOT TWO BRANCHES.
   * `the-recorded-value-carries-its-weight` anchors on `risk-recorded-value`
   * and requires it to be unique in this file ("an anchor that is not unique is
   * not a binding"). So the view changes the row's CLASSES — Detailed keeps its
   * `flex-wrap` row; Standard is the one nowrap line with the sentence in
   * `sr-only` and on `title` — and the render site stays single.
   */
  const riskRecordedRow = recordedValue ? (
    <div
      className={`${typography.nodeValue} text-text-body flex items-baseline gap-1 ${isDetailed ? 'flex-wrap' : 'whitespace-nowrap overflow-hidden'}`}
      data-testid="risk-recorded-value"
      {...(isDetailed ? {} : { 'data-card-primary-line': 'risk', title: `${recordedValue} · ${exposureFull}` })}
    >
      <span className="shrink-0" data-testid="risk-recorded-readout">{recordedValue}</span>
      {recordedValueMark && (
        <ValueSourceMark mark={recordedValueMark} testId={`risk-value-source-${props.id}`} onOpenSource={() => { openNodeInspector(props.id) }} />
      )}
      {!isDetailed && (
        <span className={typography.screenReaderOnly} data-testid="risk-primary-line-full">{exposureFull}</span>
      )}
    </div>
  ) : null

  /** Standard, no recorded size: the exposure state IS the primary line. */
  /**
   * ⚠ THE ENTERED PAIR KEEPS ITS PROVENANCE ON THE CARD (ED 5809278282: "value
   * provenance remain[s] explicit … never hide provenance … in tooltip-only
   * copy"). Nothing records WHO entered likelihood/impact; the 9 Sep design's
   * provenance for them IS "entered estimate", so the card says `· entered`
   * after the figures, muted. This state may wrap rather than cut a figure or
   * its qualifier — it is rare on real boards (the starters' risks are unset),
   * and a cut value would be the worse defect. The unset state stays one line.
   */
  /*
   * ⭐ CONTRACT v3.1 (DESIGN-GAP-v31 #34; audit #32): the unset state is the
   * fixture's whole state label, VISIBLE — "Likelihood and impact not set yet"
   * (`.small-state`) — not the bare "Not set yet", which left a reader to guess
   * WHAT is not set (measured on served `eec722ab`: every starter risk read
   * "Not set yet"; the full sentence was sr-only, `title` and popover only). It
   * wraps rather than being cut: at the landing counter-scale it can take a
   * second line, and a cut would eat the state word, the one cut this line may
   * never make (`RISK_EXPOSURE_UNSET_SHORT`'s own reasoning).
   */
  const riskExposureLine = !isDetailed && !recordedValue ? (
    <div
      className={`${typography.edgeLabel} text-text-light break-words`}
      data-testid={exposureReadout ? 'risk-exposure-line' : 'risk-exposure-unset'}
      data-card-primary-line="risk"
    >
      <span aria-hidden="true">{exposureReadout || RISK_EXPOSURE_UNSET_LINE}</span>
      {exposureReadout && (
        <span aria-hidden="true" className="italic" data-testid="risk-exposure-provenance"> · entered</span>
      )}
      <span className={typography.screenReaderOnly} data-testid="risk-primary-line-full">{exposureFull}</span>
    </div>
  ) : null

  /**
   * ⭐ WHAT LEFT THE STANDARD BODY, IN THE POPOVER IT MOVED TO (ED 5809278282:
   * "can move to the existing hover/focus popover and inspector rather than
   * expanding layout geometry"). Both phases: the full exposure sentence (with
   * its `Entered estimate` qualifier) and the authored context the card used to
   * preview in two clamped lines. The description chevron and the inspector
   * still carry the full text.
   */
  const riskPopoverOwnState = (
    <>
      <p className={`${typography.edgeLabel} text-text-body m-0`} data-testid="risk-popover-state">{exposureFull}</p>
      {summary && (
        <p className={`${typography.edgeLabel} text-text-light m-0 mt-1 line-clamp-3 break-words whitespace-pre-wrap`} data-testid="risk-popover-context">
          {summary}
        </p>
      )}
    </>
  )

  // ----- Layer 2 content: post-analysis (shared between popover and Detailed inline) -----
  const layer2ContentPost = isPostAnalysis ? (
    <>
      {/* "Depends on:" ConnRows (max 3) */}
      {inboundConnections.length > 0 && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Depends on:</p>
          {/* Wireframe v4: max 3 ConnRows in both PHASE views (pre-/post-analysis —
              NOT standard/detailed; this block is detailed-view only, see FactorNode.tsx:688); remainder disclosed
              via "+N more in inspector" (audit §8 P0-5). */}
          {inboundConnections.slice(0, 3).map(conn => (
            <ConnRow
              key={conn.edgeId}
              edgeId={conn.edgeId}
              nodeKind={conn.connectedNodeKind}
              label={conn.connectedNodeLabel}
              confidencePct={conn.confidencePct}
            />
          ))}
          <ConnRowsOverflow total={inboundConnections.length} shown={3} />
        </>
      )}

      {/* Actionable: factor-specific wording. Graph v1.1 Task 4: removed the
          "Driven by factors outside your control" lead-in — the dashed border
          on the connected external factor already communicates that. */}
      {/* ⛔ ONE STRING. `counterfactualQuestion` is read by BOTH the label and
          the message — see that module for why. This block previously rendered
          the subject sliced to 18 chars INSIDE the sentence while sending the
          full one, so the user read one question and asked another. Do not
          re-introduce a slice here; if the line is too long, that is CSS. */}
      {counterfactualQuestion && (
        <>
          <Sep />
          <p className={`${typography.edgeLabel} text-text-body m-0`}>
            <button
              type="button"
              className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
              onClick={(e) => {
                e.stopPropagation()
                const send = useGuidanceStore.getState()._sendMessage
                if (send) send(counterfactualQuestion)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {counterfactualQuestion}
            </button>
          </p>
        </>
      )}
    </>
  ) : null

  // ----- Layer 2 content: pre-analysis popover -----
  const preAnalysisPopoverContent = !isPostAnalysis && preAnalysisInbound.length > 0 ? (
    <>
      <PreAnalysisDrivenByLine items={preAnalysisInbound} topSetItem={preAnalysisTopSet} />
      <PreAnalysisInboundRows items={preAnalysisInbound.slice(0, 5)} />
      {/* Polish 4 review: removed the "Are there other risks?" /
          "What's the worst case?" chips. The body now carries the canonical
          pair ("What reduces this?" + "Add mitigation") in both phases — the
          audit table allows max 2 chips per node and stacking another 2 in
          the popover would push the total to 4. */}
    </>
  ) : null

  return (
    <div
      ref={nodeElRef as React.Ref<HTMLDivElement>}
      style={{ position: 'relative' }}
      onMouseEnter={nodeHandlers.onMouseEnter}
      onMouseLeave={nodeHandlers.onMouseLeave}
      /* The TAP path. A no-op on a pointer device (`usePopoverHover` gates it
         on `hover: none`); on touch it is the only way this node preview can
         be opened at all. It does not stopPropagation, so the tap still
         selects the node. */
      onClick={nodeHandlers.onClick}
    >
      <BaseNode
        {...props}
        data={cleanedData}
        nodeType="risk"
        lodMetric={lodMetric}
        icon={metadata.icon}
        coaching={riskFaceCoaching}
        headerSlot={isDetailed && scienceIcons.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            {scienceIcons.map(si => (
              <ScienceIcon key={si.id} icon={si.icon} tooltip={si.tooltip} action={si.action} colour={si.colour} />
            ))}
          </span>
        ) : undefined}
      >
        {/* ===== LAYER 1: Standard body (always visible) ===== */}

        {/* ⭐⭐ THE RISK'S OWN MAGNITUDE, ABOVE EVERY FIGURE THAT IS ABOUT
            SOMETHING ELSE. The severity band beneath is derived from probability ×
            impact, which is not this risk's size either. A risk labelled "Time to
            Reach Customer Target" holds `12 months` in its own data and printed none
            of it (`RiskNode` carried zero `observedState` references against a
            contrast of twenty in `FactorNode`).

            ⛔ NO BAR, AND THAT IS THE POINT RATHER THAN AN OMISSION. A
            proportional bar is measurement grammar for a 0..1 share — what
            `NodeMetricRow` requires. A recorded magnitude in months or pounds
            has no such scale, and drawing
            one would put a native value on a normalised axis, which is the
            confusion this row exists to end.

            ⚠ ABSENT WHEN NOTHING IS RECORDED, with no placeholder. "Not set yet"
            belongs to a connection strength somebody can settle; a risk nobody
            has sized is a different fact, and pooling the two under one noun is
            what the design review objected to. */}
        {/* ⭐⭐ STANDARD VIEW: ONE PRIMARY LINE, AND NOTHING ELSE IN THE BODY
            (Experience Design #63 5809278282, 24 Sep 2026 — see
            `riskRecordedRow` / `riskExposureLine`). The recorded size, the entered pair or the unset
            state; the full sentence, the `Entered estimate` qualifier and the
            authored context moved to the popover below (both phases), and stay
            in the inspector and behind the description chevron. */}
        {riskRecordedRow}
        {riskExposureLine}

        {/* ===== Detailed inline anatomy (unchanged by the fit) =====
            ⭐ Contract v3.1 `own-value` (OR-06): value + source mark on one
            baseline row, exactly the factor card's anatomy — `riskRecordedRow`
            above, shared with Standard (see its note). The first body row, so
            no top margin (RHY-06). The mark is inline, so no height change. */}

        {/* The probability × impact pair is the node's OWN entered data; the
            derived severity badge beside it is Detailed-only (locked design,
            23 Sep 2026 — see the gate below). No fabrication when data is
            absent. */}
        {/* ⭐ The derived severity badge ("High risk") is Detailed information
            (#1900, credited by the purpose audit): its cut-offs are UI-chosen, so
            it is not a resting claim. */}
        {showSeverityBadge && detailedMetrics}
        {isDetailed && riskExposureLineDetailed}

        {/* ⭐ Authored context comes AFTER the card's own state, one step
            smaller — contract v3.1 (OR-08): the title is followed directly by
            the node's own state; any other prose is subordinate, at 11px or
            smaller. Still two lines at most, still hidden while the chevron
            shows the full description (BaseNode). Always preceded by the
            exposure line, so it always takes the row gap (RHY-06). Detailed
            only since ED 5809278282; Standard carries it in the popover. */}
        {isDetailed && summary && (
          <p className={`${typography.edgeLabel} text-text-light m-0 mt-1 line-clamp-2 break-words whitespace-pre-wrap group-aria-expanded:hidden`} data-testid="risk-context-preview">
            {summary}
          </p>
        )}

        {/* ⛔ NO LINK-STRENGTH ROW (contract v3.1: "Outcome/risk records are
            distinct from the strength of their connections"; gap U1). The card
            carries the risk's own state only — recorded size, likelihood and
            impact, or the unset sentence; the connection carries its strength. */}

        {/* The leading-indicator question rides the CARD in Standard view; the
            reduce/mitigate pair stays in the popover. Detailed renders all
            three inline below. See `riskFaceChip` for the measurement. */}
        {/* ⛔ NO COACHING CHIPS ON THE FACE (ED 11:52Z point 5). The rail's coaching
            icon asks "What would we see first?"; "How likely is this?" moves to
            the popover and Detailed (ED 02:31Z D4 — not deleted). */}

        {/* ===== LAYER 2: Detailed inline (only in Detailed view) =====
            Graph v1.1 Task 4: align with wireframe v4. The severity badge renders
            once, in the body above, Detailed-only — so it is NOT repeated here. */}
        {isDetailed && layer2ContentPost}

        {/* Detailed pre-analysis: inbound factor list — max 3 whole rows in
            the card, remainder disclosed (audit §8 P0-5 containment). */}
        {isDetailed && !isPostAnalysis && preAnalysisInbound.length > 0 && (
          <>
            <Sep />
            <p className={`${typography.edgeLabel} font-medium text-text-body m-0 mb-0.5`}>Driven by:</p>
            <PreAnalysisInboundRows items={preAnalysisInbound.slice(0, 3)} />
            <ConnRowsOverflow total={preAnalysisInbound.length} shown={3} />
          </>
        )}

        {/* Detailed view: coaching chips inline (Standard renders them in
            the popovers below). */}
        {isDetailed && riskChips}
      </BaseNode>

      {/* ===== LAYER 2: Popover (Standard view, post-analysis, desktop hover) ===== */}
      {!isDetailed && isPostAnalysis && (
        <NodePopover
          visible={showPopover}
          width={240}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {/* The card's own state in full + the authored context (moved off
              the Standard body, ED 5809278282), then the post-analysis detail
              + coaching chips; the severity badge is Detailed-only (locked
              design, 23 Sep 2026). */}
          {riskPopoverOwnState}
          {layer2ContentPost}
          {riskPopoverChips}
        </NodePopover>
      )}

      {/* ===== LAYER 2: Popover (Standard view, pre-analysis, desktop hover) =====
          Always renders in pre-analysis Standard so the coaching chips have
          a home, even when there are no inbound factors yet. */}
      {!isDetailed && !isPostAnalysis && (
        <NodePopover
          visible={showPopover}
          width={240}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {riskPopoverOwnState}
          {preAnalysisPopoverContent && <Sep />}
          {preAnalysisPopoverContent}
          {riskPopoverChips}
        </NodePopover>
      )}
    </div>
  )
})

RiskNode.displayName = 'RiskNode'
