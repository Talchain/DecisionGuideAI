/**
 * Error Message Catalogue - Central registry for user-facing error messages
 *
 * Maintains legacy error phrases as part of the public contract for PoC.
 * Used by error normaliser to ensure consistent messaging across APIs.
 */

export const ERR_MSG = {
  // Validation - General
  REQUEST_ITEMS_REQUIRED: "Request must include items array",
  BAD_INPUT_SCHEMA: "Request validation failed",

  // Validation - Specific field requirements
  LEFT_RIGHT_SCENARIOS_REQUIRED: "left and right scenarios required",
  SCENARIO_ID_REQUIRED: "scenarioId required",
  SEED_MUST_BE_NUMBER: "seed must be a number",

  // Batch validation
  AT_LEAST_ONE_ITEM_REQUIRED: "At least one item required",
  MAXIMUM_ITEMS_ALLOWED: "Maximum 10 items allowed",
  ITEM_SCENARIO_ID_REQUIRED: "Item 1: scenarioId required",
  ITEM_SEED_MUST_BE_INTEGER: "Item 1: seed must be an integer",
  DUPLICATE_SCENARIO_NOT_ALLOWED: "Duplicate scenarioId not allowed",

  // Export validation
  BASELINE_ITEMS_REQUIRED: "baseline and items parameters required",
  LEFT_RIGHT_RUNID_REQUIRED: "left and right runId parameters required",
  RUN_ID_REQUIRED: "runId parameter required",

  // Resource limits
  NODE_CAP_EXCEEDED: "Scenario too large for pilot (12-node cap)",
  URL_TOO_LARGE: "Share link too large (8 KB maximum)",
  COMPRESSED_PAYLOAD_EXCEEDS: "Compressed payload exceeds size limit",

  // Rate limiting
  RATE_LIMIT_RPM: "Too many requests, please try again shortly",
  QUEUE_FULL: "Queue full",

  // Resource not found
  NOT_FOUND: "not found",
  ONE_OR_BOTH_RUNS_NOT_FOUND: "One or both runs not found",
  SNAPSHOT_NOT_FOUND: "Snapshot metadata for run {runId} not found",

  // Authentication & Authorization
  AUTH_REQUIRED: "Authorisation required",
  AUTHORIZATION_HEADER_REQUIRED: "Authorization header required",
  INVALID_OPS_CONSOLE_TOKEN: "Invalid ops console token",
  INVALID_AUTHORIZATION_FORMAT: "Invalid Authorization format",
  OPS_CONSOLE_TOKEN_NOT_CONFIGURED: "OPS_CONSOLE_TOKEN not configured",

  // Feature toggles
  NOT_ENABLED: "not enabled",
  REQUIRES_TEST_ROUTES: "requires TEST_ROUTES=1",

  // Parameter validation
  ORG_PARAMETER_REQUIRED: "org parameter required",
  PLAN_FIELD_REQUIRED: "plan field required",
  CAPS_FIELD_REQUIRED: "caps field required",
  PERIOD_PARAMETER_REQUIRED: "period parameter required",
  DATA_PARAMETER_REQUIRED: "data parameter is required",

  // Validation ranges
  CAPS_RPM_RANGE: "caps.rpm must be a number between 1 and 1000",
  CAPS_DAILY_TOKENS_RANGE: "caps.daily_tokens must be a number between 1 and 1000000",
  CAPS_MAX_CONCURRENCY_RANGE: "caps.max_concurrency must be a number between 1 and 50",
  TTL_MIN_RANGE: "ttlMin must be between 1 and 1440 minutes",
  PAGE_POSITIVE_INTEGER: "page must be a positive integer",
  LIMIT_RANGE: "limit must be between 1 and 200",
  SINCE_ISO8601: "since must be a valid ISO8601 date",
  ORG_NON_EMPTY: "org must be a non-empty string",
  SEED_VALID_INTEGER: "seed must be a valid integer",
  INVALID_PERIOD_FORMAT: "Invalid period format",

  // Template validation
  TEMPLATE_REQUIRED: "Template is required",
  TEMPLATE_MUST_CONTAIN_SCENARIO: "Template must contain a scenario",
  INVALID_COMPRESSED_DATA_FORMAT: "Invalid compressed data format",

  // Scenario validation
  SCENARIO_TITLE_REQUIRED: "Scenario title is required",
  BOTH_LEFT_RIGHT_SCENARIOS_REQUIRED: "Both left and right scenarios required",
  SCENARIO_SEED_PARAMETERS_REQUIRED: "scenarioId and seed parameters required",

  // System errors
  PILOT_METRICS_NOT_AVAILABLE: "Pilot metrics not available",
  FAILED_TO_LOAD_PILOT_METRICS: "Failed to load pilot metrics",
  FAILED_TO_LOAD_OPERATIONS_CONSOLE: "Failed to load operations console",

  // Export format validation
  VERSION_REQUIRED_IN_EXPORT: "v0.1.0"
} as const;

/**
 * Helper function to get error message by key
 */
export function msg(key: keyof typeof ERR_MSG): string {
  return ERR_MSG[key];
}

/**
 * Template helper for messages with substitutions
 */
export function msgTemplate(template: string, substitutions: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => substitutions[key] || match);
}

/**
 * Type-safe error message keys
 */
export type ErrorMessageKey = keyof typeof ERR_MSG;