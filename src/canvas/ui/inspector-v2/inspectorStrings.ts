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
  fragility:           { label: 'Sensitive assumptions',           icon: 'AlertTriangle'  },
  connections:         { label: 'Connections',                   icon: 'GitBranch'      },
  predictedRange:      { label: 'Predicted range by option',     icon: 'BarChart3'      },
  riskExposure:        { label: 'Risk exposure by option',       icon: 'BarChart3'      },
  scientificBasis:     { label: 'Scientific basis',              icon: 'Beaker'         },
  investigationValue:  { label: 'Value of investigation',        icon: 'TrendingUp'     },
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

// ─── Group labels (v6.2 three-group layout) ───────────────────────
// Quiet headers for the Context / Your input / Connections layout.
export const GROUP_LABELS = {
  context:     'Context',
  input:       'Your input',
  connections: 'Connections',
  evidence:    'Evidence',
  impact:      'Impact',
  comparison:  'Comparison',
  whatThisChanges: 'What this option changes',
} as const

// ─── Inline section labels (v6.2 subordinate rows) ────────────────
export const INLINE_LABELS = {
  setByOptions: 'Set by options',
  influences:   'Influences',
  drivers:      'What drives this',
  influenceOnResults: 'Influence on results',
  sensitiveAssumption: 'Sensitive assumption',
  flipRisk:     '{pct}% flip risk',
  strengthQuestion: 'How strong is this effect?',
  existenceQuestion: 'Does this connection exist?',
  strengthUncertainty: 'Strength uncertainty',
  contributesToGoal: 'Contributes to your goal',
  basedOnModelStructure: 'Based on model structure',
  seeContributions: 'See all contributions',
  seeSensitivity: 'See sensitivity analysis',
  runAnalysisOutcome: 'Run analysis to see predicted outcome ranges per option.',
  runAnalysisRisk: 'Run analysis to see how this risk affects the goal.',
  riskExposurePlaceholder: 'Risk exposure data will be displayed here when available from analysis results.',
  fineTune: 'Fine-tune',
  fineTuneUncertainty: 'Fine-tune uncertainty',
  modelDetail: 'Model detail',
} as const

// ─── Edge link-kind notices (migrated from EdgePanel JSX) ─────────
export const EDGE_LINK_NOTICES = {
  organisational: {
    title: 'Organisational link',
    body:  'This connection shows how options relate to the decision. It does not affect analysis.',
  },
  intervention: {
    title: 'Intervention link',
    bodyTemplate: 'This connection shows how {sourceLabel} sets {targetLabel} in the analysed scenario. It affects analysis.',
  },
} as const

/** Resolve edge link template with source/target labels. */
export function resolveEdgeLinkTemplate(
  context: { sourceLabel: string; targetLabel: string },
): string {
  return EDGE_LINK_NOTICES.intervention.bodyTemplate
    .replace('{sourceLabel}', context.sourceLabel)
    .replace('{targetLabel}', context.targetLabel)
}

// ─── Edge panel copy (v6.2) ───────────────────────────────────────
export const EDGE_COPY = {
  sensitiveContext: 'Small changes here could shift which option performs best.',
  flipRiskTooltip: (pct: number) =>
    `If this edge's strength changes significantly, there is a ${pct}% probability the leading option would change.`,
  noEvidenceBody: 'Olumi estimated this from your brief. Providing evidence would improve trust.',
  noEvidenceTitle: 'No evidence yet',
  sliderMinUnlikely: 'Unlikely',
  sliderMaxVeryLikely: 'Very likely',
  sliderMinPrecise: 'Precise',
  sliderMaxUncertain: 'Uncertain',
  existenceTooltip: 'How confident are you that this causal link is real?',
} as const

// ─── Baseline / option badges ─────────────────────────────────────
export const BASELINE_BADGE_LABEL = 'Baseline option'

// ─── Action button labels (migrated hardcoded strings) ────────────
export const ACTION_LABELS = {
  addChange:     '+ Add a change',
  addOption:     '+ Add option',
  addConstraint: '+ Add constraint',
  seeAllDrivers: 'See all drivers',
  compareOptions: 'Compare all options',
} as const

// ─── Empty description placeholders ───────────────────────────────
export const DESCRIPTION_PLACEHOLDERS = {
  decision: "What's the decision you're facing and why does it matter now?",
  option:   'What would choosing this option actually mean in practice?',
  goal:     'Describe what achieving this goal looks like for your team.',
  factor:   'What is this factor and why does it matter?',
  outcome:  'What does this outcome represent in your decision?',
  risk:     'What could go wrong and how would it affect the decision?',
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
