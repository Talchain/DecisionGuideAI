// View-model types for the vNext decision map.
//
// The VM is the honesty core: components render ONLY what these models carry,
// and the builders (analysisContext / buildOptionCards / buildRelationshipCard)
// are the single place result-derived claims are gated. Every VM carries
// `provenance` so fixture data can never masquerade as analysis output.

export type VMProvenance = 'live' | 'fixture'

/** Canonical freshness vocabulary, from deriveAnalysisDisplayState. */
export type VNextAnalysisState = 'not_ready' | 'ready_to_analyse' | 'complete' | 'results_stale'

/**
 * Shared analysis context: fail-closed identity + freshness, derived once and
 * consumed by every card builder.
 */
export interface AnalysisContextVM {
  displayState: VNextAnalysisState
  /** A completed report is present (fresh or stale). */
  hasResults: boolean
  /**
   * Results exist but the model changed since the run (displayState
   * 'results_stale'). Claims are RETAINED and rendered dimmed with a
   * "from a previous run" marker + top-strip pill (UI-SEM-076) — never
   * silently stripped, never presented as current.
   */
  isStaleResult: boolean
  /**
   * The producer's recommended option, resolved against the canvas — null
   * unless report.robustness.recommended_option_id names an existing option
   * node AND at least two option nodes are visible. Fail-closed: null means
   * no "Leading" chip, no lead sentence, no "feeds the leading option" line
   * anywhere (UI-SEM-072).
   */
  leadingOptionId: string | null
  /** Label of the resolved leading option (null when leadingOptionId is null). */
  leadingOptionLabel: string | null
  /** The USER success target (store.goalThreshold, user units). Producer
   * goal_node.threshold never substitutes (UI-SEM-071 rule). */
  goalThreshold: number | null
}

export type OptionCardStatus = 'leading' | 'close_second' | 'baseline' | 'behind'

export interface OptionCardVM {
  nodeId: string
  label: string
  /** null pre-analysis or when leader identity is unresolved (fail-closed). */
  status: OptionCardStatus | null
  /**
   * The ONE labelled probability the card may show ("Wins in N% of
   * scenarios") — formatted by formatWinProbability (sub-1% floor, 99.5% cap).
   * null when the producer sent no win_probability for this option.
   */
  winDisplay: string | null
  /** Behind-reason (UI-SEM-073): parity re-derivation of OptionNode's
   * computeBehindReason incl. duplicate suppression. null for the leader,
   * pre-analysis, or when suppressed. */
  keyReason: string | null
  /** Detailed view only: win-probability gap to the leader, in percentage
   * points (positive = behind by). null for the leader / no data. */
  gapToLeaderPp: number | null
  /** Detailed view only, gated on the USER target (UI-SEM-071): formatted
   * goal probability. null when no user target or no producer value. */
  goalFitDisplay: string | null
  /** Mirror of analysis.isStaleResult for result-derived content on this card. */
  isStaleResult: boolean
}

export type EdgePolarity = 'helps' | 'hurts' | 'unknown'

export interface EdgeVisualVM {
  edgeId: string
  /** Structural wiring (decision→option, option→factor, or explicit
   * edge_type 'structural' — StyledEdge's detection mirrored): rendered as a
   * thin neutral line with NO strength/polarity/fragility claims. */
  isStructural: boolean
  signedMean: number
  polarity: EdgePolarity
  /** Unified ladder word (Slight/Moderate/Strong/Very strong); null for
   * structural edges. */
  strengthLabel: string | null
  /** Discrete band width in px, aligned to the strength ladder (UI-SEM-075). */
  strokeWidth: number
  /** CSS colour (design-token var()) for stroke + arrowhead. */
  strokeColor: string
  /** undefined = solid; dash pattern when existence certainty < 0.7
   * (reuses the live existenceCertaintyToLineStyle rule). */
  dashArray: string | undefined
  /** Fragile per the report's robustness.fragile_edges (canonical matcher).
   * Only true when results exist; renders dimmed when stale. */
  isFragile: boolean
  fragileSwitchProbability: number | null
}

export type RelationshipActionKind = 'focus' | 'evidence' | 'challenge' | 'edit'

export interface RelationshipAction {
  kind: RelationshipActionKind
  label: string
  availability: 'wired' | 'disabled'
  /** Shown when disabled, explaining where the action lives. */
  disabledHint?: string
}

export interface RelationshipCardVM {
  edgeId: string
  /** See EdgeVisualVM.isStructural — structural cards carry a wiring
   * description instead of strength/confidence claims. */
  isStructural: boolean
  /** "{Source} strengthens/weakens {Target}" (causal), or the structural
   * wiring description ("Option of this decision", …). */
  sentence: string
  /** Unified ladder word; null for structural edges. */
  strengthLabel: string | null
  /** Signed strength value for Detailed numerals; null for structural. */
  strengthValue: number | null
  /** Confidence words from beliefExists (≥0.70 high / ≥0.40 medium / low —
   * UI-SEM-010/017 precedent thresholds). null when no belief data or
   * structural. */
  confidenceLabel: 'high' | 'medium' | 'low' | null
  confidenceValue: number | null
  /** Real-signal-only coaching line (UI-SEM-074): fragile-edge or
   * leading-option endpoint. null = omit the block entirely, no filler. */
  whyItMatters: string | null
  /** True when whyItMatters derives from analysis results (fragile/leader) —
   * drives the stale dim + "from a previous run" marker. */
  whyIsResultDerived: boolean
  /** Detailed view: switch probability % for the fragile why-line. */
  whyDetailPct: number | null
  /** Evidence statements from edge.data.causal_claims (may be empty). */
  evidence: Array<{ statement: string; source?: string }>
  actions: RelationshipAction[]
  /** Solo-safe prefill for the challenge action (A6); null for structural. */
  challengePrompt: string | null
  isStaleResult: boolean
}

export interface GraphExperienceVM {
  provenance: VMProvenance
  analysis: AnalysisContextVM
  /** Keyed by option node id. */
  optionCards: Record<string, OptionCardVM>
  /** Keyed by edge id. */
  edgeVisuals: Record<string, EdgeVisualVM>
  /** Keyed by edge id. */
  relationshipCards: Record<string, RelationshipCardVM>
}
