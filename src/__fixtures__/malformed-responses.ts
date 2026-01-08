/**
 * Contract Test Fixtures: Malformed Responses
 *
 * Test fixtures for common API response malformation patterns.
 * Used to verify that sanitization and validation logic handles
 * real-world edge cases gracefully.
 *
 * These fixtures represent actual malformation patterns observed
 * in production or potential contract drift scenarios.
 */

// =============================================================================
// V2RunResponse Malformed Fixtures
// =============================================================================

/**
 * Fixture: null where array expected
 *
 * Pattern: Backend returns null instead of empty array for option_comparison
 * Expected behavior: Should trigger soft warning, fallback to empty array
 */
export const V2_OPTION_COMPARISON_NULL = {
  analysis_status: 'computed',
  option_comparison_status: 'computed',
  robustness_status: 'computed',
  drivers_status: 'computed',
  option_comparison: null, // Should be array
  critiques: [],
  response_hash: 'abc123',
}

/**
 * Fixture: missing required field
 *
 * Pattern: Backend omits required response_hash field
 * Expected behavior: Should trigger hard validation error
 */
export const V2_MISSING_RESPONSE_HASH = {
  analysis_status: 'computed',
  option_comparison_status: 'computed',
  robustness_status: 'computed',
  drivers_status: 'computed',
  option_comparison: [],
  critiques: [],
  // response_hash intentionally missing
}

/**
 * Fixture: wrong type for analysis_status
 *
 * Pattern: Backend returns boolean instead of string for analysis_status
 * Expected behavior: Should trigger hard validation error
 */
export const V2_WRONG_TYPE_ANALYSIS_STATUS = {
  analysis_status: true, // Should be string like 'computed' or 'partial'
  option_comparison_status: 'computed',
  robustness_status: 'computed',
  drivers_status: 'computed',
  option_comparison: [],
  critiques: [],
  response_hash: 'abc123',
}

/**
 * Fixture: deeply nested type anomaly
 *
 * Pattern: factor_sensitivity[0].elasticity is string instead of number
 * Expected behavior: Should trigger soft warning, sanitize gracefully
 */
export const V2_NESTED_TYPE_ANOMALY = {
  analysis_status: 'computed',
  option_comparison_status: 'computed',
  robustness_status: 'computed',
  drivers_status: 'computed',
  option_comparison: [
    {
      option_id: 'opt_1',
      option_label: 'Option 1',
      confidence_interval: [0.3, 0.7],
    },
  ],
  critiques: [],
  factor_sensitivity: [
    {
      factor_id: 'factor_1',
      elasticity: 'high', // Should be number like 0.5
      direction: 'positive',
    },
  ],
  response_hash: 'abc123',
}

/**
 * Fixture: critiques is object instead of array
 *
 * Pattern: Backend returns object instead of array for critiques
 * Expected behavior: Should trigger soft warning, fallback to empty array
 */
export const V2_CRITIQUES_OBJECT = {
  analysis_status: 'computed',
  option_comparison_status: 'computed',
  robustness_status: 'computed',
  drivers_status: 'computed',
  option_comparison: [],
  critiques: { error: 'unexpected format' }, // Should be array
  response_hash: 'abc123',
}

/**
 * Fixture: drivers is string instead of array
 *
 * Pattern: Backend returns serialized JSON string instead of array
 * Expected behavior: Should trigger soft warning, fallback to empty array
 */
export const V2_DRIVERS_STRING = {
  analysis_status: 'computed',
  option_comparison_status: 'computed',
  robustness_status: 'computed',
  drivers_status: 'computed',
  option_comparison: [],
  critiques: [],
  drivers: '[{"node_id": "n1"}]', // Should be parsed array
  response_hash: 'abc123',
}

/**
 * Fixture: completely malformed response (not an object)
 *
 * Pattern: Backend returns string or null instead of object
 * Expected behavior: Should trigger hard validation error
 */
export const V2_NOT_OBJECT = 'This is not a valid response'

/**
 * Fixture: null response
 *
 * Pattern: Backend returns null
 * Expected behavior: Should trigger hard validation error
 */
export const V2_NULL_RESPONSE = null

// =============================================================================
// CEE Review Payload Malformed Fixtures
// =============================================================================

/**
 * Fixture: invalid block structure
 *
 * Pattern: Block missing required id field
 * Expected behavior: Should filter out invalid block during sanitization
 */
export const CEE_INVALID_BLOCK = {
  blocks: [
    {
      // id missing
      status: 'ok',
      source: 'analysis',
      content: 'Some content',
    },
    {
      id: 'valid_block',
      status: 'ok',
      source: 'analysis',
      content: 'Valid content',
    },
  ],
  readiness: {
    overall_status: 'ready',
    factors: [],
  },
}

/**
 * Fixture: invalid readiness factor
 *
 * Pattern: Factor with invalid status value
 * Expected behavior: Should filter out invalid factor during sanitization
 */
export const CEE_INVALID_READINESS_FACTOR = {
  blocks: [],
  readiness: {
    overall_status: 'ready',
    factors: [
      {
        label: 'Valid Factor',
        status: 'ok',
      },
      {
        label: 'Invalid Factor',
        status: 'invalid_status', // Should be 'ok', 'warning', or 'blocking'
      },
    ],
  },
}

/**
 * Fixture: blocks is object instead of array
 *
 * Pattern: Backend returns object instead of array for blocks
 * Expected behavior: Should fallback to empty array during sanitization
 */
export const CEE_BLOCKS_OBJECT = {
  blocks: { block1: { id: 'b1' } }, // Should be array
  readiness: {
    overall_status: 'ready',
    factors: [],
  },
}

/**
 * Fixture: readiness.factors is undefined
 *
 * Pattern: Backend omits factors array
 * Expected behavior: Should fallback to empty array during sanitization
 */
export const CEE_MISSING_FACTORS = {
  blocks: [],
  readiness: {
    overall_status: 'ready',
    // factors intentionally missing
  },
}

// =============================================================================
// V2RunError Malformed Fixtures
// =============================================================================

/**
 * Fixture: missing status_reason in error response
 *
 * Pattern: Backend omits required status_reason field in error
 * Expected behavior: Should trigger validation failure for error response
 */
export const V2_ERROR_MISSING_REASON = {
  analysis_status: 'blocked',
  // status_reason intentionally missing
  critiques: [],
}

/**
 * Fixture: critiques is null in error response
 *
 * Pattern: Backend returns null for critiques in error
 * Expected behavior: Should trigger validation failure
 */
export const V2_ERROR_CRITIQUES_NULL = {
  analysis_status: 'blocked',
  status_reason: 'Validation failed',
  critiques: null, // Should be array
}

// =============================================================================
// Pipeline Trace Malformed Fixtures
// =============================================================================

/**
 * Fixture: pipeline trace missing required fields
 *
 * Pattern: Trace missing llm_call_count
 * Expected behavior: Should fail isCeePipelineTrace guard
 */
export const PIPELINE_TRACE_INCOMPLETE = {
  status: 'success',
  total_duration_ms: 1234,
  // llm_call_count intentionally missing
  stages: [],
}

/**
 * Fixture: pipeline stages with wrong status type
 *
 * Pattern: Stage status is number instead of string
 * Expected behavior: Should be detected but may still be usable
 */
export const PIPELINE_TRACE_WRONG_STAGE_STATUS = {
  status: 'success',
  total_duration_ms: 1234,
  llm_call_count: 1,
  stages: [
    {
      name: 'llm_draft',
      status: 1, // Should be string like 'success' or 'failed'
      duration_ms: 1000,
    },
  ],
}

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Get all V2RunResponse malformed fixtures
 */
export function getAllV2MalformedFixtures(): Record<string, unknown> {
  return {
    V2_OPTION_COMPARISON_NULL,
    V2_MISSING_RESPONSE_HASH,
    V2_WRONG_TYPE_ANALYSIS_STATUS,
    V2_NESTED_TYPE_ANOMALY,
    V2_CRITIQUES_OBJECT,
    V2_DRIVERS_STRING,
    V2_NOT_OBJECT,
    V2_NULL_RESPONSE,
  }
}

/**
 * Get all CEE malformed fixtures
 */
export function getAllCeeMalformedFixtures(): Record<string, unknown> {
  return {
    CEE_INVALID_BLOCK,
    CEE_INVALID_READINESS_FACTOR,
    CEE_BLOCKS_OBJECT,
    CEE_MISSING_FACTORS,
  }
}

/**
 * Get all pipeline trace malformed fixtures
 */
export function getAllPipelineTraceMalformedFixtures(): Record<string, unknown> {
  return {
    PIPELINE_TRACE_INCOMPLETE,
    PIPELINE_TRACE_WRONG_STAGE_STATUS,
  }
}
