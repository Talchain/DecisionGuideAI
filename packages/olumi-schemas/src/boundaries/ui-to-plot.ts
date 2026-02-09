/**
 * UI → PLoT Boundary Field Drops
 *
 * Documents fields intentionally removed when canvas state is sent to PLoT.
 *
 * Source: src/adapters/plot/v2/adapter.ts
 * Boundary: transformNodeToV2() / transformEdgeToV2() → V2RunRequest
 */

/**
 * Fields removed at UI → PLoT boundary.
 *
 * These fields are dropped because:
 * - They are React Flow internals (position, dragging, etc.)
 * - They are UI-only display fields (uncertainty, interventions on non-option nodes)
 * - They are not needed by PLoT for analysis
 */
export const UI_TO_PLOT_DROPS = {
  description: 'Fields removed when canvas state is sent to PLoT',
  boundary: 'Canvas Store → V2RunRequest (via transformNodeToV2/transformEdgeToV2)',
  drops: [
    // React Flow internals (added to node.data by RF)
    'selected',
    'dragging',
    'measured',
    'resizing',

    // Canvas UI-only / RF structural fields
    'position',
    'positionAbsolute',
    'draggable',
    'selectable',
    'deletable',
    'connectable',
    'focusable',
    'parentId',
    'extent',
    'expandParent',
    'ariaLabel',
    'zIndex',
    'hidden',

    // UI-only display fields (not for PLoT)
    'uncertainty',  // Legacy field, superseded by observed_state.std
    'interventions', // Only sent via options array, not on nodes
  ],
  transformations: [
    {
      from: 'observedState',
      to: 'observed_state',
      reason: 'PLoT API uses snake_case convention',
    },
    {
      from: 'type',
      to: 'kind',
      reason: 'PLoT uses "kind" field name, React Flow uses "type"',
    },
  ],
  preserved: [
    // All V3 fields pass through (blocklist approach in V2_NODE_BLOCKLIST)
    'id',
    'label',
    'kind',
    'category',
    'observed_state',
    'goal_threshold',
    'goal_threshold_raw',
    'goal_threshold_unit',
    'goal_threshold_cap',
    'prior',
    'intercept',
    'description',
    // All observed_state sub-fields
    'observed_state.value',
    'observed_state.std',
    'observed_state.baseline',
    'observed_state.unit',
    'observed_state.source',
    'observed_state.raw_value',
    'observed_state.cap',
    'observed_state.factor_type',
    'observed_state.uncertainty_drivers',
    'observed_state.extractionType',
    // Edge fields
    'from',
    'to',
    'strength.mean',
    'strength.std',
    'exists_probability',
  ],
} as const

/**
 * Type for field drop documentation.
 */
export type FieldDropDoc = typeof UI_TO_PLOT_DROPS
