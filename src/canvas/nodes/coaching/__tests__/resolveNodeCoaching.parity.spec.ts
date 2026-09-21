/**
 * ⭐⭐⭐ BEHAVIOUR-PRESERVATION PARITY FOR THE ONE COACHING RESOLVER.
 *
 * This is a REFACTOR spec, so the load-bearing guarantee is not "the resolver
 * says something sensible" — it is "the resolver says EXACTLY what the node
 * file said before, in EXACTLY the same order, on EXACTLY the same producer
 * conditions". CLAUDE.md trap 5: a refactoring fold is a new change, not a
 * patch, and one shipped a regression here under green CI and 2,291 passing
 * tests because its own parity test checked value but never ORDER.
 *
 * ── WHAT IS PINNED, AND WHY IT IS THE WHOLE SHAPE ───────────────────────────
 *
 * Every expectation below is a `toEqual` against the FULL ordered array of
 * chip objects — `id`, `label`, `message` AND `actionType`. All four are
 * user-reachable: `label` is painted, `message` is sent as the user's own turn,
 * `id` ships as `chip.parameters.chip_id`, and `actionType` decides whether
 * `NodeChip` routes through `canonicalRunRegistry` or the coaching dispatcher.
 * A parity test that checked only the visible label would pass while the wire
 * intent silently changed — which is the same class as
 * `DecisionNode.invitations.spec.tsx` scanning rendered label text while the
 * falsehood lived in `message` (recorded in DecisionNode.tsx's own docblock).
 *
 * `toEqual` on the array pins ORDER by construction. An order-blind assertion
 * (`toContainEqual`, `expect.arrayContaining`, or sorting first) would be the
 * exact vacuity trap 5 records, so none is used anywhere in this file.
 *
 * ── THE EXPECTATIONS ARE TRANSCRIBED FROM PRISTINE SOURCE, NOT INVENTED ─────
 *
 * Each table entry names the pristine file and the `useMemo`/JSX block it came
 * from, at `719915a9` (origin/staging when this lane branched). They are a
 * record of what the product said before this refactor, so per CLAUDE.md trap
 * 14b they are EVIDENCE and append-only: a future change to the copy adds a
 * new case or amends the table with its own reasoning, and must never rewrite
 * one of these to make a red go green.
 *
 * ── `null` IS A FIRST-CLASS OUTPUT AND HAS ITS OWN TESTS ────────────────────
 *
 * `FactorNode`'s selector returns `null` for a factor with an observed, owned
 * value, deliberately: *"there is no assumption to interrogate, and a chip on
 * every card is wallpaper."* `OptionNode` returns `null` for pre-analysis
 * `optionChips` and for a post-analysis option whose win rate the producer
 * could not compute. A resolver that returned something for every node would
 * put a chip on every card — the precise outcome those designs reject.
 *
 * ⚠ THERE IS EXACTLY ONE REPRESENTATION OF SILENCE, and a test asserts it.
 * `null` means "deliberately silent"; the resolver must NEVER return `[]`.
 * Two spellings of nothing would be CLAUDE.md trap 21 — two questions under
 * one name — and the guard against it (`test: never returns an empty array`)
 * iterates the whole request corpus rather than the cases I happened to think
 * of.
 *
 * ── WHAT THIS CORPUS EXCLUDES, STATED RATHER THAN HOPED ────────────────────
 *
 * · `goal_run_analysis` and `decision_run_analysis` are NOT here. Both files'
 *   own comments classify them as primary ACTION buttons rather than coaching
 *   ("that's a primary action button rather than coaching"), and they carry
 *   `actionType="run_analysis"`, which routes through `canonicalRunRegistry`
 *   rather than the coaching dispatcher. They were left in place; folding them
 *   would have normalised a distinction their authors drew on purpose.
 * · `StyledEdge.tsx`'s chips are EDGE coaching, out of this lane's fence.
 * · No case supplies a magnitude for the resolver to interpret. Every state
 *   field below is a producer boolean or a null-check compared by identity —
 *   `needsInput`, `category === 'external'`, `extractionType === 'inferred'`,
 *   `winRate !== null`, `closeCallGapPp != null`. FactorNode's docblock is
 *   explicit that this is the permitted form: *"No threshold is chosen and no
 *   number is interpreted."* A separate test asserts the resolver module
 *   contains no numeric comparison at all, so a future threshold cannot arrive
 *   quietly.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  resolveNodeCoaching,
  ALL_COACHING_REQUESTS_FOR_TEST,
  type CoachingChip,
  type NodeCoachingRequest,
} from '../resolveNodeCoaching'

const RISK_CTX = ' [risk-ctx]'
const OUTCOME_CTX = ' [outcome-ctx]'

/**
 * ⚠ IDENTITY-UNIQUENESS PRECONDITION, PINNED IN-TEST SO IT CAN ITSELF FAIL.
 *
 * Every assertion in this file binds to a chip by its `id`, and identity
 * binding is only sound if identity is unique within the array being asserted
 * (CLAUDE.md trap 19). A resolver arm that returned the same chip twice would
 * satisfy a "contains this id" check and would also make a `toEqual` table
 * silently encode a duplicate as intended. This asserts uniqueness across
 * every arm, and it is a real test that reds — not a comment.
 */
const expectUniqueIds = (chips: readonly CoachingChip[], where: string) => {
  const ids = chips.map(c => c.id)
  expect(new Set(ids).size, `duplicate chip id within ${where}: ${ids.join(', ')}`).toBe(ids.length)
}

describe('resolveNodeCoaching — behaviour parity with the pristine per-node selectors', () => {
  // ─── RiskNode ────────────────────────────────────────────────────────────
  // Pristine: RiskNode.tsx `riskFaceChip` / `riskPopoverChips` / `riskChips`.
  const riskLeadingIndicator = (label: string): CoachingChip => ({
    id: 'risk_leading_indicator',
    label: 'What would we see first?',
    message: `What early signs or leading indicators would tell us ${label} is starting to happen, and what should trigger a response?${RISK_CTX}`,
    actionType: null,
  })
  const riskSizeExposure = (label: string): CoachingChip => ({
    id: 'risk_size_exposure',
    label: 'How likely is this?',
    message: `How likely is ${label}, and how serious would it be if it happened? Help me put a first estimate on both, and tell me what I would need to know to sharpen them.${RISK_CTX}`,
    actionType: null,
  })
  const riskWhatReduces = (label: string): CoachingChip => ({
    id: 'risk_what_reduces',
    label: 'What reduces this?',
    message: `What factors or actions could reduce ${label}?${RISK_CTX}`,
    actionType: null,
  })
  const riskAddMitigation = (label: string): CoachingChip => ({
    id: 'risk_add_mitigation',
    label: 'Explore mitigation',
    message: `Suggest a mitigation strategy for ${label}, and explain what it would change.${RISK_CTX}`,
    actionType: null,
  })

  const riskReq = (
    surface: 'card' | 'popover' | 'detailed',
    exposureUnstated: boolean,
    label = 'Supplier fails',
  ): NodeCoachingRequest => ({
    kind: 'risk',
    surface,
    state: { exposureUnstated },
    context: { label, riskContext: RISK_CTX },
  })

  it('risk / card / exposure unstated → leading indicator THEN size exposure, in that order', () => {
    const out = resolveNodeCoaching(riskReq('card', true))
    expect(out).toEqual([riskLeadingIndicator('Supplier fails'), riskSizeExposure('Supplier fails')])
    expectUniqueIds(out!, 'risk/card/unstated')
  })

  /**
   * ⭐ THE CONTRAST CASE, AND IT IS THE LOAD-BEARING ONE HERE.
   *
   * RiskNode's docblock rules on this explicitly: *"ADDED, NOT SWAPPED …
   * swapping on this predicate would delete that question from every risk on
   * every shipped starter — reversing a settled ruling by side effect."* So the
   * leading-indicator question must survive a SIZED risk, and only a sized case
   * can tell that guard from a constant. Without this test a resolver that
   * swapped the two chips would be green.
   */
  it('risk / card / exposure STATED → leading indicator survives, size exposure is dropped', () => {
    expect(resolveNodeCoaching(riskReq('card', false))).toEqual([riskLeadingIndicator('Supplier fails')])
  })

  it('risk / popover → what-reduces THEN mitigation, phase-independent', () => {
    expect(resolveNodeCoaching(riskReq('popover', true))).toEqual([
      riskWhatReduces('Supplier fails'),
      riskAddMitigation('Supplier fails'),
    ])
    expect(resolveNodeCoaching(riskReq('popover', false))).toEqual([
      riskWhatReduces('Supplier fails'),
      riskAddMitigation('Supplier fails'),
    ])
  })

  it('risk / detailed → all three inline, what-reduces THEN mitigation THEN leading indicator', () => {
    const out = resolveNodeCoaching(riskReq('detailed', true))
    expect(out).toEqual([
      riskWhatReduces('Supplier fails'),
      riskAddMitigation('Supplier fails'),
      riskLeadingIndicator('Supplier fails'),
    ])
    expectUniqueIds(out!, 'risk/detailed')
  })

  /**
   * ⚠ ORDER IS ASSERTED SEPARATELY FROM CONTENT, because the two fail for
   * different reasons and a single `toEqual` that reds tells you only that
   * something moved. `riskChips` put the promoted face question LAST inline
   * while `riskFaceChip` puts it FIRST — so a resolver that shared one ordered
   * list between the two surfaces would be wrong, and this is the assertion
   * that sees it.
   */
  it('risk: the detailed order is NOT the card order — the surfaces differ deliberately', () => {
    const card = resolveNodeCoaching(riskReq('card', true))!.map(c => c.id)
    const detailed = resolveNodeCoaching(riskReq('detailed', true))!.map(c => c.id)
    expect(card[0]).toBe('risk_leading_indicator')
    expect(detailed[detailed.length - 1]).toBe('risk_leading_indicator')
    expect(card).not.toEqual(detailed)
  })

  it('risk: the empty label falls back to "this risk", exactly as `cleanedLabel || \'this risk\'` did', () => {
    expect(resolveNodeCoaching(riskReq('card', false, ''))).toEqual([riskLeadingIndicator('this risk')])
  })

  // ─── OutcomeNode ─────────────────────────────────────────────────────────
  // Pristine: OutcomeNode.tsx `outcomeFaceChip` / `outcomePopoverChips` /
  // `outcomeChips`, plus the `outcome_validate_assumption` chip inside
  // `layer2ContentPost`.
  const outcomeFalsify = (label: string): CoachingChip => ({
    id: 'outcome_what_would_falsify',
    label: 'What would falsify this?',
    message: `What evidence or result would show that ${label} will NOT happen? What would have to be true for it to fail?${OUTCOME_CTX}`,
    actionType: null,
  })
  const outcomeConsequences = (label: string): CoachingChip => ({
    id: 'outcome_explore_consequences',
    label: 'Explore consequences',
    message: `What would ${label} mean for this model, including possible benefits and downsides?${OUTCOME_CTX}`,
    actionType: null,
  })
  const outcomeStrengthens = (label: string): CoachingChip => ({
    id: 'outcome_what_strengthens',
    label: 'What affects this?',
    message: `Which upstream factors affect ${label}, and how could we strengthen its beneficial effects or limit its downsides?${OUTCOME_CTX}`,
    actionType: null,
  })

  const outcomeReq = (
    surface: 'card' | 'popover' | 'detailed',
    isPostAnalysis: boolean,
    label = 'Churn falls',
  ): NodeCoachingRequest => ({
    kind: 'outcome',
    surface,
    state: { isPostAnalysis },
    context: { label, outcomeContext: OUTCOME_CTX },
  })

  it('outcome / card → the falsification question alone, in BOTH phases', () => {
    expect(resolveNodeCoaching(outcomeReq('card', false))).toEqual([outcomeFalsify('Churn falls')])
    expect(resolveNodeCoaching(outcomeReq('card', true))).toEqual([outcomeFalsify('Churn falls')])
  })

  it('outcome / popover / pre-analysis → consequences THEN what-affects', () => {
    expect(resolveNodeCoaching(outcomeReq('popover', false))).toEqual([
      outcomeConsequences('Churn falls'),
      outcomeStrengthens('Churn falls'),
    ])
  })

  /**
   * ⚠ THE OPPOSITE-DIRECTION TWIN (CLAUDE.md trap 22b). `outcome_what_strengthens`
   * is gated `!isPostAnalysis` in pristine. Asserting only the pre-analysis arm
   * would pass against a resolver that ignored the phase entirely.
   */
  it('outcome / popover / post-analysis → consequences ONLY; what-affects is phase-gated out', () => {
    expect(resolveNodeCoaching(outcomeReq('popover', true))).toEqual([outcomeConsequences('Churn falls')])
  })

  it('outcome / detailed / pre-analysis → consequences, what-affects, falsify — in that order', () => {
    expect(resolveNodeCoaching(outcomeReq('detailed', false))).toEqual([
      outcomeConsequences('Churn falls'),
      outcomeStrengthens('Churn falls'),
      outcomeFalsify('Churn falls'),
    ])
  })

  it('outcome / detailed / post-analysis → consequences THEN falsify, what-affects dropped', () => {
    expect(resolveNodeCoaching(outcomeReq('detailed', true))).toEqual([
      outcomeConsequences('Churn falls'),
      outcomeFalsify('Churn falls'),
    ])
  })

  it('outcome / validate → the assumption chip carries the caller\'s derived question verbatim', () => {
    expect(
      resolveNodeCoaching({
        kind: 'outcome',
        surface: 'validate',
        state: { isPostAnalysis: true },
        context: { label: 'Churn falls', outcomeContext: OUTCOME_CTX, validateQuestion: 'Does price really move churn?' },
      }),
    ).toEqual([
      {
        id: 'outcome_validate_assumption',
        label: 'Validate this assumption',
        message: 'Does price really move churn?',
        actionType: null,
      },
    ])
  })

  /**
   * The pristine render site is `{validateQuestion && (…)}`, so no chip exists
   * without a derived question. The resolver must not invent one — a fabricated
   * message here would be the product asking a question nobody derived.
   */
  it('outcome / validate with no derived question → null, never a chip with an empty message', () => {
    expect(
      resolveNodeCoaching({
        kind: 'outcome',
        surface: 'validate',
        state: { isPostAnalysis: true },
        context: { label: 'Churn falls', outcomeContext: OUTCOME_CTX },
      }),
    ).toBeNull()
  })

  // ─── ActionNode ──────────────────────────────────────────────────────────
  it('action / card → the one preconditions question', () => {
    expect(
      resolveNodeCoaching({
        kind: 'action',
        surface: 'card',
        state: {},
        context: { label: 'Hire two engineers' },
      }),
    ).toEqual([
      {
        id: 'action_what_must_be_true',
        label: 'What has to be true?',
        message: 'What has to be true for Hire two engineers to work, and how would we know if it were not?',
        actionType: null,
      },
    ])
  })

  it('action: the empty label falls back to "this action"', () => {
    expect(
      resolveNodeCoaching({ kind: 'action', surface: 'card', state: {}, context: { label: '' } })![0].message,
    ).toBe('What has to be true for this action to work, and how would we know if it were not?')
  })

  // ─── DecisionNode ────────────────────────────────────────────────────────
  /**
   * ⭐ THE OPTION COUNT IS COUNTED, NEVER ASSESSED, and the pluralisation is
   * part of the authored sentence. DecisionNode's docblock records that the
   * pristine string hardcoded "a third option" and *"is sent as the USER'S OWN
   * message, so the user is made to state a false fact about their own board"*.
   * The count is observable; that is why it is permitted. Both the singular and
   * the plural arm are asserted, because a resolver that always wrote "options"
   * would be green against the plural case alone.
   */
  const decisionReq = (
    surface: 'preAnalysis' | 'postAnalysis',
    optionCount: number,
    showRunAnalysis: boolean,
  ): NodeCoachingRequest => ({
    kind: 'decision',
    surface,
    state: { showRunAnalysis },
    context: { optionCount },
  })

  it('decision / pre-analysis / run CTA hidden → explore-options THEN what-could-go-wrong', () => {
    expect(resolveNodeCoaching(decisionReq('preAnalysis', 3, false))).toEqual([
      {
        id: 'decision_explore_more_options',
        label: 'Explore more options',
        message:
          'My model has 3 options so far. What other options could answer this decision that I have not put on the board?',
        actionType: null,
      },
      {
        id: 'decision_what_could_go_wrong',
        label: 'What could go wrong?',
        message: 'What could go wrong with this decision?',
        actionType: null,
      },
    ])
  })

  it('decision / pre-analysis / run CTA SHOWN → what-could-go-wrong is dropped', () => {
    expect(resolveNodeCoaching(decisionReq('preAnalysis', 3, true))).toEqual([
      {
        id: 'decision_explore_more_options',
        label: 'Explore more options',
        message:
          'My model has 3 options so far. What other options could answer this decision that I have not put on the board?',
        actionType: null,
      },
    ])
  })

  it('decision: one option is singular, and the sentence is byte-identical to pristine otherwise', () => {
    expect(resolveNodeCoaching(decisionReq('preAnalysis', 1, true))![0].message).toBe(
      'My model has 1 option so far. What other options could answer this decision that I have not put on the board?',
    )
  })

  it('decision: zero options pluralises, exactly as `optionCount === 1 ? \'\' : \'s\'` did', () => {
    expect(resolveNodeCoaching(decisionReq('preAnalysis', 0, true))![0].message).toBe(
      'My model has 0 options so far. What other options could answer this decision that I have not put on the board?',
    )
  })

  /**
   * ⚠ THE WIRE INTENTS ARE PART OF THE PARITY CLAIM, not decoration. These two
   * are the only coaching chips in the folded population carrying a non-null
   * `actionType`, and DecisionNode's docblock is explicit that the typed route
   * *"is unchanged and was never wrong"* — so a fold that dropped them to null
   * would silently change what CEE receives while every rendered label stayed
   * identical.
   */
  it('decision / post-analysis → challenge THEN compare, carrying their typed wire intents', () => {
    expect(resolveNodeCoaching(decisionReq('postAnalysis', 3, false))).toEqual([
      {
        id: 'decision_challenge_result',
        label: 'Challenge this result',
        message: 'Which assumptions could change the comparison between these options?',
        actionType: 'what_would_flip',
      },
      {
        id: 'decision_compare_options',
        label: 'Compare options',
        message: 'Compare the options side by side',
        actionType: 'compare_options',
      },
    ])
  })

  // ─── GoalNode ────────────────────────────────────────────────────────────
  const goalRealGoal: CoachingChip = {
    id: 'goal_is_this_the_real_goal',
    label: 'Is this the real goal?',
    message:
      'Is this goal the outcome we actually want, or a measurable proxy for it? What would we be optimising away if we treated this as the objective?',
    actionType: null,
  }

  it('goal / card → the real-goal question, ungated (its gate was ruled backwards in pristine)', () => {
    expect(
      resolveNodeCoaching({
        kind: 'goal',
        surface: 'card',
        state: { achievementIsCritical: false },
        context: {},
      }),
    ).toEqual([goalRealGoal])
    expect(
      resolveNodeCoaching({
        kind: 'goal',
        surface: 'card',
        state: { achievementIsCritical: true },
        context: {},
      }),
    ).toEqual([goalRealGoal])
  })

  it('goal / threshold cluster / achievement critical → why-so-low THEN target-realistic', () => {
    expect(
      resolveNodeCoaching({
        kind: 'goal',
        surface: 'threshold',
        state: { achievementIsCritical: true },
        context: {},
      }),
    ).toEqual([
      {
        id: 'goal_why_so_low',
        label: 'Why is this so low?',
        message: 'Why is the probability of reaching my goal target so low? What are the main drivers?',
        actionType: 'explain_results',
      },
      {
        id: 'goal_target_realistic',
        label: 'Is my target realistic?',
        message:
          'Is my current goal target realistic given the factors in my model? What would be a more achievable target?',
        actionType: null,
      },
    ])
  })

  it('goal / threshold cluster / NOT critical → target-realistic alone', () => {
    expect(
      resolveNodeCoaching({
        kind: 'goal',
        surface: 'threshold',
        state: { achievementIsCritical: false },
        context: {},
      }),
    ).toEqual([
      {
        id: 'goal_target_realistic',
        label: 'Is my target realistic?',
        message:
          'Is my current goal target realistic given the factors in my model? What would be a more achievable target?',
        actionType: null,
      },
    ])
  })

  // ─── FactorNode ──────────────────────────────────────────────────────────
  const factorReq = (
    state: { needsInput: boolean; isExternalCategory: boolean; isInferred: boolean },
    label = 'Unit cost',
    // ⚠ DEFAULTS TO FALSE ON PURPOSE. Every assertion below was written before
    // the resolver could see the analysis, and `leadsInfluence: false` is the
    // state they were describing — so they keep testing exactly what they were
    // written to test. The new arm has its own spec
    // (`theChipReadsTheAnalysis.spec.ts`); widening these silently would have
    // rewritten a historic guard to agree with a change it never reviewed.
    leadsInfluence = false,
  ): NodeCoachingRequest => ({
    kind: 'factor',
    surface: 'card',
    state: { ...state, leadsInfluence },
    context: { label },
  })

  it('factor / needsInput → help-me-estimate, and it WINS over the other two conditions', () => {
    expect(
      resolveNodeCoaching(factorReq({ needsInput: true, isExternalCategory: true, isInferred: true })),
    ).toEqual([
      {
        id: 'factor_help_estimate',
        label: 'Help me estimate this',
        message: 'Help me estimate a reasonable value for Unit cost',
        actionType: null,
      },
    ])
  })

  it('factor / external → what-if-this-changes, and it WINS over inferred', () => {
    expect(
      resolveNodeCoaching(factorReq({ needsInput: false, isExternalCategory: true, isInferred: true })),
    ).toEqual([
      {
        id: 'factor_what_if_changes',
        label: 'What if this changes?',
        message: 'What if Unit cost changes? How should I plan for that?',
        actionType: null,
      },
    ])
  })

  /**
   * ⚠ THE LABEL IS SHORTER THAN THE QUESTION IT ASKS, DELIBERATELY — pristine
   * FactorNode's own note, measured at 156px inside a 168px card. The label and
   * the message are therefore DIFFERENT strings on purpose, and a fold that
   * "tidied" them into agreement would undo a measured layout decision. Both
   * are pinned, and the curly apostrophe in the label is part of the pin.
   */
  it('factor / inferred → what’s-the-evidence, with the short label and the long message intact', () => {
    expect(
      resolveNodeCoaching(factorReq({ needsInput: false, isExternalCategory: false, isInferred: true })),
    ).toEqual([
      {
        id: 'factor_evidence_supports',
        label: 'What’s the evidence?',
        message: 'What evidence supports my assumption about Unit cost?',
        actionType: null,
      },
    ])
  })

  /**
   * ⭐⭐⭐ THE DELIBERATE SILENCE. Pristine FactorNode: *"A factor with an
   * observed, owned value gets no question, deliberately — there is no
   * assumption to interrogate, and a chip on every card is wallpaper."*
   *
   * This is the single most important case in the file. A resolver that
   * returned a chip here would put one on every factor card, which is the
   * outcome that design explicitly rejects, and every other test above would
   * still pass.
   */
  it('factor / observed and owned → NULL. The silence is the designed behaviour, not an omission', () => {
    expect(
      resolveNodeCoaching(factorReq({ needsInput: false, isExternalCategory: false, isInferred: false })),
    ).toBeNull()
  })

  // ─── OptionNode ──────────────────────────────────────────────────────────
  const optionReq = (
    surface: 'card' | 'cluster',
    state: {
      isPostAnalysis: boolean
      isBaselineOption: boolean
      isRecommended: boolean
      winRateIsKnown: boolean
      closeCallGapIsSet: boolean
    },
    label = 'Build in-house',
  ): NodeCoachingRequest => ({ kind: 'option', surface, state, context: { label } })

  const OPTION_STATE_BASE = {
    isPostAnalysis: true,
    isBaselineOption: false,
    isRecommended: false,
    winRateIsKnown: true,
    closeCallGapIsSet: false,
  }

  it('option / cluster / baseline → why-win-lose THEN risks-of-inaction', () => {
    expect(
      resolveNodeCoaching(optionReq('cluster', { ...OPTION_STATE_BASE, isBaselineOption: true })),
    ).toEqual([
      {
        id: 'option_why_win_lose',
        label: 'Why does this do better or worse on your goal?',
        message:
          'Why does the baseline (Build in-house) do better or worse against my goal than the other options?',
        actionType: 'explain_results',
      },
      {
        id: 'option_risks_of_inaction',
        label: 'Risks of inaction',
        message: 'What are the risks of staying with the baseline?',
        actionType: null,
      },
    ])
  })

  it('option / cluster / recommended → what-would-change, why-lead, counter-case — in that order', () => {
    const out = resolveNodeCoaching(optionReq('cluster', { ...OPTION_STATE_BASE, isRecommended: true }))
    expect(out).toEqual([
      {
        id: 'option_what_would_change',
        label: 'What would change this?',
        message: 'What would need to change for another option to be better supported than Build in-house?',
        actionType: 'what_would_flip',
      },
      {
        id: 'option_why_lead',
        label: 'Why is this best supported?',
        message: 'Why is Build in-house better supported than the other options?',
        actionType: 'explain_results',
      },
      {
        id: 'option_counter_case',
        label: 'What would make this wrong?',
        message:
          'Set aside the numbers for a moment. What would have to be true for Build in-house to be the wrong choice here — what could this model be missing?',
        actionType: null,
      },
    ])
    expectUniqueIds(out!, 'option/cluster/recommended')
  })

  /**
   * ⚠ BASELINE WINS OVER RECOMMENDED, because pristine checked
   * `isBaselineOption` first inside the post-analysis arm. A resolver that
   * checked `isRecommended` first would serve leader copy on the baseline card
   * — and naming a leader the product is not entitled to name is the exact
   * permission seam CLAUDE.md trap 21 records.
   */
  it('option / cluster: baseline is tested BEFORE recommended, so a baseline leader gets baseline copy', () => {
    expect(
      resolveNodeCoaching(
        optionReq('cluster', { ...OPTION_STATE_BASE, isBaselineOption: true, isRecommended: true }),
      )!.map(c => c.id),
    ).toEqual(['option_why_win_lose', 'option_risks_of_inaction'])
  })

  it('option / cluster / non-winner, close call → close-call chip THEN make-lead', () => {
    expect(
      resolveNodeCoaching(optionReq('cluster', { ...OPTION_STATE_BASE, closeCallGapIsSet: true })),
    ).toEqual([
      {
        id: 'option_what_would_change_close_call',
        label: 'What would change this?',
        message: 'What would need to be true for Build in-house to be the better choice?',
        actionType: 'what_would_flip',
      },
      {
        id: 'option_what_would_make_lead',
        label: 'What would make this better supported?',
        message: 'What would need to change for Build in-house to be better supported?',
        actionType: 'what_would_flip',
      },
    ])
  })

  it('option / cluster / non-winner, NOT a close call → make-lead alone', () => {
    expect(
      resolveNodeCoaching(optionReq('cluster', { ...OPTION_STATE_BASE, closeCallGapIsSet: false })),
    ).toEqual([
      {
        id: 'option_what_would_make_lead',
        label: 'What would make this better supported?',
        message: 'What would need to change for Build in-house to be better supported?',
        actionType: 'what_would_flip',
      },
    ])
  })

  /**
   * The producer could not compute a win rate for this option. Pristine
   * returned `null` rather than asking a comparative question the model cannot
   * answer — CLAUDE.md trap 16-inverse: the branch is live but the data cannot
   * reach it honestly.
   */
  it('option / cluster / win rate UNKNOWN → null, no comparative question is invented', () => {
    expect(
      resolveNodeCoaching(optionReq('cluster', { ...OPTION_STATE_BASE, winRateIsKnown: false })),
    ).toBeNull()
  })

  it('option / cluster / PRE-analysis → null; that arm is empty by design, not by omission', () => {
    expect(
      resolveNodeCoaching(optionReq('cluster', { ...OPTION_STATE_BASE, isPostAnalysis: false })),
    ).toBeNull()
  })

  it('option / card / pre-analysis, not baseline → the what-could-go-wrong question', () => {
    expect(
      resolveNodeCoaching(optionReq('card', { ...OPTION_STATE_BASE, isPostAnalysis: false })),
    ).toEqual([
      {
        id: 'option_what_could_go_wrong',
        label: 'What could go wrong?',
        message: 'What could go wrong if we choose Build in-house?',
        actionType: null,
      },
    ])
  })

  /**
   * Two opposite-direction twins for one predicate (trap 22b). Pristine:
   * `if (isPostAnalysis || isBaselineOption) return null`. Asserting only one
   * disjunct would pass against a resolver that dropped the other.
   */
  it('option / card / post-analysis → null (the card is dense once it carries win rates)', () => {
    expect(resolveNodeCoaching(optionReq('card', { ...OPTION_STATE_BASE, isPostAnalysis: true }))).toBeNull()
  })

  it('option / card / baseline → null; "the baseline still gets nothing, unchanged"', () => {
    expect(
      resolveNodeCoaching(
        optionReq('card', { ...OPTION_STATE_BASE, isPostAnalysis: false, isBaselineOption: true }),
      ),
    ).toBeNull()
  })
})

describe('resolveNodeCoaching — structural invariants over the WHOLE request corpus', () => {
  /**
   * ⚠ THIS IS THE COMPLETENESS CHECK THAT IS NOT DERIVED FROM THE TABLE ABOVE
   * (CLAUDE.md trap 12d: a derived guard proves agreement and can never prove
   * completeness). `ALL_COACHING_REQUESTS_FOR_TEST` is the cartesian product of
   * every kind × surface × state combination the resolver admits, generated by
   * the module rather than hand-listed, so these invariants hold over cases I
   * did not think to write a `toEqual` for.
   */
  it('the request corpus is non-empty and covers every kind — a blind corpus certifies nothing', () => {
    expect(ALL_COACHING_REQUESTS_FOR_TEST.length).toBeGreaterThan(30)
    expect(new Set(ALL_COACHING_REQUESTS_FOR_TEST.map(r => r.kind))).toEqual(
      new Set(['risk', 'outcome', 'option', 'factor', 'goal', 'action', 'decision']),
    )
  })

  /**
   * ⭐ ONE SPELLING OF SILENCE. `null` means "deliberately no coaching"; `[]`
   * must never occur. Two representations of nothing would be trap 21 — two
   * questions under one name — and every call site would then need to handle
   * both, which is how one of them eventually gets forgotten.
   */
  it('never returns an empty array: silence is spelled `null` and only `null`', () => {
    for (const request of ALL_COACHING_REQUESTS_FOR_TEST) {
      const out = resolveNodeCoaching(request)
      expect(out === null || out.length > 0, `empty array for ${JSON.stringify(request)}`).toBe(true)
    }
  })

  it('every chip carries a non-empty id, label and message on every reachable request', () => {
    for (const request of ALL_COACHING_REQUESTS_FOR_TEST) {
      for (const chip of resolveNodeCoaching(request) ?? []) {
        expect(chip.id.length, `empty id for ${JSON.stringify(request)}`).toBeGreaterThan(0)
        expect(chip.label.length, `empty label for ${chip.id}`).toBeGreaterThan(0)
        expect(chip.message.length, `empty message for ${chip.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('no chip id is emitted twice within one resolved arm, anywhere in the corpus', () => {
    for (const request of ALL_COACHING_REQUESTS_FOR_TEST) {
      const ids = (resolveNodeCoaching(request) ?? []).map(c => c.id)
      expect(new Set(ids).size, `duplicate id in ${JSON.stringify(request)}: ${ids.join(', ')}`).toBe(ids.length)
    }
  })

  /**
   * A message must never contain an unsubstituted placeholder or the literal
   * `undefined`/`null` — the failure mode of moving template literals between
   * modules. The positive control asserts the detector FIRES, so a negative
   * result is evidence rather than a regex that matches nothing (trap 13).
   */
  it('no resolved message leaks a placeholder or a stringified nullish — with a positive control', () => {
    const leaks = (s: string) => /\$\{|undefined|\bnull\b/.test(s)
    expect(leaks('value for ${label}'), 'positive control: detector must fire').toBe(true)
    expect(leaks('What if Unit cost changes?'), 'negative control: detector must not fire').toBe(false)
    for (const request of ALL_COACHING_REQUESTS_FOR_TEST) {
      for (const chip of resolveNodeCoaching(request) ?? []) {
        expect(leaks(chip.message), `${chip.id} leaked in ${JSON.stringify(request)}: ${chip.message}`).toBe(false)
      }
    }
  })

  /**
   * ⭐⭐ NO THRESHOLD, NO MAGNITUDE INTERPRETATION — asserted against the SOURCE,
   * because this is a claim about what the module may ever do, not about what
   * this corpus happens to exercise.
   *
   * FactorNode's docblock rules on it: *"THE CONDITIONS ARE PRODUCER FIELDS
   * COMPARED BY IDENTITY … No threshold is chosen and no number is
   * interpreted."* Every state field the resolver reads is a producer boolean,
   * so a numeric comparison appearing here would mean the canvas had begun
   * inventing a judgement the producer never made. The pluralisation test
   * (`optionCount === 1`) is a COUNT of observable objects, not a magnitude
   * judgement, and is allowed for explicitly by name.
   *
   * ⚠ TWO CONSTRUCTS ARE ALLOWED, BY NAME AND WITH REASONS, rather than by
   * loosening the detector until it passes:
   *   · `chips.length > 0` in `orNull` — collection emptiness, so silence gets
   *     exactly one spelling. It reads no producer value.
   *   · `optionCount === 1` — pluralising a COUNT of objects on the board.
   *     DecisionNode's ruling: *"Counting only, never assessing."*
   * A THIRD hit reds, and the failure message names it. That is the point: this
   * test exists so a cut-off cannot arrive quietly in a later edit.
   *
   * ⚠ Comments are stripped first, because the claim is about CODE — the
   * docblocks quote measurements like "156px inside a 168px card" and a
   * detector that read prose would be measuring the wrong bytes (CLAUDE.md
   * trap 22: verify what string the guard actually receives).
   *
   * ⚠ The detector carries a positive control AND a negative control, or it
   * would pass against a regex that matches nothing.
   */
  it('the resolver source introduces no threshold — allowlist of two, with controls', () => {
    const source = readFileSync(resolve(__dirname, '../resolveNodeCoaching.ts'), 'utf8')
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

    const comparison = /(?:[<>]=?|={2,3}|!==?)\s*-?\d+(?:\.\d+)?|\b\d+(?:\.\d+)?\s*(?:[<>]=?|={2,3})/g
    expect('if (leader > 0.35) {'.match(comparison), 'positive control: detector must fire').not.toBeNull()
    expect('const a = fn(b)'.match(comparison), 'negative control: detector must not fire').toBeNull()

    const hits = (code.match(comparison) ?? []).map(h => h.trim())
    const ALLOWED = ['> 0', '=== 1']
    const unexpected = hits.filter(h => !ALLOWED.includes(h))
    expect(
      unexpected,
      `threshold-shaped comparison(s) in the resolver beyond the documented allowlist: ${unexpected.join(', ')}`,
    ).toEqual([])
    // The allowlist must not rot into a licence: both entries must still be present.
    expect(hits, 'the two allowed constructs must still exist, or this allowlist is stale').toEqual(
      expect.arrayContaining(ALLOWED),
    )
  })
})
