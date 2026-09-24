/**
 * #1973 — the fixtures the Run-chip gate witness serves in place of CEE.
 * Pure data, no DOM: imported by the Node-side spec, which route-fulfils
 * `/proxy/v5/turn` and `/bff/cee/graph-readiness` with them.
 *
 * ⚠ WHAT IS THE PRODUCER'S AND WHAT IS THE HARNESS'S — stated so the photos are
 * read correctly:
 *   - The GRAPH is a real captured CEE draft (`pricing-model.draft.json`, the
 *     saved-example starter), applied through the product's `applyDraftResult`.
 *   - The READINESS verdicts follow the producer's `/graph-readiness` shape as
 *     `readinessStore.refusalReachesUser.spec.ts` records it at the CEE bytes
 *     (`blocker_reason` + `readiness_issues[]`, the `MISSING_OPTION_VALUE`
 *     sentence template). The INSTANCE is the harness's: one owed repair, named
 *     against this graph's own option and factor labels.
 *   - The TURN replies are the harness's. Their `assistant_text` says so in
 *     brackets. Their `suggested_actions` are schema-valid `ActionSchema`
 *     entries (`@talchain/schemas/boundary`): one Run chip
 *     (`action_type: 'run_analysis'`) and one conversational chip.
 *   - Nothing here carries `analysis_state`, so the side-car readiness verdict
 *     is the gate's readiness input (absence = "not stated", per the contract).
 */

/** The seeded starter. Its labels are what the readiness repair names. */
export const STARTER = 'pricing-model' as const
export const OPTION = { id: 'opt_hybrid', label: 'Hybrid Platform Fee Plus Usage' } as const
export const FACTOR = { id: 'fac_usage_exposure', label: 'Usage-Based Pricing Exposure' } as const

/** CEE's own sentence template for an owed option value, instantiated on this graph. */
export const OWED_REPAIR_SENTENCE =
  `Choose the missing effect value for "${OPTION.label}" on "${FACTOR.label}".`

/** Gate CLOSED: `can_run_analysis: false`, one owed repair. */
export const READINESS_BLOCKED: Record<string, unknown> = {
  readiness_score: 62,
  readiness_level: 'needs_work',
  confidence_level: 'medium',
  confidence_explanation: 'not ready',
  can_run_analysis: false,
  improvements: [],
  options_ready: 3,
  options_total: 4,
  goal_node_valid: true,
  blocker_reason: OWED_REPAIR_SENTENCE,
  readiness_issues: [
    {
      issue_id: `${OPTION.id}-${FACTOR.id}`,
      code: 'MISSING_OPTION_VALUE',
      category: 'option_values',
      repairability: 'human_input_required',
      option_id: OPTION.id,
      option_label: OPTION.label,
      factor_id: FACTOR.id,
      factor_label: FACTOR.label,
      obligation: 'required',
      message: OWED_REPAIR_SENTENCE,
    },
  ],
}

/** Gate OPEN: `can_run_analysis: true`, nothing owed. */
export const READINESS_READY: Record<string, unknown> = {
  readiness_score: 90,
  readiness_level: 'ready',
  confidence_level: 'high',
  confidence_explanation: 'ready',
  can_run_analysis: true,
  improvements: [],
  options_ready: 4,
  options_total: 4,
  goal_node_valid: true,
  readiness_issues: [],
}

/**
 * The Run chip's label. Deliberately NOT "Run analysis": before #1973 the gated
 * path echoed every Run chip as a hardcoded "Run analysis", so only a
 * different label can show the bubble echoes THE CHIP. It still matches
 * `RUN_ANALYSIS_RE`, and carries `action_type: 'run_analysis'` besides.
 */
export const RUN_CHIP = { id: 'act_run', label: 'Run the analysis', message: 'Run analysis', action_type: 'run_analysis' } as const
/** A conversational chip: no `action_type`, so the run gate must never touch it. */
export const TALK_CHIP = { id: 'act_explain', label: 'Explain the model', message: 'Explain this model to me' } as const

/** What the user types to open the conversation. */
export const OPENING_MESSAGE = 'Help me decide how to price this'

export const TURN_TEXT = {
  opening: '[Witness fixture, not CEE output] Your pricing model is on the canvas. You can run the analysis, or ask me to explain the model first.',
  explain: '[Witness fixture, not CEE output] The model weighs four pricing options against net revenue retention. The run is still yours to start.',
  run: '[Witness fixture, not CEE output] Run turn received. This fixture carries no analysis payload.',
} as const

export type TurnKind = 'opening' | 'explain' | 'run'

/** A text + chips turn. No `analysis_state`, no `analysis_ready`: see the header. */
export function turnReply(kind: TurnKind): Record<string, unknown> {
  return {
    response_version: 2,
    assistant_text: TURN_TEXT[kind],
    blocks: [],
    suggested_actions: kind === 'run' ? [] : [{ ...RUN_CHIP }, { ...TALK_CHIP }],
    insights: [],
    stage_indicator: 'frame',
  }
}
