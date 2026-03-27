/**
 * Inspector v2 — centralised string table
 * All user-facing labels. Exact strings from spec §3. No deviation.
 */

import type { NodeType, FactorCategory } from '../../domain/nodes'

// ─── Section titles (spec §3.1) ────────────────────────────────────
export const SECTION_TITLES = {
  successTarget:       { label: 'Success target',                icon: 'Target'         },
  impact:              { label: 'Impact',                        icon: 'BarChart3'      },
  whatDrivesThis:      { label: 'What drives this',              icon: 'GitBranch'      },
  options:             { label: 'Options',                       icon: 'Layers'         },
  decisionFraming:     { label: 'Decision framing',              icon: 'FileText'       },
  whatThisChanges:     { label: 'What this option changes',      icon: 'Zap'            },
  value:               { label: 'Value',                         icon: 'Gauge'          },
  whereThisComes:      { label: 'Where this comes from',         icon: 'FileSearch'     },
  yourEstimate:        { label: 'Your estimate',                 icon: 'Sliders'        },
  howStrong:           { label: 'How strong is this effect',     icon: 'Activity'       },
  doesExist:           { label: 'Does this connection exist',    icon: 'ShieldQuestion' },
  howUncertain:        { label: 'How uncertain is the strength', icon: 'Maximize2'      },
  evidence:            { label: 'Evidence',                      icon: 'FileSearch'     },
  fragility:           { label: 'Fragility',                     icon: 'AlertTriangle'  },
  connections:         { label: 'Connections',                   icon: 'GitBranch'      },
  predictedRange:      { label: 'Predicted range by option',     icon: 'BarChart3'      },
  riskExposure:        { label: 'Risk exposure by option',       icon: 'BarChart3'      },
  scientificBasis:     { label: 'Scientific basis',              icon: 'Beaker'         },
} as const

export type SectionKey = keyof typeof SECTION_TITLES

// ─── Type/pill labels (spec §3.2) ──────────────────────────────────
/** Compound key for factor subtypes */
export function getTypeLabel(nodeType: NodeType, category?: FactorCategory | string): string {
  if (nodeType === 'factor') {
    switch (category) {
      case 'controllable': return 'You can change this'
      case 'observable':   return 'You measure this'
      case 'external':     return 'Outside your control'
      default:             return 'Factor'
    }
  }
  const labels: Partial<Record<NodeType, string>> = {
    goal:       'Goal',
    decision:   'Decision',
    option:     'Option',
    outcome:    'Outcome',
    risk:       'Risk',
    action:     'Action',
    constraint: 'Constraint',
  }
  return labels[nodeType] ?? 'Node'
}

/** Edge type label — always "Relationship" in user-facing UI */
export const EDGE_TYPE_LABEL = 'Relationship'

// ─── Badge / tooltip labels (spec §3.2) ────────────────────────────
export const BADGE_TOOLTIPS: Record<string, string> = {
  controllable: 'Your team can directly adjust this factor',
  observable:   'Your team can track this but not directly control it',
  external:     "Market conditions, competitor actions, or other forces you can't influence",
  baseline:     'What happens if you change nothing',
  explicit:     'This value was stated in your decision brief',
  inferred:     'This value was estimated because it wasn\'t stated explicitly',
}

// ─── Provenance labels (spec §3.4) ────────────────────────────────
export function getProvenanceLabel(source?: string): string {
  if (!source) return 'No evidence yet'
  switch (source) {
    case 'brief_extraction': return 'Generated from your brief'
    case 'explicit':         return 'From your brief'
    case 'cee_inference':    return 'Estimated by Olumi'
    case 'inferred':         return 'Estimated by Olumi'
    case 'cee_repair':       return 'Generated from your brief (adjusted during validation)'
    case 'user':             return 'Set by you'
    case 'user_calibration': return 'Set by you'
    case 'ai-suggested':     return 'Generated from your brief'
    case 'default':          return 'No evidence yet'
    default:                 return source.startsWith('evidence:') ? `Based on ${source.slice(9)}` : `Source: ${source}`
  }
}

/** Extraction type user-facing labels */
export function getExtractionLabel(source?: string): string {
  if (!source) return 'Estimated by Olumi'
  switch (source) {
    case 'brief_extraction': return 'From your brief'
    case 'user':             return 'Set by you'
    case 'user_calibration': return 'Set by you'
    default:                 return 'Estimated by Olumi'
  }
}

// ─── Strength human labels (validation_ui_data_contract_v1.1 thresholds) ─────
// Canonical thresholds: Very strong ≥ 0.70, Strong ≥ 0.40, Moderate ≥ 0.20, Slight < 0.20
// Aligned with DS v4 reference artefact.
export function getStrengthLabel(absValue: number): string {
  if (absValue >= 0.70) return 'Very strong'
  if (absValue >= 0.40) return 'Strong'
  if (absValue >= 0.20) return 'Moderate'
  return 'Slight'
}

export function getStrengthDescription(signedValue: number): string {
  const label = getStrengthLabel(Math.abs(signedValue))
  const dir = signedValue >= 0 ? 'positive' : 'negative'
  return `${label} ${dir}`
}

// ─── Empty states (DS v4 §16) ──────────────────────────────────────
export const EMPTY_STATES = {
  noAnalysis:       'Run your first simulation to see results',
  noInterventions:  'This option doesn\'t change any factors yet',
  noThreshold:      'Adding a specific target unlocks probability calculations',
  noEvidence:       'No calibration or external data. Providing evidence would improve trust in this connection.',
} as const

// ─── "Ask about this" question templates (Task 2) ────────────────────
export const ASK_TEMPLATES: Record<string, string> = {
  goal:                  'Tell me about the chances of achieving {label}',
  'factor-controllable': 'How important is {label} to the outcome?',
  'factor-observable':   'What would happen if {label} changed?',
  'factor-external':     'How sensitive are the results to {label}?',
  edge:                  'Explain the relationship between {sourceLabel} and {targetLabel}',
  option:                'How does {label} compare to the other options?',
  outcome:               'What drives {label} the most?',
  risk:                  'How can we reduce {label}?',
  decision:              'What are the key trade-offs in {label}?',
}

/**
 * Resolve an "Ask about this" question template with element labels.
 * Returns null if no template matches or required placeholders are missing.
 */
export function resolveAskTemplate(
  panelType: string,
  context: { label?: string; sourceLabel?: string; targetLabel?: string },
): string | null {
  const template = ASK_TEMPLATES[panelType]
  if (!template) return null

  let resolved = template
  if (resolved.includes('{label}')) {
    if (!context.label) return null
    resolved = resolved.replace('{label}', context.label)
  }
  if (resolved.includes('{sourceLabel}')) {
    if (!context.sourceLabel) return null
    resolved = resolved.replace('{sourceLabel}', context.sourceLabel)
  }
  if (resolved.includes('{targetLabel}')) {
    if (!context.targetLabel) return null
    resolved = resolved.replace('{targetLabel}', context.targetLabel)
  }
  return resolved
}
