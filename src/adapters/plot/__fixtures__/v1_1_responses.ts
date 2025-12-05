/**
 * Golden fixtures for PLoT Engine v1.1 contract
 *
 * These fixtures test the new contract shapes:
 * - Structured confidence object (level, score, reason)
 * - Top-level explain_delta (not nested in result)
 * - Critique with severity tiers (blocker, warning, info)
 * - Provenance data (evidence_coverage, etc.)
 */

/**
 * Complete success response with new v1.1 confidence format
 * High confidence, good evidence coverage, no blockers
 */
export const V1_1_SUCCESS_HIGH_CONFIDENCE = {
  result: {
    answer: '65% growth expected with strong market conditions',
    explanation: 'Analysis based on historical data and market trends indicates strong growth potential.',
    summary: {
      conservative: 0.50,
      likely: 0.65,
      optimistic: 0.80,
      units: 'percent',
    },
    response_hash: 'sha256:abc123def456ghi789',
    seed: 12345,
  },
  // v1.1: Structured confidence object at top level
  confidence: {
    level: 'high' as const,
    score: 0.85,
    reason: 'Strong evidence coverage across key relationships with consistent historical patterns.',
  },
  // v1.1: explain_delta at top level (not nested in result)
  explain_delta: {
    baseline_outcome: { value: 0.50, label: '50% growth' },
    predicted_outcome: { value: 0.65, label: '65% growth' },
    delta: 0.15,
    top_drivers: [
      {
        node_id: 'risk_market_saturation',
        node_label: 'Market saturation',
        node_kind: 'RISK',
        contribution: 45, // 0-100 scale, adapter converts to 0-1
        sign: '-',
        polarity: 'down' as const,
        strength: 'high' as const,
      },
      {
        node_id: 'factor_brand_strength',
        node_label: 'Brand strength',
        node_kind: 'FACTOR',
        contribution: 30,
        sign: '+',
        polarity: 'up' as const,
        strength: 'medium' as const,
      },
      {
        node_id: 'decision_pricing',
        node_label: 'Pricing strategy',
        node_kind: 'DECISION',
        contribution: 15,
        sign: '+',
        polarity: 'up' as const,
        strength: 'low' as const,
      },
    ],
    top_edge_drivers: [
      {
        edge_id: 'risk_market_saturation->outcome_revenue',
        edge_label: 'Market impact on revenue',
        contribution: 25,
        sign: '-',
      },
    ],
  },
  // v1.1: Critique with severity tiers
  critique: [
    {
      level: 'info' as const,
      message: 'Graph has 42 nodes. Sweet spot is 12-25 for clarity.',
      code: 'GRAPH_SIZE_INFO',
    },
    {
      level: 'info' as const,
      message: 'Consider adding more evidence sources for external factors.',
      code: 'EVIDENCE_SUGGESTION',
    },
  ],
  // v1.1: Provenance data
  provenance: {
    evidence_coverage: 0.72,
    total_edges: 25,
    evidenced_edges: 18,
  },
  execution_ms: 450,
}

/**
 * Low confidence response
 * Poor evidence coverage, multiple warnings
 */
export const V1_1_LOW_CONFIDENCE = {
  result: {
    answer: '35% growth possible but high uncertainty',
    explanation: 'Limited data and conflicting signals result in uncertain projections.',
    summary: {
      conservative: 0.15,
      likely: 0.35,
      optimistic: 0.55,
      units: 'percent',
    },
    response_hash: 'sha256:low123conf456hash789',
    seed: 67890,
  },
  // v1.1: Low confidence with detailed reason
  confidence: {
    level: 'low' as const,
    score: 0.35,
    reason: 'Insufficient evidence on key relationships. Multiple assumptions not backed by data.',
  },
  explain_delta: {
    baseline_outcome: { value: 0.30, label: '30% growth' },
    predicted_outcome: { value: 0.35, label: '35% growth' },
    delta: 0.05,
    top_drivers: [
      {
        node_id: 'factor_market_trends',
        node_label: 'Market trends',
        node_kind: 'FACTOR',
        contribution: 60,
        sign: '+',
      },
    ],
  },
  // v1.1: Warnings about confidence issues
  critique: [
    {
      level: 'warning' as const,
      message: 'Low evidence coverage (40%). Consider adding more data sources.',
      code: 'LOW_EVIDENCE',
      suggested_fix: 'Add evidence links to at least 60% of edges',
    },
    {
      level: 'warning' as const,
      message: 'No Risk nodes connected. Consider adding risks for complete analysis.',
      code: 'NO_RISK_NODES',
      suggested_fix: 'Add at least one Risk node',
    },
    {
      level: 'info' as const,
      message: '5 assumptions used without supporting evidence.',
      code: 'ASSUMPTIONS_USED',
    },
  ],
  provenance: {
    evidence_coverage: 0.40,
    total_edges: 15,
    evidenced_edges: 6,
  },
  execution_ms: 320,
}

/**
 * Blocked response - analysis cannot proceed
 * Critical issues that prevent analysis
 */
export const V1_1_BLOCKED = {
  result: {
    answer: 'Analysis blocked due to graph structure issues',
    explanation: 'Cannot complete analysis due to critical graph validation errors.',
    summary: {
      conservative: 0,
      likely: 0,
      optimistic: 0,
      units: 'percent',
    },
    response_hash: 'sha256:blocked123hash456',
    seed: 11111,
  },
  confidence: {
    level: 'low' as const,
    score: 0,
    reason: 'Analysis blocked due to critical graph issues.',
  },
  // v1.1: Multiple blockers preventing analysis
  critique: [
    {
      level: 'blocker' as const,
      message: 'Node "Goal: Revenue" outgoing probabilities sum to 90%, must be 100% +/-1%',
      code: 'PROBABILITY_SUM_INVALID',
      node_id: 'goal_revenue',
      suggested_fix: 'Normalize edge probabilities to sum to 100%',
      auto_fixable: true,
    },
    {
      level: 'blocker' as const,
      message: 'Missing required Decision node. At least one decision point is required.',
      code: 'MISSING_DECISION_NODE',
      suggested_fix: 'Add a Decision node to define the choice being analyzed',
      auto_fixable: false,
    },
    {
      level: 'blocker' as const,
      message: 'Circular dependency detected: A -> B -> C -> A',
      code: 'CYCLE_DETECTED',
      node_id: 'node_a',
      suggested_fix: 'Remove one edge to break the cycle',
      auto_fixable: false,
    },
    {
      level: 'warning' as const,
      message: 'Some nodes are disconnected from the main graph.',
      code: 'ORPHAN_NODES',
      node_id: 'orphan_factor_1',
      suggested_fix: 'Connect orphan nodes or remove them',
    },
  ],
  provenance: {
    evidence_coverage: 0.20,
    total_edges: 10,
    evidenced_edges: 2,
  },
  execution_ms: 50, // Quick because blocked early
}

/**
 * Medium confidence with mixed critique
 * Some warnings, good enough to proceed
 */
export const V1_1_MEDIUM_CONFIDENCE = {
  result: {
    answer: '55% growth expected with moderate uncertainty',
    explanation: 'Analysis shows reasonable confidence with some areas for improvement.',
    summary: {
      conservative: 0.40,
      likely: 0.55,
      optimistic: 0.70,
      units: 'percent',
    },
    response_hash: 'sha256:medium123conf456hash789',
    seed: 33333,
  },
  confidence: {
    level: 'medium' as const,
    score: 0.65,
    reason: 'Reasonable evidence coverage but some key relationships lack supporting data.',
  },
  explain_delta: {
    baseline_outcome: { value: 0.45, label: '45% growth' },
    predicted_outcome: { value: 0.55, label: '55% growth' },
    delta: 0.10,
    top_drivers: [
      {
        node_id: 'factor_customer_retention',
        node_label: 'Customer retention',
        node_kind: 'FACTOR',
        contribution: 40,
        sign: '+',
      },
      {
        node_id: 'risk_competition',
        node_label: 'Competitive pressure',
        node_kind: 'RISK',
        contribution: 35,
        sign: '-',
      },
    ],
  },
  critique: [
    {
      level: 'warning' as const,
      message: 'Decision nodes should come before outcomes in causal flow.',
      code: 'DECISION_AFTER_OUTCOME',
      suggested_fix: 'Restructure graph so decisions precede outcomes',
    },
    {
      level: 'info' as const,
      message: 'Graph structure looks reasonable. Consider adding sensitivity analysis.',
      code: 'GRAPH_OK',
    },
  ],
  provenance: {
    evidence_coverage: 0.58,
    total_edges: 20,
    evidenced_edges: 12,
  },
  execution_ms: 380,
}

// Type exports for test assertions
export type V1_1_Response = typeof V1_1_SUCCESS_HIGH_CONFIDENCE
export type CritiqueLevel = 'blocker' | 'warning' | 'info'
export type ConfidenceLevel = 'high' | 'medium' | 'low'

/**
 * Helper to extract blockers from critique array
 */
export function getBlockers(critique: Array<{ level: string }>): Array<{ level: string }> {
  return critique.filter(c => c.level === 'blocker')
}

/**
 * Helper to check if response is blocked
 */
export function isBlocked(critique: Array<{ level: string }>): boolean {
  return getBlockers(critique).length > 0
}
