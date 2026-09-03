/**
 * Wave 1 — the ONE stable Actions catalogue (brief §4.7).
 *
 * Methods are user-invoked science-grounded moves; global actions are
 * utilities. The catalogue stays recognisable across contexts (ordering may
 * adapt later, membership does not). Every method opens a CONTEXTUAL AI
 * session (dispatchAction, conversation-typed so chip_metadata survives the
 * wire) rather than a blank chat. Copy: sentence case, en-GB, no em dashes.
 */
export interface MethodEntry {
  id: string
  title: string
  description: string
  /** Opening message for the contextual AI session. */
  prompt: string
  /**
   * The CEE intent this technique IS, when one of the accepted intents names
   * the same move. Absent for every technique where none does.
   *
   * ⭐⭐ WHY IT MATTERS, AND IT IS NOT A ROUTING DETAIL. A chip turn carrying an
   * accepted intent is what makes CEE apply decision science: it resolves a DSK
   * protocol for the intent and builds a coaching-method directive from it
   * (`resolveApplicableProtocol`, `buildCoachingMethodDirective`). Without one,
   * `resolveCoachingIntent` returns undefined and the turn is an ordinary chat
   * that happens to start with a good prompt. So the product could name a
   * technique, prefill its prompt, and still never ask CEE to RUN it.
   *
   * ⚠ ABSENT IS THE COMMON CASE AND IS DELIBERATE. `CEE_ACCEPTED_INTENTS`
   * (`v5/buildPayload.ts`) accepts far fewer intents than the `Intent` enum
   * publishes — read that registry for the membership, never a count restated
   * here — and the gate FAILS CLOSED, so an unmapped technique sends no intent
   * and behaves exactly as it does today. A
   * technique is mapped only where an accepted intent names the SAME move —
   * never by rough resemblance, which would ask CEE to run the wrong protocol
   * under a science label.
   */
  intent?: string
}

export interface GlobalActionEntry {
  id: string
  title: string
  description: string
  /** Prefilled drawer draft for actions routed through the Ask-Olumi drawer. */
  prompt?: string
}

/**
 * Parity O — the shared "review my decision brief" ask payload. Used by both
 * the Actions menu's "Edit decision brief" item and the in-card "Review your
 * decision brief" row (prototype: identical drawer payloads).
 */
export const REVIEW_BRIEF_ASK = {
  label: 'Review my decision brief',
  context: 'Challenge the framing across Goal, Context, Constraints and Options.',
  draft: 'Help me work through: Review my decision brief',
} as const

/**
 * Parity O — rerun feedback copy. The prototype toasts a completed message;
 * we only claim completion on the V2 path (whose promise resolves after the
 * run finishes). The canonical V5 dispatch is fire-and-forget, so its toast
 * honestly says the rerun has started, not completed.
 */
export const RERUN_TOASTS = {
  completed: 'Analysis rerun completed with the current model',
  started: 'Rerunning analysis with the current model',
  alreadyRunning: 'Analysis is already running',
} as const

export const METHOD_CATALOGUE: MethodEntry[] = [
  {
    id: 'reframe_problem',
    title: 'Reframe the problem',
    description: 'Check whether the current question is too narrow.',
    prompt: 'Help me reframe this decision. Is the question we are asking too narrow, and what alternative framings should we consider?',
    // Reframing the problem IS challenging the frame — the catalogue's own
    // description and the intent name the same move.
    intent: 'challenge_frame',
  },
  {
    id: 'different_option',
    title: 'Generate a materially different option',
    description: 'Use divergent thinking before narrowing.',
    prompt: 'Help me generate an option that works through a materially different mechanism from the ones already on the canvas.',
    // Asking for an option that does not exist yet is option ELICITATION, not
    // adding a known one — `add_option` carries a label CEE is meant to attach,
    // and there is nothing to attach here.
    intent: 'elicit_options',
  },
  {
    id: 'consider_opposite',
    title: 'Consider the opposite',
    description: 'Build the strongest case against the current leader.',
    prompt: 'Build the strongest honest case AGAINST the currently leading option. What evidence or reasoning would change my mind?',
    // "What would change my mind?" is an assumption challenge, and it is the
    // same intent the engine's own `strengthen:robustness` trigger sends.
    intent: 'challenge_assumption',
  },
  {
    id: 'outside_view',
    title: 'Apply the outside view',
    description: 'Compare with a relevant reference class.',
    prompt: 'Apply the outside view to this decision. What reference class does it belong to, and what do base rates suggest?',
  },
  {
    id: 'pre_mortem',
    title: 'Run a pre-mortem',
    description: 'Imagine failure and capture plausible causes.',
    prompt: 'Run a pre-mortem with me: imagine this decision failed a year from now. What plausibly went wrong, and which risks should we add to the model?',
  },
  {
    id: 'explore_tradeoffs',
    title: 'Explore trade-offs',
    description: 'Make gains and sacrifices explicit.',
    prompt: 'Walk me through the real trade-offs between the leading options: what each gains, gives up and depends on.',
  },
  {
    id: 'review_bias',
    title: 'Review a possible bias',
    description: 'Use only biases grounded in this brief or model.',
    prompt: 'Review this decision for reasoning biases that are actually grounded in the current brief and model, and how to test for them.',
  },
]

export const GLOBAL_ACTIONS: GlobalActionEntry[] = [
  {
    id: 'edit_brief',
    title: 'Edit decision brief',
    description: 'Review goal, context, constraints and options.',
  },
  {
    id: 'review_inputs',
    title: 'Review all inputs',
    description: 'Inspect the current model inputs without changing them.',
    prompt: 'Walk me through all the current model inputs without changing anything.',
  },
  {
    id: 'rerun_analysis',
    title: 'Rerun analysis',
    description: 'Run the analysis against the current model.',
  },
]
