/**
 * Inspector v2 - centralised string table
 * All user-facing labels. Exact strings from spec §3. No deviation.
 */

import type { NodeType, FactorCategory } from '../../domain/nodes'
import { classifyValueProvenance, type ValueProvenanceKind } from '../../domain/valueProvenance'

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

/** Edge type label - always "Relationship" in user-facing UI */
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

/**
 * ROADMAP 2.638 S2 — the user-owned arm of both label functions, derived.
 *
 * These three inspector panels are DEPLOYED-MOUNTED (`USE_INSPECTOR_V2` is a
 * hardcoded `true`; no flag gates them), and before this both functions sent
 * every user-owned source they did not literally list to their DEFAULT arm:
 * `getExtractionLabel('user_confirmed')` returned **"Estimated by Olumi"** —
 * the machine claiming a number the user had explicitly confirmed — and
 * `getProvenanceLabel('user_confirmed')` leaked the raw wire literal as
 * "Source: user_confirmed".
 *
 * The map is TOTAL over `ValueProvenanceKind`: adding a kind to the canonical
 * classification is a type error here, never a silent fallback (trap 12). The
 * copy register is this surface's own — sentences, not the Model tab's terse
 * pills — which is why the kind, not the string, is what is shared.
 *
 * "Confirmed by you" states a STATUS and nothing else. Confirming does not
 * change the analysis today (that is the compute slice, S4) and the copy must
 * not imply it does.
 */
const USER_OWNED_LABEL: Record<ValueProvenanceKind, string | null> = {
  confirmed: 'Confirmed by you',
  edited: 'Set by you',
  assumption: 'Your assumption',
  human: 'Set by you',
  // Producer kinds keep each function's own pre-existing copy — see below.
  brief: null,
  ai: null,
}

/** The user-owned label for a source, or null when the producer owns it. */
function userOwnedLabelFor(source: string): string | null {
  const cls = classifyValueProvenance(source)
  if (!cls?.userOwned) return null
  return USER_OWNED_LABEL[cls.kind]
}

// ─── Provenance labels (spec §3.4) ────────────────────────────────
export function getProvenanceLabel(source?: string): string {
  if (!source) return 'No evidence yet'
  const userOwned = userOwnedLabelFor(source)
  if (userOwned) return userOwned
  switch (source) {
    case 'brief_extraction': return 'Generated from your brief'
    case 'explicit':         return 'From your brief'
    case 'cee_inference':    return 'Estimated by Olumi'
    case 'inferred':         return 'Estimated by Olumi'
    case 'cee_repair':       return 'Generated from your brief (adjusted during validation)'
    case 'ai-suggested':     return 'Generated from your brief'
    case 'default':          return 'No evidence yet'
    default:                 return source.startsWith('evidence:') ? `Based on ${source.slice(9)}` : `Source: ${source}`
  }
}

/** Extraction type user-facing labels */
export function getExtractionLabel(source?: string): string {
  if (!source) return 'Estimated by Olumi'
  const userOwned = userOwnedLabelFor(source)
  if (userOwned) return userOwned
  switch (source) {
    case 'brief_extraction': return 'From your brief'
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

// `getStrengthDescription(signedValue)` — DELETED (ROADMAP 2.950). It built the
// literal string "Strong positive" from `signedValue >= 0`, i.e. read a
// DIRECTION CLAIM off the sign of a number `resolveEdgeSignedStrengthDisplay`
// may have signed from a defaulted `direction` — the 2.263/2.935 defect class,
// as a utility waiting for a caller. Verified at the bytes before removal: its
// ONLY import was `edges/StyledEdge.tsx`, which never called it (the KNOWN
// SURVIVORS list in `domain/edgeValueProvenance.ts` recorded it as rendered;
// that entry was stale and is corrected in the same change). If you need a
// directional strength sentence, use `getDirectionalStrengthLabel`
// (`components/model-tab/strengthBands.ts`), which takes a resolved
// `EdgeDirectionDisplay` and cannot fabricate the direction.

// ─── Empty states (DS v4 §16) ──────────────────────────────────────
export const EMPTY_STATES = {
  noAnalysis:       'Run your first simulation to see results',
  noInterventions:  'This option doesn\'t change any factors yet',
  noThreshold:      'Adding a specific target unlocks probability calculations',
  noEvidence:       'No calibration or external data. Providing evidence would improve trust in this connection.',
  noInboundConnections: 'No inbound connections yet.',
  noPrediction:     'No prediction available',
} as const

// ─── Group labels (v6.2 three-group layout) ───────────────────────
// Quiet headers for the Context / Your input / Connections layout.
export const GROUP_LABELS = {
  context:         'Context',
  input:           'Your input',
  connections:     'Connections',
  whatDrivesThis:  'What drives this',
  evidence:        'Evidence',
  impact:          'Impact',
  comparison:      'Comparison',
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
  // Risk probability × impact editing surface (P1.7).
  riskLikelihood: 'Likelihood',
  riskImpact: 'Impact',
  riskNotSet: 'Not set. Click to enter.',
  riskImpactNotSet: 'Not set.',
  riskSeverity: 'Severity',
  riskExposureHint: 'Likelihood and impact define this risk. Editing them re-runs cleanly against the analysis.',
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
  sliderMinUnlikely: 'Unlikely',
  sliderMaxVeryLikely: 'Very likely',
  sliderMinPrecise: 'Precise',
  sliderMaxUncertain: 'Uncertain',
  existenceTooltip: 'How confident are you that this causal link is real?',
  sliderStrongNegative: 'Strong negative',
  sliderNoEffect: 'No effect',
  sliderStrongPositive: 'Strong positive',
  needsYourJudgement: 'Needs your judgement',
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

// ─── Goal panel strings ──────────────────────────────────────────
export const GOAL_STRINGS = {
  impactUnavailable: 'Probability data unavailable for this analysis run.',
} as const

// ─── Option panel strings ────────────────────────────────────────
export const OPTION_STRINGS = {
  impactUnavailable: 'Option impact data unavailable for this analysis run.',
} as const

// --- Goal constraint UI copy -------------------------------------------
// All user-facing strings for GoalPanel constraint section.
export const GOAL_CONSTRAINT_COPY = {
  extractedFromBrief: (count: number) =>
    `${count} constraint${count !== 1 ? 's' : ''} extracted from your brief`,
  selectFactor:        'Select a factor...',
  alreadyConstrained:  '(already constrained)',
  targetValue:         'Target value',
  operatorLabel:       'Constraint operator',
  factorLabel:         'Constraint target factor',
  valueInputLabel:     'Constraint target value',
  addButton:           'Add',
  cancelButton:        'Cancel',
  errorSelectFactor:   'Select a factor',
  errorInvalidNumber:  'Enter a valid number',
  jointProbability:    'Chance of hitting every target',
  addConstraintButton: '+ Add constraint',
  runForProbability:   'Run the simulation to see the probability of reaching this target.',
  targetUnlocks:       'Adding a specific target unlocks probability calculations.',
  // Canonical State Copy (see DESIGN_SYSTEM.md): honest status for GUEST
  // sessions. A guest's canvas graph lives only in the browser — the client
  // RPC write path is RLS-gated and silently swallows a guest's writes, so a
  // constraint typed into THIS panel never reaches the server graph that CEE's
  // run_analysis reads. The working alternative is chat: CEE's add_constraint
  // handler persists server-side regardless of auth, so a guest's chat-entered
  // constraints ARE analysed. Authenticated users' panel edits persist too, so
  // they never see this. Owned here; pinned as a raw literal in specs.
  guestConstraintsNotInAnalysis:
    "In guest mode, constraints added here aren't included in the analysis. Add them in chat instead.",
} as const
