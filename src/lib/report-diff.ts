/**
 * Report Diff Utility for Compare API
 * Compares two Report v1 structures and generates human-readable summaries
 */

interface ReportV1 {
  decision: {
    title: string;
    options: Array<{
      id: string;
      name: string;
      score: number;
      description: string;
    }>;
  };
  recommendation: {
    primary: string;
  };
  analysis: {
    confidence: string;
  };
  meta: {
    scenarioId: string;
    seed: number;
    timestamp: string;
  };
  ranges?: {
    most_likely?: number;
    confidence_lower?: number;
    confidence_upper?: number;
  };
  threshold_crossings?: Array<{
    threshold: number;
    crossed: boolean;
    direction: 'up' | 'down';
  }>;
}

interface ComparisonDelta {
  most_likely_diff: number;
  most_likely_pct: number;
  confidence_shift: 'NONE' | 'UP' | 'DOWN';
  threshold_events: Array<{
    threshold: number;
    event: string;
    significance: 'minor' | 'major';
  }>;
}

interface ComparisonResult {
  schema: string;
  left: {
    scenarioId: string;
    runId: string;
    report: ReportV1;
  };
  right: {
    scenarioId: string;
    runId: string;
    report: ReportV1;
  };
  delta: ComparisonDelta;
  headline: string;
  key_drivers: string[];
}

/**
 * Compare two Report v1 instances and generate diff summary
 */
export function compareReports(
  leftReport: ReportV1,
  rightReport: ReportV1,
  leftRunId: string,
  rightRunId: string
): ComparisonResult {
  const delta = calculateDelta(leftReport, rightReport);
  const headline = generateHeadline(delta, leftReport, rightReport);
  const keyDrivers = identifyKeyDrivers(leftReport, rightReport, delta);

  return {
    schema: 'compare.v1',
    left: {
      scenarioId: leftReport.meta.scenarioId,
      runId: leftRunId,
      report: leftReport
    },
    right: {
      scenarioId: rightReport.meta.scenarioId,
      runId: rightRunId,
      report: rightReport
    },
    delta,
    headline,
    key_drivers: keyDrivers
  };
}

/**
 * Calculate numerical and categorical differences between reports
 */
function calculateDelta(left: ReportV1, right: ReportV1): ComparisonDelta {
  const leftMostLikely = left.ranges?.most_likely ?? 0;
  const rightMostLikely = right.ranges?.most_likely ?? 0;

  const mostLikelyDiff = rightMostLikely - leftMostLikely;
  const mostLikelyPct = leftMostLikely !== 0 ? mostLikelyDiff / leftMostLikely : 0;

  // Compare confidence levels
  const confidenceShift = compareConfidence(left.analysis.confidence, right.analysis.confidence);

  // Compare threshold crossings
  const thresholdEvents = compareThresholds(
    left.threshold_crossings ?? [],
    right.threshold_crossings ?? []
  );

  return {
    most_likely_diff: Math.round(mostLikelyDiff),
    most_likely_pct: Number(mostLikelyPct.toFixed(4)),
    confidence_shift: confidenceShift,
    threshold_events: thresholdEvents
  };
}

/**
 * Compare confidence levels between reports
 */
function compareConfidence(leftConf: string, rightConf: string): 'NONE' | 'UP' | 'DOWN' {
  const confidenceOrder = ['low', 'medium', 'high', 'very high'];

  const leftIndex = confidenceOrder.findIndex(c => leftConf.toLowerCase().includes(c));
  const rightIndex = confidenceOrder.findIndex(c => rightConf.toLowerCase().includes(c));

  if (leftIndex === -1 || rightIndex === -1) return 'NONE';

  if (rightIndex > leftIndex) return 'UP';
  if (rightIndex < leftIndex) return 'DOWN';
  return 'NONE';
}

/**
 * Compare threshold crossings between reports
 */
function compareThresholds(
  leftThresholds: Array<{ threshold: number; crossed: boolean; direction: 'up' | 'down' }>,
  rightThresholds: Array<{ threshold: number; crossed: boolean; direction: 'up' | 'down' }>
): Array<{ threshold: number; event: string; significance: 'minor' | 'major' }> {
  const events: Array<{ threshold: number; event: string; significance: 'minor' | 'major' }> = [];

  // Find thresholds that changed crossing status
  for (const leftThreshold of leftThresholds) {
    const rightThreshold = rightThresholds.find(rt => rt.threshold === leftThreshold.threshold);

    if (rightThreshold && leftThreshold.crossed !== rightThreshold.crossed) {
      const event = rightThreshold.crossed
        ? `Threshold ${rightThreshold.threshold} crossed going ${rightThreshold.direction}`
        : `Threshold ${leftThreshold.threshold} no longer crossed`;

      const significance = leftThreshold.threshold > 10000 ? 'major' : 'minor';

      events.push({
        threshold: leftThreshold.threshold,
        event,
        significance
      });
    }
  }

  return events;
}

/**
 * Generate human-readable headline in British English
 */
function generateHeadline(delta: ComparisonDelta, left: ReportV1, right: ReportV1): string {
  const { most_likely_diff, most_likely_pct } = delta;

  if (Math.abs(most_likely_pct) < 0.001) {
    return 'No significant difference between scenarios';
  }

  const direction = most_likely_diff > 0 ? 'up' : 'down';
  const pctStr = `${Math.abs(most_likely_pct * 100).toFixed(1)}%`;

  if (Math.abs(most_likely_pct) < 0.05) {
    return `Marginal difference: ${direction} ~${pctStr} in Right vs Left`;
  } else if (Math.abs(most_likely_pct) < 0.15) {
    return `Moderate improvement: ${direction} ~${pctStr} in Right vs Left`;
  } else {
    return `Significant change: ${direction} ~${pctStr} in Right vs Left`;
  }
}

/**
 * Identify key drivers of difference between scenarios
 */
function identifyKeyDrivers(left: ReportV1, right: ReportV1, delta: ComparisonDelta): string[] {
  const drivers: string[] = [];

  // Analyse option score differences
  const leftOptions = left.decision.options;
  const rightOptions = right.decision.options;

  // Find options that improved significantly
  for (const rightOption of rightOptions) {
    const leftOption = leftOptions.find(lo => lo.id === rightOption.id);

    if (leftOption && rightOption.score > leftOption.score + 0.1) {
      drivers.push(`Improved ${rightOption.name.toLowerCase()}`);
    } else if (leftOption && rightOption.score < leftOption.score - 0.1) {
      drivers.push(`Reduced ${rightOption.name.toLowerCase()}`);
    }
  }

  // Add confidence-based drivers
  if (delta.confidence_shift === 'UP') {
    drivers.push('Higher confidence in analysis');
  } else if (delta.confidence_shift === 'DOWN') {
    drivers.push('Lower confidence in analysis');
  }

  // Add threshold-based drivers
  for (const event of delta.threshold_events) {
    if (event.significance === 'major') {
      drivers.push(`Major threshold change at ${event.threshold}`);
    }
  }

  // Default drivers if none identified
  if (drivers.length === 0) {
    if (Math.abs(delta.most_likely_pct) > 0.01) {
      drivers.push('Different scenario parameters');
    } else {
      drivers.push('Minor analytical variations');
    }
  }

  // Limit to top 3 drivers and ensure British English
  return drivers.slice(0, 3).map(driver =>
    driver.charAt(0).toUpperCase() + driver.slice(1)
  );
}