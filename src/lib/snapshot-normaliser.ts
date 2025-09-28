/**
 * Snapshot Normaliser - Bundle-time guard for required fields
 * Ensures snapshot bundles contain expected fields without altering contracts
 */

/**
 * Ensures report.v1 contains all expected fields for snapshot bundles
 */
export function ensureReportV1Fields(report: any): any {
  if (!report || typeof report !== 'object') {
    return report;
  }

  const normalised = { ...report };

  // Ensure schema field
  if (!normalised.schema) {
    normalised.schema = 'report.v1';
  }

  // Ensure meta object with seed
  if (!normalised.meta) {
    normalised.meta = {};
  }
  if (typeof normalised.meta.seed === 'undefined') {
    normalised.meta.seed = 42; // Safe default
  }

  // Ensure analysis object with confidence
  if (!normalised.analysis) {
    normalised.analysis = {};
  }
  if (!normalised.analysis.confidence) {
    normalised.analysis.confidence = 'MEDIUM';
    normalised.analysis.confidence_method = 'heuristic'; // Additive note
  }

  // Ensure recommendation object
  if (!normalised.recommendation) {
    normalised.recommendation = {};
  }
  if (!normalised.recommendation.primary) {
    normalised.recommendation.primary = 'No recommendation available';
  }

  // Ensure decision object with options
  if (!normalised.decision) {
    normalised.decision = {};
  }
  if (!Array.isArray(normalised.decision.options)) {
    normalised.decision.options = [];
  }

  return normalised;
}

/**
 * Ensures compare.v1 contains all expected fields for snapshot bundles
 */
export function ensureCompareV1Fields(compare: any): any {
  if (!compare || typeof compare !== 'object') {
    return compare;
  }

  const normalised = { ...compare };

  // Ensure schema field
  if (!normalised.schema) {
    normalised.schema = 'compare.v1';
  }

  // Ensure left report has analysis.confidence
  if (normalised.left?.report) {
    normalised.left.report = ensureReportV1Fields(normalised.left.report);
  }

  // Ensure right report has analysis.confidence
  if (normalised.right?.report) {
    normalised.right.report = ensureReportV1Fields(normalised.right.report);
  }

  // Ensure delta object
  if (!normalised.delta) {
    normalised.delta = {};
  }
  if (!normalised.delta.confidence_shift) {
    normalised.delta.confidence_shift = 'NONE';
  }

  return normalised;
}