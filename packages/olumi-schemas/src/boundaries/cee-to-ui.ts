/**
 * CEE → UI Boundary Field Drops
 *
 * Documents fields intentionally removed when CEE response is stored in UI state.
 *
 * Source: src/canvas/components/DraftChat.tsx
 * Boundary: adaptDraftResponse() → canvas store
 */

/**
 * Fields removed at CEE → UI boundary.
 *
 * These fields are dropped because:
 * - They are debug/trace data not needed in UI state
 * - They are transformed to different formats (e.g., snake_case → camelCase)
 * - They are React Flow structural data added by the UI layer
 */
export const CEE_TO_UI_DROPS = {
  description: 'Fields removed when CEE response is stored in UI',
  boundary: 'CEE adaptDraftResponse() → Canvas Store',
  drops: [
    // Trace/debug data (not needed in UI state, used only for debug panel)
    'trace.pipeline.llm_calls[].request',
    'trace.pipeline.llm_calls[].response',
    'trace.pipeline.stages[].details',

    // Schema metadata (not needed in UI)
    'schema_version',

    // Fields that are transformed (not dropped, but renamed)
    // observed_state (snake_case) → observedState (camelCase)
    // kind → type (React Flow convention)
  ],
  transformations: [
    {
      from: 'observed_state',
      to: 'observedState',
      reason: 'React Flow / JavaScript convention uses camelCase',
    },
    {
      from: 'kind',
      to: 'type',
      reason: 'React Flow nodes require "type" field',
    },
  ],
  preserved: [
    // All V3 fields pass through via spread operator
    'goal_threshold',
    'goal_threshold_raw',
    'goal_threshold_unit',
    'goal_threshold_cap',
    'prior',
    'category',
    'intercept',
    'description',
    // All observed_state sub-fields
    'observedState.raw_value',
    'observedState.cap',
    'observedState.factor_type',
    'observedState.uncertainty_drivers',
    'observedState.extractionType',
    // Edge fields
    'effect_direction',
    'strength_std',
    'belief_exists',
  ],
} as const

/**
 * Type for field drop documentation.
 */
export type FieldDropDoc = typeof CEE_TO_UI_DROPS
