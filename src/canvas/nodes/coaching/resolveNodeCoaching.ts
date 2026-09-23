/**
 * ⭐⭐⭐ ONE RESOLVER FOR "WHAT SHOULD THIS CARD ASK THIS USER RIGHT NOW".
 *
 * `NodeChip` is shared. The DECISION of what it says was not: it was authored
 * inline at 31 JSX sites across seven node files, in 15 separate `useMemo`
 * blocks. This module is that decision, resolved once.
 *
 * ── WHAT THE SCATTER ACTUALLY COST ─────────────────────────────────────────
 *
 * Not tidiness. Three founder-visible symptoms, and each is a direct
 * consequence of the decision having no single home:
 *
 *  1. IDENTICAL CHIPS ON EVERY RISK CARD. `riskPopoverChips` and `riskChips`
 *     held byte-identical copies of `risk_what_reduces` and
 *     `risk_add_mitigation`, and neither consulted anything about the
 *     individual risk — so five risks in five different states asked the same
 *     two questions. The duplication is now one entry per surface reading one
 *     state, so a divergence between surfaces has to be written on purpose.
 *  2. PROMPTS THAT IGNORE NODE STATE. A block that authors its copy inline has
 *     to remember to gate it. Here the gate is the function signature: a
 *     surface cannot be resolved without passing the state it depends on.
 *  3. WORDING DRIFT BETWEEN SURFACES FOR ONE NODE. Two surfaces reading two
 *     hand-written copies of one sentence is the hand-maintained mirror
 *     (CLAUDE.md trap 12), and it drifts silently because nothing compares
 *     them. There is now one string per chip id.
 *
 * ── WHAT THIS MODULE IS NOT ────────────────────────────────────────────────
 *
 * ⛔ IT IS NOT A NORMALISER, AND SEVERAL DELIBERATE ASYMMETRIES ARE PRESERVED
 * EXACTLY. Folding is not the same as harmonising, and each of the following
 * was ruled on in its own docblock in the file it came from. They are preserved
 * here with their reasons, because the next reader's instinct will be to make
 * them consistent:
 *
 *  · A FACTOR WITH AN OBSERVED, OWNED VALUE GETS NOTHING. `null`, not a chip:
 *    *"there is no assumption to interrogate, and a chip on every card is
 *    wallpaper."* A resolver that answered every request would put a chip on
 *    every card, which is the outcome that design rejects.
 *  · `risk_leading_indicator` IS PHASE-INDEPENDENT AND SURVIVES A SIZED RISK.
 *    RiskNode: *"ADDED, NOT SWAPPED … swapping on this predicate would delete
 *    that question from every risk on every shipped starter — reversing a
 *    settled ruling by side effect."*
 *  · RISK'S CARD ORDER IS NOT ITS DETAILED ORDER. The promoted question leads
 *    on the face and trails inline. Two surfaces, two orders, on purpose.
 *  · `option_what_would_change` ASKS ABOUT THE ALTERNATIVE, NEVER CROWNS THE
 *    LEADER. OptionNode: the message *"is sent as the USER'S OWN message"*, so
 *    a crowning claim here would be put in the user's mouth.
 *  · BASELINE IS TESTED BEFORE RECOMMENDED. A baseline that also leads gets
 *    baseline copy, because naming a leader the product may not name is the
 *    permission seam CLAUDE.md trap 21 records.
 *  · FACTOR'S `factor_evidence_supports` LABEL IS SHORTER THAN ITS MESSAGE.
 *    Measured: *"156px inside a 168px card — the longest chip label on the
 *    canvas."* The label is the affordance, the message is the ask. Making them
 *    agree would undo a measured layout decision.
 *
 * ⛔ IT IS NOT A HOME FOR RUN AFFORDANCES. `goal_run_analysis` and
 * `decision_run_analysis` stay in their node bodies. Both files classify them
 * as primary ACTION buttons rather than coaching — GoalNode: *"This stays in
 * the body because it's a primary action button rather than coaching"* — and
 * they carry `actionType: 'run_analysis'`, which `NodeChip` routes through
 * `canonicalRunRegistry` rather than the coaching dispatcher. They answer a
 * different question, so they are named apart rather than collapsed.
 *
 * ── THE CONDITIONS ARE PRODUCER FIELDS COMPARED BY IDENTITY ────────────────
 *
 * ⚠ Inherited verbatim from FactorNode's ruling, and it governs this whole
 * module: *"THE CONDITIONS ARE PRODUCER FIELDS COMPARED BY IDENTITY —
 * `needsInput`, `category === 'external'`, `extractionType === 'inferred'`. No
 * threshold is chosen and no number is interpreted."*
 *
 * Every field in every `state` below is a producer boolean or a presence check
 * the caller performed (`winRate !== null`, `closeCallGapPp != null`). This
 * module chooses no cut-off and reads no magnitude. `optionCount` is a COUNT of
 * objects on the board, used only to pluralise a sentence — observable, never
 * assessed. `resolveNodeCoaching.parity.spec.ts` asserts against this file's
 * source that no numeric comparison exists here, so a threshold cannot arrive
 * quietly in a later edit.
 *
 * ── SILENCE HAS EXACTLY ONE SPELLING ───────────────────────────────────────
 *
 * `null` means "this kind, on this surface, in this state, deliberately asks
 * nothing". The resolver NEVER returns `[]`. Two representations of nothing
 * would be two questions under one name (trap 21), and every call site would
 * then have to handle both — which is how one of them eventually gets
 * forgotten. The parity spec asserts this over the whole generated request
 * corpus, not over the cases anyone remembered to write.
 */
import type { ActionTypeLiteral } from '@talchain/schemas/boundary'
import type { PendingWireActionType } from '../../conversation/chipMeta'

/** Wire intent, matching `NodeChip`'s prop contract exactly. */
export type CoachingActionType = ActionTypeLiteral | PendingWireActionType | null

/**
 * One resolved coaching chip.
 *
 * All four fields are user-reachable, which is why the parity spec pins the
 * whole object rather than the label: `label` is painted, `message` is sent as
 * the user's own turn, `id` ships as `chip.parameters.chip_id`, and
 * `actionType` decides which dispatch path `NodeChip` takes.
 */
export interface CoachingChip {
  readonly id: string
  readonly label: string
  readonly message: string
  readonly actionType: CoachingActionType
}

/** `null` is the single spelling of deliberate silence. Never `[]`. */
export type ResolvedCoaching = readonly CoachingChip[] | null

export type NodeCoachingRequest =
  | {
      kind: 'risk'
      /** `card` = face, `popover` = Standard hover, `detailed` = Detailed inline. */
      surface: 'card' | 'popover' | 'detailed'
      state: { exposureUnstated: boolean }
      context: { label: string; riskContext: string }
    }
  | {
      kind: 'outcome'
      /** `validate` is the assumption chip inside the post-analysis layer-2 block. */
      surface: 'card' | 'popover' | 'detailed' | 'validate'
      state: { isPostAnalysis: boolean }
      context: { label: string; outcomeContext: string; validateQuestion?: string }
    }
  | {
      kind: 'action'
      surface: 'card'
      state: Record<string, never>
      context: { label: string }
    }
  | {
      kind: 'decision'
      surface: 'preAnalysis' | 'postAnalysis'
      state: { showRunAnalysis: boolean }
      context: { optionCount: number }
    }
  | {
      kind: 'goal'
      /** `threshold` is the `hasThreshold` layer-2 cluster; `card` is the face. */
      surface: 'card' | 'threshold'
      state: { achievementIsCritical: boolean }
      context: Record<string, never>
    }
  | {
      kind: 'factor'
      surface: 'card'
      state: {
        needsInput: boolean
        isExternalCategory: boolean
        isInferred: boolean
        /**
         * ⭐⭐ THE ONLY ANALYSIS FACT THIS RESOLVER HAS EVER BEEN GIVEN, and the
         * reason this field exists.
         *
         * Measured on deployed `b6673341`: 23 chips across 16 of 19 nodes, 12
         * distinct strings, keyed on node KIND plus "does a scalar value
         * exist" — nothing else. `fac_eng_capacity` is the most influential
         * factor in the model AND an unconfirmed estimate, and it drew the
         * IDENTICAL chip to `fac_build_indicator` at 5% influence. The science
         * was computed and the coaching could not see it: every other request
         * variant here carries post-analysis state (`option` has four such
         * fields), and `factor` — the kind that CARRIES the influence ranking —
         * carried none.
         *
         * ⚠ IT IS A BOOLEAN, NOT A RANK, DELIBERATELY. `influenceScaleCopy.ts`
         * forbids minting a rival rank notion, caps badged ranks at 3 and
         * withholds entirely on ties. The caller derives this from the LICENSED
         * readout (`influenceRankReadout(...) !== null`) AND the raw
         * `sensitivityRank === 1`, so a withheld readout collapses to `false`
         * and this chip simply does not fire. The licence stays where it is
         * owned; no threshold is re-decided here.
         */
        leadsInfluence: boolean
      }
      context: {
        label: string
        /**
         * The licensed readout's OWN `phrase`, quoted verbatim into the message
         * so the rank is stated by its single owner. Re-wording it here ("more
         * influential than any other factor") would be a second vocabulary for
         * one fact — the estate's trap 12 (a hand-maintained mirror) in prose.
         */
        influencePhrase?: string
      }
    }
  | {
      kind: 'option'
      /** `card` = the face question; `cluster` = the popover/Detailed chip group. */
      surface: 'card' | 'cluster'
      state: {
        isPostAnalysis: boolean
        isBaselineOption: boolean
        isRecommended: boolean
        /** The caller's `displayMetadata.winRate !== null` — presence, not magnitude. */
        winRateIsKnown: boolean
        /** The caller's `closeCallGapPp != null` — presence, not magnitude. */
        closeCallGapIsSet: boolean
      }
      context: { label: string }
    }

/** Drops the empty case to `null`, so silence has one spelling at every return. */
const orNull = (chips: readonly CoachingChip[]): ResolvedCoaching => (chips.length > 0 ? chips : null)

// ─── Risk ───────────────────────────────────────────────────────────────────

const riskChip = {
  leadingIndicator: (label: string, ctx: string): CoachingChip => ({
    id: 'risk_leading_indicator',
    label: 'What would we see first?',
    message: `What early signs or leading indicators would tell us ${label} is starting to happen, and what should trigger a response?${ctx}`,
    actionType: null,
  }),
  sizeExposure: (label: string, ctx: string): CoachingChip => ({
    id: 'risk_size_exposure',
    label: 'How likely is this?',
    message: `How likely is ${label}, and how serious would it be if it happened? Help me put a first estimate on both, and tell me what I would need to know to sharpen them.${ctx}`,
    actionType: null,
  }),
  whatReduces: (label: string, ctx: string): CoachingChip => ({
    id: 'risk_what_reduces',
    label: 'What reduces this?',
    message: `What factors or actions could reduce ${label}?${ctx}`,
    actionType: null,
  }),
  addMitigation: (label: string, ctx: string): CoachingChip => ({
    id: 'risk_add_mitigation',
    label: 'Explore mitigation',
    message: `Suggest a mitigation strategy for ${label}, and explain what it would change.${ctx}`,
    actionType: null,
  }),
}

const resolveRisk = (r: Extract<NodeCoachingRequest, { kind: 'risk' }>): ResolvedCoaching => {
  const label = r.context.label || 'this risk'
  const ctx = r.context.riskContext
  switch (r.surface) {
    case 'card':
      // ⚠ The leading-indicator question is UNGATED here, deliberately: it is
      // added to an unsized risk's chip row, never swapped for it.
      return orNull([
        riskChip.leadingIndicator(label, ctx),
        ...(r.state.exposureUnstated ? [riskChip.sizeExposure(label, ctx)] : []),
      ])
    case 'popover':
      // ⭐ ED 02:31Z (D4): "How likely is this?" is NOT deleted when the card's
      // face becomes one coaching icon (which asks the leading-indicator
      // question). It moves to Detailed and here, so an unsized risk keeps a
      // route to sizing it on every surface.
      return orNull([
        ...(r.state.exposureUnstated ? [riskChip.sizeExposure(label, ctx)] : []),
        riskChip.whatReduces(label, ctx),
        riskChip.addMitigation(label, ctx),
      ])
    case 'detailed':
      // The promoted face question trails inline, where it led on the face.
      return orNull([
        ...(r.state.exposureUnstated ? [riskChip.sizeExposure(label, ctx)] : []),
        riskChip.whatReduces(label, ctx),
        riskChip.addMitigation(label, ctx),
        riskChip.leadingIndicator(label, ctx),
      ])
  }
}

// ─── Outcome ────────────────────────────────────────────────────────────────

const outcomeChip = {
  falsify: (label: string, ctx: string): CoachingChip => ({
    id: 'outcome_what_would_falsify',
    label: 'What would falsify this?',
    message: `What evidence or result would show that ${label} will NOT happen? What would have to be true for it to fail?${ctx}`,
    actionType: null,
  }),
  consequences: (label: string, ctx: string): CoachingChip => ({
    id: 'outcome_explore_consequences',
    label: 'Explore consequences',
    message: `What would ${label} mean for this model, including possible benefits and downsides?${ctx}`,
    actionType: null,
  }),
  strengthens: (label: string, ctx: string): CoachingChip => ({
    id: 'outcome_what_strengthens',
    label: 'What affects this?',
    message: `Which upstream factors affect ${label}, and how could we strengthen its beneficial effects or limit its downsides?${ctx}`,
    actionType: null,
  }),
  validateAssumption: (question: string): CoachingChip => ({
    id: 'outcome_validate_assumption',
    label: 'Validate this assumption',
    message: question,
    actionType: null,
  }),
}

const resolveOutcome = (r: Extract<NodeCoachingRequest, { kind: 'outcome' }>): ResolvedCoaching => {
  const label = r.context.label || 'this outcome'
  const ctx = r.context.outcomeContext
  const preAnalysisOnly = r.state.isPostAnalysis ? [] : [outcomeChip.strengthens(label, ctx)]
  switch (r.surface) {
    case 'card':
      // Survives the run: an outcome is worth falsifying most once the model
      // has produced a number for it.
      return orNull([outcomeChip.falsify(label, ctx)])
    case 'popover':
      return orNull([outcomeChip.consequences(label, ctx), ...preAnalysisOnly])
    case 'detailed':
      return orNull([outcomeChip.consequences(label, ctx), ...preAnalysisOnly, outcomeChip.falsify(label, ctx)])
    case 'validate':
      // ⚠ The question is DERIVED BY THE CALLER from the inbound edge, never
      // composed here. No derived question means no chip — this resolver must
      // not invent an assumption nobody identified.
      return orNull(
        r.context.validateQuestion ? [outcomeChip.validateAssumption(r.context.validateQuestion)] : [],
      )
  }
}

// ─── Action ─────────────────────────────────────────────────────────────────

const resolveAction = (r: Extract<NodeCoachingRequest, { kind: 'action' }>): ResolvedCoaching => {
  const label = r.context.label || 'this action'
  // Assumption-surfacing rather than evaluative: an action's honest weak point
  // is its preconditions, and this kind carries no number to challenge.
  // `actionType` is null because the schemas `ActionType` enum has no honest
  // value for an assumption-surfacing prompt.
  return orNull([
    {
      id: 'action_what_must_be_true',
      label: 'What has to be true?',
      message: `What has to be true for ${label} to work, and how would we know if it were not?`,
      actionType: null,
    },
  ])
}

// ─── Decision ───────────────────────────────────────────────────────────────

const resolveDecision = (r: Extract<NodeCoachingRequest, { kind: 'decision' }>): ResolvedCoaching => {
  if (r.surface === 'postAnalysis') {
    return orNull([
      {
        id: 'decision_challenge_result',
        // ⚠ Comparative, with NO goal premise: `what_would_flip` asks what
        // would change the ORDER of the options. Fusing that with target
        // attainment is the conflation Paul has ruled on repeatedly.
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
  }
  // ⚠ COUNTING ONLY, NEVER ASSESSING. The pristine sentence hardcoded "a third
  // option" on every model — with one option it asked for a third that would be
  // the second. How many options exist is observable; "your options are too
  // similar" would be a claim about the user's reasoning and belongs to the
  // producer.
  const { optionCount } = r.context
  return orNull([
    {
      id: 'decision_explore_more_options',
      label: 'Explore more options',
      message:
        `My model has ${optionCount} option${optionCount === 1 ? '' : 's'} so far.` +
        ' What other options could answer this decision that I have not put on the board?',
      actionType: null,
    },
    ...(r.state.showRunAnalysis
      ? []
      : [
          {
            id: 'decision_what_could_go_wrong',
            label: 'What could go wrong?',
            message: 'What could go wrong with this decision?',
            actionType: null,
          } as const,
        ]),
  ])
}

// ─── Goal ───────────────────────────────────────────────────────────────────

const resolveGoal = (r: Extract<NodeCoachingRequest, { kind: 'goal' }>): ResolvedCoaching => {
  if (r.surface === 'card') {
    // ⚠ UNGATED ON A TARGET, deliberately. This question was previously inside
    // `hasThreshold`, so it became reachable only once a numeric target was
    // committed — exactly when it was least useful, since by then the proxy is
    // already load-bearing and everything downstream has been optimised
    // against it.
    return orNull([
      {
        id: 'goal_is_this_the_real_goal',
        label: 'Is this the real goal?',
        message:
          'Is this goal the outcome we actually want, or a measurable proxy for it? What would we be optimising away if we treated this as the objective?',
        actionType: null,
      },
    ])
  }
  // The `hasThreshold` cluster. "Why is this so low?" interrogates the NUMBER,
  // so it fires only when the producer reports the achievement as critical;
  // "Is my target realistic?" applies to every goal that has a threshold.
  return orNull([
    ...(r.state.achievementIsCritical
      ? [
          {
            id: 'goal_why_so_low',
            label: 'Why is this so low?',
            message: 'Why is the probability of reaching my goal target so low? What are the main drivers?',
            actionType: 'explain_results',
          } as const,
        ]
      : []),
    {
      id: 'goal_target_realistic',
      label: 'Is my target realistic?',
      message:
        'Is my current goal target realistic given the factors in my model? What would be a more achievable target?',
      actionType: null,
    },
  ])
}

// ─── Factor ─────────────────────────────────────────────────────────────────

const resolveFactor = (r: Extract<NodeCoachingRequest, { kind: 'factor' }>): ResolvedCoaching => {
  const { label } = r.context
  // The card asks a different question depending on WHAT KIND OF THING the
  // producer says this value is. Three producer fields, compared by identity,
  // in this precedence order.
  if (r.state.needsInput) {
    return [
      {
        id: 'factor_help_estimate',
        label: 'Help me estimate this',
        message: `Help me estimate a reasonable value for ${label}`,
        actionType: null,
      },
    ]
  }
  if (r.state.isExternalCategory) {
    return [
      {
        id: 'factor_what_if_changes',
        label: 'What if this changes?',
        message: `What if ${label} changes? How should I plan for that?`,
        actionType: null,
      },
    ]
  }
  // ⭐⭐⭐ THE SAME POPULATION AS THE CHIP BELOW, ASKED A SHARPER QUESTION.
  //
  // This arm NEVER displaces `needsInput` or `isExternalCategory` — it only
  // ever refines the generic evidence chip, so the change is bounded to one
  // pre-existing branch. A factor that is BOTH the model's top influence AND an
  // unconfirmed estimate is the highest-value thing a reader can act on: the
  // number that moves the answer most is the one nobody has confirmed.
  //
  // ⚠ Both conjuncts are load-bearing and each is someone else's fact. Drop
  // `isInferred` and this fires on a confirmed value, where there is nothing to
  // confirm. Drop `leadsInfluence` and it is the wallpaper chip again.
  if (r.state.isInferred && r.state.leadsInfluence) {
    return [
      {
        id: 'factor_confirm_top_influence',
        // ⚠ SHORT FOR THE SAME REASON AS THE CHIP BELOW — the caption column is
        // content-sized on a 168px card, which is why "What evidence supports
        // this?" was already cut to "What’s the evidence?". The MESSAGE carries
        // the ask; the chip is only the affordance.
        label: 'Confirm this first?',
        message:
          (r.context.influencePhrase ? `${r.context.influencePhrase} — and ` : '') +
          `${label}'s value is still an unconfirmed estimate. What would it take to confirm it?`,
        actionType: null,
      },
    ]
  }
  if (r.state.isInferred) {
    return [
      {
        id: 'factor_evidence_supports',
        // ⚠ THE LABEL IS SHORTER THAN THE QUESTION IT ASKS, DELIBERATELY.
        // "What evidence supports this?" measured 156px inside a 168px card.
        // The chip is the affordance; the MESSAGE is the ask, and it is
        // unchanged, so Olumi receives the same question it always did.
        label: 'What’s the evidence?',
        message: `What evidence supports my assumption about ${label}?`,
        actionType: null,
      },
    ]
  }
  // ⭐⭐⭐ THE DELIBERATE SILENCE, and the reason this resolver returns a
  // nullable type at all: a factor with an observed, owned value gets no
  // question, because there is no assumption to interrogate and a chip on
  // every card is wallpaper.
  return null
}

// ─── Option ─────────────────────────────────────────────────────────────────

const resolveOption = (r: Extract<NodeCoachingRequest, { kind: 'option' }>): ResolvedCoaching => {
  const label = r.context.label
  const { isPostAnalysis, isBaselineOption, isRecommended, winRateIsKnown, closeCallGapIsSet } = r.state

  if (r.surface === 'card') {
    // ⚠ PRE-ANALYSIS ONLY, AND NARROWER THAN FACTOR'S. Post-analysis this card
    // carries win rates, goal-fit, deltas and up to three cluster chips, so the
    // popover is the right home for that cluster. Before a run the card is
    // sparse and the reader is AUTHORING — when a question is worth most.
    // ⛔ THE BASELINE STILL GETS NOTHING: "what could go wrong if we choose
    // staying as we are" is a question about a choice nobody is proposing.
    if (isPostAnalysis || isBaselineOption) return null
    return [
      {
        id: 'option_what_could_go_wrong',
        label: 'What could go wrong?',
        message: `What could go wrong if we choose ${label}?`,
        actionType: null,
      },
    ]
  }

  // ⭐ PRE-ANALYSIS IS EMPTY BY DESIGN, NOT BY OMISSION. Its one chip was
  // promoted to the card face; returning it here too rendered the same chip
  // twice on one card, which CI caught with `getMultipleElementsFoundError`.
  // "Exactly once" is structural: the `card` surface is the only render site.
  if (!isPostAnalysis) return null

  // ⚠ BASELINE IS TESTED FIRST. A baseline that also leads gets baseline copy —
  // reusing the single leader authority rather than minting a second reader of
  // the same question (CLAUDE.md trap 21).
  if (isBaselineOption) {
    return [
      {
        id: 'option_why_win_lose',
        label: 'Why does this do better or worse on your goal?',
        message: `Why does the baseline (${label}) do better or worse against my goal than the other options?`,
        actionType: 'explain_results',
      },
      {
        id: 'option_risks_of_inaction',
        label: 'Risks of inaction',
        message: 'What are the risks of staying with the baseline?',
        actionType: null,
      },
    ]
  }

  if (isRecommended) {
    return [
      {
        id: 'option_what_would_change',
        // ⚠ CONTRASTIVE, NOT A VERDICT. This message lands in the user's OWN
        // transcript, so asking about the ALTERNATIVE keeps the whole
        // what_would_flip question while presupposing nothing about the leader.
        label: 'What would change this?',
        message: `What would need to change for another option to be better supported than ${label}?`,
        actionType: 'what_would_flip',
      },
      {
        id: 'option_why_lead',
        label: 'Why is this best supported?',
        message: `Why is ${label} better supported than the other options?`,
        actionType: 'explain_results',
      },
      {
        id: 'option_counter_case',
        // ⭐ A pre-mortem, not a sensitivity sweep. The two chips above
        // interrogate the model's arithmetic; this one asks what the model
        // might be MISSING. It asserts nothing, so it needs no producer.
        label: 'What would make this wrong?',
        message: `Set aside the numbers for a moment. What would have to be true for ${label} to be the wrong choice here — what could this model be missing?`,
        actionType: null,
      },
    ]
  }

  // Non-winner, non-baseline. ⚠ `winRateIsKnown` is the caller's
  // `winRate !== null` — a presence check, never a magnitude. Where the
  // producer could not compute a win rate, no comparative question is asked.
  if (!winRateIsKnown) return null
  return [
    ...(closeCallGapIsSet
      ? [
          {
            id: 'option_what_would_change_close_call',
            label: 'What would change this?',
            message: `What would need to be true for ${label} to be the better choice?`,
            actionType: 'what_would_flip',
          } as const,
        ]
      : []),
    {
      id: 'option_what_would_make_lead',
      label: 'What would make this better supported?',
      message: `What would need to change for ${label} to be better supported?`,
      actionType: 'what_would_flip',
    },
  ]
}

/**
 * Resolve the coaching a node kind offers on a surface, in a state.
 *
 * Returns the chips in RENDER ORDER, or `null` when this kind deliberately asks
 * nothing here. Never returns an empty array.
 */
export function resolveNodeCoaching(request: NodeCoachingRequest): ResolvedCoaching {
  switch (request.kind) {
    case 'risk':
      return resolveRisk(request)
    case 'outcome':
      return resolveOutcome(request)
    case 'action':
      return resolveAction(request)
    case 'decision':
      return resolveDecision(request)
    case 'goal':
      return resolveGoal(request)
    case 'factor':
      return resolveFactor(request)
    case 'option':
      return resolveOption(request)
  }
}

/**
 * ⚠ EVERY REQUEST THE RESOLVER ADMITS, GENERATED RATHER THAN HAND-LISTED.
 *
 * Exported for the parity spec's structural invariants. A hand-written list
 * would share the resolver's blind spots by construction (CLAUDE.md trap 12d:
 * a derived guard proves agreement and can never prove completeness), so this
 * is the cartesian product of every surface × every boolean state field. It
 * exists so the invariants — silence is always `null`, no message leaks a
 * placeholder, no arm emits a duplicate id — hold over cases nobody wrote a
 * `toEqual` for.
 *
 * It is test-only scaffolding and is not consumed by any node component.
 */
export const ALL_COACHING_REQUESTS_FOR_TEST: readonly NodeCoachingRequest[] = (() => {
  const bools = [true, false]
  const out: NodeCoachingRequest[] = []

  for (const surface of ['card', 'popover', 'detailed'] as const)
    for (const exposureUnstated of bools)
      out.push({
        kind: 'risk',
        surface,
        state: { exposureUnstated },
        context: { label: 'A risk', riskContext: ' [ctx]' },
      })

  for (const surface of ['card', 'popover', 'detailed', 'validate'] as const)
    for (const isPostAnalysis of bools)
      for (const withQuestion of bools)
        out.push({
          kind: 'outcome',
          surface,
          state: { isPostAnalysis },
          context: {
            label: 'An outcome',
            outcomeContext: ' [ctx]',
            ...(withQuestion ? { validateQuestion: 'Does this hold?' } : {}),
          },
        })

  out.push({ kind: 'action', surface: 'card', state: {}, context: { label: 'An action' } })

  for (const surface of ['preAnalysis', 'postAnalysis'] as const)
    for (const showRunAnalysis of bools)
      for (const optionCount of [0, 1, 3])
        out.push({ kind: 'decision', surface, state: { showRunAnalysis }, context: { optionCount } })

  for (const surface of ['card', 'threshold'] as const)
    for (const achievementIsCritical of bools)
      out.push({ kind: 'goal', surface, state: { achievementIsCritical }, context: {} })

  for (const needsInput of bools)
    for (const isExternalCategory of bools)
      for (const isInferred of bools)
        // The new analysis axis is enumerated like every other one, so the
        // parity guard covers the `factor_confirm_top_influence` arm rather
        // than only the three that predate it.
        for (const leadsInfluence of bools)
          out.push({
            kind: 'factor',
            surface: 'card',
            state: { needsInput, isExternalCategory, isInferred, leadsInfluence },
            context: { label: 'A factor', influencePhrase: 'Most influential of 8 factors compared in this model' },
          })

  for (const surface of ['card', 'cluster'] as const)
    for (const isPostAnalysis of bools)
      for (const isBaselineOption of bools)
        for (const isRecommended of bools)
          for (const winRateIsKnown of bools)
            for (const closeCallGapIsSet of bools)
              out.push({
                kind: 'option',
                surface,
                state: { isPostAnalysis, isBaselineOption, isRecommended, winRateIsKnown, closeCallGapIsSet },
                context: { label: 'An option' },
              })

  return out
})()
