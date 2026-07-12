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
}

export interface GlobalActionEntry {
  id: string
  title: string
  description: string
}

export const METHOD_CATALOGUE: MethodEntry[] = [
  {
    id: 'reframe_problem',
    title: 'Reframe the problem',
    description: 'Check whether the current question is too narrow.',
    prompt: 'Help me reframe this decision. Is the question we are asking too narrow, and what alternative framings should we consider?',
  },
  {
    id: 'different_option',
    title: 'Generate a materially different option',
    description: 'Use divergent thinking before narrowing.',
    prompt: 'Help me generate an option that works through a materially different mechanism from the ones already on the canvas.',
  },
  {
    id: 'consider_opposite',
    title: 'Consider the opposite',
    description: 'Build the strongest case against the current leader.',
    prompt: 'Build the strongest honest case AGAINST the currently leading option. What evidence or reasoning would change my mind?',
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
  },
  {
    id: 'rerun_analysis',
    title: 'Rerun analysis',
    description: 'Run the analysis against the current model.',
  },
]
