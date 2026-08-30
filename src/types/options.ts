/**
 * Canonical Option Types (Phase 1.1)
 *
 * Single source of truth for the UI layer's option model.
 * These types define how options and interventions are represented
 * throughout the UI, regardless of source (CEE, legacy nodes, user input).
 */

// ============================================================================
// Core Option Types
// ============================================================================

/**
 * Represents a decision option with its interventions and readiness status.
 *
 * Options are decision paths that specify intervention bundles - what changes
 * to make to causal variables when this option is chosen.
 */
export interface UIOption {
  /** Unique identifier */
  id: string
  /** Display label */
  label: string
  /** Optional description */
  description?: string

  /**
   * Readiness status — determines UI treatment and analysability.
   * - 'ready': Option has valid interventions and can be analysed
   * - 'needs_user_mapping': Option needs user input to resolve interventions
   */
  status: 'ready' | 'needs_user_mapping' | 'needs_encoding' | 'unknown'

  /**
   * What this option does causally.
   * Maps node IDs to intervention values.
   */
  interventions: Record<string, UIInterventionValue>

  /**
   * Questions to prompt user for mapping (only when status='needs_user_mapping').
   * E.g., "Which causal variable does 'premium pricing' affect?"
   */
  user_questions?: string[]

  /**
   * Intervention targets that couldn't be matched (only when status='needs_user_mapping').
   * E.g., ['premium pricing', 'aggressive marketing']
   */
  unresolved_targets?: string[]

  /**
   * Where this option came from.
   * - 'cee_generated': Created by CEE from the decision brief
   * - 'user_created': Created manually by user
   * - 'legacy_node': Adapted from a legacy option node
   */
  source?: 'cee_generated' | 'user_created' | 'legacy_node'

  /** Original pre-encoding intervention values (e.g. categorical strings, booleans) */
  raw_interventions?: Record<string, unknown>
}

/**
 * Represents an intervention value with provenance and confidence metadata.
 *
 * Note: Units are derived from the target NODE's observed_state.unit,
 * NOT stored on the intervention itself (prevents drift).
 */
export interface UIInterventionValue {
  /** The intervention value */
  value: number

  /**
   * How this value was determined.
   * - 'brief_extraction': Extracted from the decision brief text
   * - 'user_specified': Explicitly set by user
   * - 'cee_hypothesis': Inferred by CEE based on context
   *
   * ⭐⭐ ABSENT MEANS **THE RECORD DOES NOT SAY**, AND THAT IS A LEGITIMATE
   * STATE — the fourth one, alongside the three literals. It is OPTIONAL for
   * exactly that reason.
   *
   * CEE's `analysis_ready` carries interventions in either the nested V3 object
   * form `{value, source, …}` or a BARE FLATTENED NUMBER, and a bare number
   * carries no provenance at all. Every adapter here used to answer that by
   * inventing one, and they did not agree on which: `ceeOptionToUIOption` and
   * `normaliseOptionFromCEE` stamped `'brief_extraction'` ("From your brief"),
   * while `normaliseOptionFromLegacyNode` stamped `'user_specified'` ("you set
   * this") — on numbers that `backfillInterventionsOntoOptionNodes` had written
   * onto the canvas straight out of CEE's own draft. One upstream shape, two
   * opposite attributions, neither with any evidence behind it.
   *
   * The standing invariant this restores: *explicit user fact → PRESERVE IT ·
   * defensible Olumi estimate → the estimate WITH its provenance · genuinely
   * unknown → UNKNOWN.* No path may convert the third into a claim because a
   * downstream surface would like a badge to render.
   *
   * ⚠ THE CONSUMER CONTRACT IS ALREADY WRITTEN FOR THIS.
   * `classifyInterventionProvenance(undefined)` returns `null`, and the honest
   * readers render nothing on `null` (`ModelDetailRegion.tsx:85`,
   * `InterventionRow.tsx:179`). Canvas node data has said the same thing for
   * longer: `canvas/domain/nodes.ts:185` already declares this field
   * `.optional()`. This type was the one place still insisting on an answer.
   *
   * ⚠ DO NOT "FIX" AN ABSENT SOURCE BY DEFAULTING IT. If you need a source that
   * is not on the record, the value's provenance has been lost upstream — go
   * and find where, rather than restating the guess one layer down.
   */
  source?: 'brief_extraction' | 'user_specified' | 'cee_hypothesis'

  /**
   * Information about how this intervention was matched to a node.
   */
  target_match?: {
    /** The node ID this intervention targets */
    node_id: string
    /** How the match was determined */
    match_type: 'exact_id' | 'exact_label' | 'semantic'
    /** Confidence in the match */
    confidence: 'high' | 'medium' | 'low'
  }

  /**
   * Confidence in the value itself (separate from match confidence).
   */
  value_confidence?: 'high' | 'medium' | 'low'

  /**
   * Optional explanation for this intervention.
   * E.g., "Extracted from '£15 price increase' in brief"
   */
  reasoning?: string
}

// ============================================================================
// CEE Response Types (Input)
// ============================================================================

/**
 * CEE V3 option format (from backend).
 */
export interface CEEOptionV3 {
  id: string
  label: string
  status: 'ready' | 'needs_user_mapping' | 'needs_user_input' | 'needs_encoding'
  interventions: Record<string, CEEInterventionV3>
  user_questions?: string[]
  unresolved_targets?: string[]
  /** Original pre-encoding intervention values (e.g. categorical strings, booleans) */
  raw_interventions?: Record<string, unknown>
}

/**
 * CEE V3 intervention format (from backend).
 */
export interface CEEInterventionV3 {
  value: number
  source: 'brief_extraction' | 'user_specified' | 'cee_hypothesis'
  target_match?: {
    node_id: string
    match_type: 'exact_id' | 'exact_label' | 'semantic'
    confidence: 'high' | 'medium' | 'low'
  }
  value_confidence?: 'high' | 'medium' | 'low'
  reasoning?: string
}

// ============================================================================
// Legacy Node Types (Input)
// ============================================================================

/**
 * Legacy option node format (from canvas).
 */
export interface LegacyOptionNode {
  id: string
  type: 'option' | 'decision'
  data: {
    kind?: 'option' | 'decision'
    label: string
    description?: string
    /** Legacy: Simple intervention map (node_id -> value) */
    interventions?: Record<string, number>
    /** Legacy: Single value fallback */
    value?: number
    /** Canvas uses observedState (camelCase), not observed_state */
    observedState?: {
      value?: number
      baseline?: number
      unit?: string
    }
  }
}

// ============================================================================
// Normalisation Functions
// ============================================================================

/**
 * Normalise a CEE V3 option to UI format.
 *
 * Handles both:
 * - Nested format (V3): { value: number, source: string, ... }
 * - Flattened format (analysis_ready): number
 *
 * CEE may return interventions in either format depending on the response path.
 */
export function normaliseOptionFromCEE(ceeOption: CEEOptionV3): UIOption {
  return {
    id: ceeOption.id,
    label: ceeOption.label,
    status: ceeOption.status,
    interventions: Object.fromEntries(
      Object.entries(ceeOption.interventions).map(([nodeId, iv]) => {
        // Handle both nested (V3) and flattened (analysis_ready) formats.
        //
        // ⚠ THE FLATTENED FORM CARRIES NO PROVENANCE, SO NEITHER DOES THE
        // OUTPUT. This branch used to stamp `'brief_extraction'` — telling the
        // user a number CEE had merely produced came out of their own brief.
        // See `UIInterventionValue.source` for the full account; the short
        // version is that a bare number is silent about who chose it, and the
        // adapter must be silent too.
        const isNumber = typeof iv === 'number'
        return [
          nodeId,
          {
            value: isNumber ? iv : iv.value,
            ...(isNumber || iv.source === undefined ? {} : { source: iv.source }),
            target_match: isNumber ? undefined : iv.target_match,
            value_confidence: isNumber ? undefined : iv.value_confidence,
            reasoning: isNumber ? undefined : iv.reasoning,
          },
        ]
      })
    ),
    user_questions: ceeOption.user_questions,
    unresolved_targets: ceeOption.unresolved_targets,
    source: 'cee_generated',
    ...(ceeOption.raw_interventions ? { raw_interventions: ceeOption.raw_interventions } : {}),
  }
}

/**
 * Normalise a legacy option node to UI format.
 *
 * Legacy nodes are always marked as 'needs_user_mapping' unless they have
 * explicit interventions, since they typically lack proper intervention mappings.
 */
export function normaliseOptionFromLegacyNode(
  node: LegacyOptionNode,
  validNodeIds?: Set<string>
): UIOption {
  const interventions: Record<string, UIInterventionValue> = {}
  let hasValidInterventions = false

  // Check for explicit interventions
  if (node.data.interventions && typeof node.data.interventions === 'object') {
    for (const [nodeId, value] of Object.entries(node.data.interventions)) {
      if (typeof value === 'number') {
        // Skip stale node IDs if validation set provided
        if (validNodeIds && !validNodeIds.has(nodeId)) {
          continue
        }
        // ⚠⚠ NO `source` — AND THIS IS THE SHARPEST INSTANCE OF THE CLASS.
        // `node.data.interventions` is written VERBATIM out of CEE's own
        // `analysis_ready` by `backfillInterventionsOntoOptionNodes`
        // (`applyDraftResult.ts` — `interventions: optEntry.interventions`), so
        // when CEE sends the flattened form these bare numbers are the MODEL's,
        // not the user's. Stamping `'user_specified'` here put "you set this"
        // (`InterventionDisplay.formatSource`) under every drafted intervention
        // in the node inspector, on the live render path
        // `NodeInspector.tsx:153 → :787/:838`.
        //
        // ⚠ THE MAP IS ALSO WRITTEN BY THE USER'S OWN MAPPING FORM, and that is
        // exactly why guessing cannot work: `UserMappingForm` stamps a true
        // `'user_specified'`, `NodeInspector`'s save then FLATTENS the map to
        // bare numbers (`newInterventions[nId] = iv.value`), and the two origins
        // become indistinguishable on disk. Silence is the only honest answer
        // available here. Restoring the user's signal means preserving it at the
        // WRITE — rowed, and not something this reader can invent back.
        interventions[nodeId] = {
          value,
          target_match: {
            node_id: nodeId,
            match_type: 'exact_id',
            confidence: 'high',
          },
        }
        hasValidInterventions = true
      }
    }
  }

  // Fallback to node's own value if no explicit interventions.
  // Same reasoning as above: `node.data.value` records a number, never who
  // chose it. A legacy option node carrying a drafted value is the common case.
  if (!hasValidInterventions && typeof node.data.value === 'number') {
    interventions[node.id] = {
      value: node.data.value,
      target_match: {
        node_id: node.id,
        match_type: 'exact_id',
        confidence: 'high',
      },
    }
    hasValidInterventions = true
  }

  // Determine status based on interventions
  const status = hasValidInterventions ? 'ready' : 'needs_user_mapping'

  return {
    id: node.id,
    label: node.data.label || `Option ${node.id}`,
    description: node.data.description,
    status,
    interventions,
    user_questions: status === 'needs_user_mapping'
      ? [
          'Which causal variable(s) does this option affect?',
          'What value should that variable have if this option is chosen?',
        ]
      : undefined,
    source: 'legacy_node',
  }
}

/**
 * Create a new user option.
 */
export function createUserOption(
  id: string,
  label: string,
  interventions: Record<string, number> = {}
): UIOption {
  return {
    id,
    label,
    status: Object.keys(interventions).length > 0 ? 'ready' : 'needs_user_mapping',
    interventions: Object.fromEntries(
      Object.entries(interventions).map(([nodeId, value]) => [
        nodeId,
        {
          value,
          source: 'user_specified' as const,
          target_match: {
            node_id: nodeId,
            match_type: 'exact_id' as const,
            confidence: 'high' as const,
          },
        },
      ])
    ),
    user_questions:
      Object.keys(interventions).length === 0
        ? [
            'Which causal variable(s) does this option affect?',
            'What value should that variable have if this option is chosen?',
          ]
        : undefined,
    source: 'user_created',
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if an option is ready for analysis.
 */
export function isOptionReady(option: UIOption): boolean {
  return option.status === 'ready' && Object.keys(option.interventions).length > 0
}

/**
 * Check if all options are ready for analysis.
 */
export function areAllOptionsReady(options: UIOption[]): boolean {
  return options.every(isOptionReady)
}

/**
 * Get options that need user mapping.
 */
export function getOptionsNeedingMapping(options: UIOption[]): UIOption[] {
  return options.filter((o) => o.status === 'needs_user_mapping')
}

/**
 * Check for options with empty interventions (ready status but no interventions).
 */
export function getOptionsWithEmptyInterventions(options: UIOption[]): UIOption[] {
  return options.filter(
    (o) => o.status === 'ready' && Object.keys(o.interventions).length === 0
  )
}

/**
 * Check if two options have identical intervention sets.
 */
export function areOptionsIdentical(a: UIOption, b: UIOption): boolean {
  const aKeys = Object.keys(a.interventions).sort()
  const bKeys = Object.keys(b.interventions).sort()

  if (aKeys.length !== bKeys.length) return false
  if (!aKeys.every((k, i) => k === bKeys[i])) return false

  // Check values with tolerance
  return aKeys.every((key) => {
    const aVal = a.interventions[key].value
    const bVal = b.interventions[key].value
    const maxAbs = Math.max(Math.abs(aVal), Math.abs(bVal), 1)
    const tolerance = 0.001 * maxAbs // 0.1% tolerance
    return Math.abs(aVal - bVal) < tolerance
  })
}

/**
 * Find pairs of identical options.
 */
export function findIdenticalOptionPairs(options: UIOption[]): [string, string][] {
  const pairs: [string, string][] = []

  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      if (areOptionsIdentical(options[i], options[j])) {
        pairs.push([options[i].label, options[j].label])
      }
    }
  }

  return pairs
}
