/**
 * groupActions — THE ONE table of Model-tab affordances that terminate in a
 * conversation, rehomed onto the canonical outline (18 Aug 2026).
 *
 * ⚠ EVERY MESSAGE STRING HERE IS VERBATIM FROM THE v1 SITE NAMED IN
 * `rehomedFrom`. Nothing is paraphrased and nothing is invented. A rehome that
 * rewrote the turn text would change what Olumi is asked while claiming to move
 * a capability, and the difference would be invisible in review.
 *
 * ── WHY A TABLE AND NOT TEN BUTTONS ───────────────────────────────────────
 *
 * The v1 stack spread these across six components and eleven call sites, two of
 * which ("Explore other strategies", `OptionsSection.tsx:486` and `:508`) were
 * the SAME action under ONE testid on mutually exclusive branches — so the
 * duplication was already invisible to a testid-based check. One table keyed by
 * group is the single authority: `Record<ModelGroupId, …>` is TOTAL, so a new
 * group is a type error rather than a group that silently offers nothing.
 *
 * ── THE SEVENTH CAPABILITY (a finding, not part of the commissioned six) ──
 *
 * The founder's ruling named six unique old-editor capabilities. Deriving the
 * set at `9ff14c19` turned up a SEVENTH with no equivalent in the outline:
 * `RisksSection.tsx:100` — a structural affordance for the RISK entity class,
 * exactly parallel to "Add a factor" and "Add a relationship". It is rehomed
 * here as `risks-add`.
 *
 * ⚠ AND ITS REACH CHANGES, DELIBERATELY. In v1 that button renders ONLY inside
 * the empty-state branch (`riskNodes.length === 0`), so a user who already has
 * one risk cannot ask for another. On the outline it is a group action like the
 * others. That is a reach INCREASE, stated here so review can see it rather
 * than discover it: an outline whose "add" affordance disappears once the group
 * is non-empty would be the undiscoverability defect this surface replaced.
 *
 * ── WHAT IS NOT HERE, AND WHY ─────────────────────────────────────────────
 *
 * `OptionsSection.tsx:472` ("Map interventions") is NOT rehomed. It is an
 * adjudicated CUT — design §7.0 items 2 and 10 — because it names a gap and
 * offers no way to close it; its replacement is the option-value edit path, not
 * another chat hand-off. Recorded here so its absence reads as a decision.
 */

import type { ModelGroupId } from './types'

/**
 * What a message may interpolate.
 *
 * ⚠ SOURCED FROM THE OUTLINE ROW THE USER IS LOOKING AT, never from a second
 * read of the store. The goal hand-off quotes the target back to the user, and
 * quoting a number the screen does not show would be a claim about the model
 * that the model's own rendered state contradicts (preamble P5).
 */
export interface GroupActionContext {
  /** The goal row's label, or `null` when the model has no goal row. */
  goalLabel: string | null
  /** The goal row's DISPLAYED target — exactly what the outline shows. */
  goalTarget: string | null
}

/**
 * `structural` changes the shape of the model (adds an element, explores new
 * options); `discuss` asks about what is already there.
 *
 * The distinction is not decoration: the structural ones are the affordances
 * whose dead-endedness was the measured mechanism behind "I don't feel like I
 * can actually directly edit the model", so they render first and with emphasis.
 */
export type GroupActionIntent = 'structural' | 'discuss'

export interface GroupAction {
  /** Stable id — the testid suffix. NEVER derived from the label (trap 19). */
  id: string
  /** Sentence-case British English, as shown to the user. */
  label: string
  intent: GroupActionIntent
  /** The turn text. Verbatim from `rehomedFrom`. */
  message: (ctx: GroupActionContext) => string
  /**
   * `file:line` of the v1 control this replaces.
   *
   * ⚠ THIS IS THE DELETE STEP'S CHECKLIST, not a comment. The removal of the v1
   * stack is reviewable only if every deleted affordance has a named successor;
   * a rehome that cannot say what it replaced cannot prove it replaced anything.
   */
  rehomedFrom: string
}

const DISCUSS_GOAL: GroupAction = {
  id: 'goal-discuss',
  label: 'Discuss the goal with Olumi',
  intent: 'discuss',
  /**
   * ⚠ A FALLBACK IS NEVER QUOTED AS THE USER'S OWN WORDS. This composed
   * "Help me understand my goal 'not set' and whether the target of not set is
   * appropriate" — which tells Olumi the goal IS the string "not set", and
   * starts a different conversation from the one the user asked for. The
   * panel's rule about not printing a placeholder as a name applies to what we
   * SEND as much as to what we draw: the message is user-facing the moment it
   * lands in the chat.
   *
   * Four states, each said plainly, because a single template cannot be true of
   * all four.
   */
  message: ctx => {
    const goal = ctx.goalLabel?.trim()
    const target = ctx.goalTarget?.trim()
    if (goal && target) {
      return `Help me understand my goal '${goal}' and whether the target of ${target} is appropriate`
    }
    if (goal) {
      return `Help me understand my goal '${goal}'. I have not set a target for it yet — help me work out what it should be.`
    }
    if (target) {
      return `I have a target of ${target} but I have not written my goal yet. Help me work out what I am actually trying to achieve.`
    }
    return 'I have not written my goal or its target yet. Help me work out what I am actually trying to achieve, and how I would know I had got there.'
  },
  rehomedFrom: 'model-tab/GoalSection.tsx:243',
}

const EXPLORE_STRATEGIES: GroupAction = {
  id: 'options-explore',
  label: 'Explore other strategies',
  intent: 'structural',
  message: () => 'I want to explore other strategies and options',
  rehomedFrom: 'model-tab/OptionsSection.tsx:486 and :508 (one action, two sites)',
}

const DISCUSS_OPTIONS: GroupAction = {
  id: 'options-discuss',
  label: 'Discuss the options with Olumi',
  intent: 'discuss',
  message: () => 'Help me review my options and how they compare',
  rehomedFrom: 'model-tab/OptionsSection.tsx:521',
}

const ADD_FACTOR: GroupAction = {
  id: 'factors-add',
  label: 'Add a factor',
  intent: 'structural',
  message: () => 'I want to add a new factor to the model',
  rehomedFrom: 'model-tab/FactorsSection.tsx:737',
}

const DISCUSS_FACTORS: GroupAction = {
  id: 'factors-discuss',
  label: 'Discuss the factors with Olumi',
  intent: 'discuss',
  message: () => 'Help me review the factors in my model and whether the values are reasonable',
  rehomedFrom: 'model-tab/FactorsSection.tsx:745',
}

const ADD_RISK: GroupAction = {
  id: 'risks-add',
  label: 'Identify potential risks',
  intent: 'structural',
  message: () => 'I want to identify potential risks that could cause this decision to fail',
  rehomedFrom: 'model-tab/RisksSection.tsx:100 (the SEVENTH capability — empty-state only in v1)',
}

const DISCUSS_RISKS: GroupAction = {
  id: 'risks-discuss',
  label: 'Discuss the risks with Olumi',
  intent: 'discuss',
  message: () => 'Help me understand the risks in my model and how to mitigate them',
  rehomedFrom: 'model-tab/RisksSection.tsx:143',
}

const ADD_RELATIONSHIP: GroupAction = {
  id: 'relationships-add',
  label: 'Add a relationship',
  intent: 'structural',
  message: () => "I'd like to add a causal relationship",
  rehomedFrom: 'model-tab/RelationshipsSection.tsx:819',
}

const DISCUSS_RELATIONSHIPS: GroupAction = {
  id: 'relationships-discuss',
  label: 'Discuss the relationships with Olumi',
  intent: 'discuss',
  message: () => 'Help me review the causal relationships and which ones need attention',
  rehomedFrom: 'model-tab/RelationshipsSection.tsx:827',
}

const DISCUSS_RELIABILITY: GroupAction = {
  id: 'evidence-discuss',
  label: "Discuss the model's reliability with Olumi",
  intent: 'discuss',
  message: () => 'Help me understand the reliability and limitations of my model',
  rehomedFrom: 'model-tab/ModelHealthSection.tsx:328',
}

/**
 * The actions each outline group offers, structural first.
 *
 * ⚠ TOTAL BY CONSTRUCTION. `assumptions-provenance` is `[]` because the v1
 * stack had NO send-to-AI control for it — an empty array is the derived answer,
 * not an omission, and the type will not let a future group be forgotten.
 */
export const GROUP_ACTIONS: Record<ModelGroupId, readonly GroupAction[]> = {
  goal: [DISCUSS_GOAL],
  options: [EXPLORE_STRATEGIES, DISCUSS_OPTIONS],
  factors: [ADD_FACTOR, DISCUSS_FACTORS],
  'outcomes-risks': [ADD_RISK, DISCUSS_RISKS],
  relationships: [ADD_RELATIONSHIP, DISCUSS_RELATIONSHIPS],
  'assumptions-provenance': [],
  'evidence-review': [DISCUSS_RELIABILITY],
}

/** Every action across every group — the flat set, for guards and sweeps. */
export const ALL_GROUP_ACTIONS: readonly GroupAction[] =
  Object.values(GROUP_ACTIONS).flat()
