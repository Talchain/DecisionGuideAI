/**
 * Error Normaliser - Maps validation details to public catalogue phrases
 *
 * Ensures consistent user-facing error messages while preserving taxonomy codes.
 * Internal validation details are kept for logging but not exposed externally.
 */

import { ERR_MSG, msgTemplate, type ErrorMessageKey } from './error-messages.js';

export interface PublicError {
  type: string;
  message: string;
  retryable?: boolean;
  timestamp?: string;
}

export interface ErrorInput {
  type: string;
  http?: number;
  devDetail?: string;
  field?: string;
}

/**
 * Maps validation details to public error messages using the catalogue
 */
export function toPublicError(input: ErrorInput): PublicError {
  const { type, devDetail = '', field = '' } = input;

  // Base error structure
  const error: PublicError = {
    type,
    message: getPublicMessage(type, devDetail, field),
    timestamp: new Date().toISOString()
  };

  // Add retryable flag for rate limiting errors
  if (type === 'RATE_LIMIT') {
    error.retryable = true;
  }

  return error;
}

/**
 * Maps error type and validation details to catalogue message
 */
function getPublicMessage(type: string, devDetail: string, field: string): string {
  // Handle specific field validation errors first
  if (type === 'BAD_INPUT') {
    // Check for ops console specific errors first
    if (devDetail.includes('Operations console not enabled')) {
      return ERR_MSG.NOT_ENABLED;
    }
    if (devDetail.includes('Authorization header required')) {
      return ERR_MSG.AUTHORIZATION_HEADER_REQUIRED;
    }
    if (devDetail.includes('Invalid ops console token')) {
      return ERR_MSG.INVALID_OPS_CONSOLE_TOKEN;
    }
    if (devDetail.includes('Invalid Authorization format')) {
      return ERR_MSG.INVALID_AUTHORIZATION_FORMAT;
    }
    if (devDetail.includes('OPS_CONSOLE_TOKEN not configured')) {
      return ERR_MSG.OPS_CONSOLE_TOKEN_NOT_CONFIGURED;
    }

    return mapValidationError(devDetail, field);
  }

  // Handle other error types
  switch (type) {
    case 'RATE_LIMIT':
      return ERR_MSG.RATE_LIMIT_RPM;

    case 'RESOURCE_LIMIT':
      if (devDetail.includes('node') || devDetail.includes('cap')) {
        return ERR_MSG.NODE_CAP_EXCEEDED;
      }
      if (devDetail.includes('size') || devDetail.includes('8 KB')) {
        return ERR_MSG.URL_TOO_LARGE;
      }
      if (devDetail.includes('compressed') || devDetail.includes('payload')) {
        return ERR_MSG.COMPRESSED_PAYLOAD_EXCEEDS;
      }
      return ERR_MSG.BAD_INPUT_SCHEMA;

    case 'NOT_FOUND':
      if (devDetail.includes('run') && devDetail.includes('metadata')) {
        return msgTemplate(ERR_MSG.SNAPSHOT_NOT_FOUND, { runId: extractRunId(devDetail) });
      }
      if (devDetail.includes('One or both runs')) {
        return ERR_MSG.ONE_OR_BOTH_RUNS_NOT_FOUND;
      }
      return ERR_MSG.NOT_FOUND;

    case 'QUEUE_FULL':
      return ERR_MSG.QUEUE_FULL;

    case 'UNAUTHORIZED':
      if (devDetail.includes('Authorization header')) {
        return ERR_MSG.AUTHORIZATION_HEADER_REQUIRED;
      }
      if (devDetail.includes('console token')) {
        return ERR_MSG.INVALID_OPS_CONSOLE_TOKEN;
      }
      if (devDetail.includes('Authorization format')) {
        return ERR_MSG.INVALID_AUTHORIZATION_FORMAT;
      }
      if (devDetail.includes('not configured')) {
        return ERR_MSG.OPS_CONSOLE_TOKEN_NOT_CONFIGURED;
      }
      return ERR_MSG.AUTHORIZATION_HEADER_REQUIRED;

    case 'FEATURE_DISABLED':
      if (devDetail.includes('TEST_ROUTES')) {
        return ERR_MSG.REQUIRES_TEST_ROUTES;
      }
      return ERR_MSG.NOT_ENABLED;

    case 'SYSTEM_ERROR':
      if (devDetail.includes('pilot metrics')) {
        return ERR_MSG.PILOT_METRICS_NOT_AVAILABLE;
      }
      if (devDetail.includes('operations console')) {
        return ERR_MSG.FAILED_TO_LOAD_OPERATIONS_CONSOLE;
      }
      return ERR_MSG.FAILED_TO_LOAD_PILOT_METRICS;

    default:
      return ERR_MSG.BAD_INPUT_SCHEMA;
  }
}

/**
 * Maps specific validation errors to appropriate catalogue messages
 */
function mapValidationError(devDetail: string, field: string): string {
  const detail = devDetail.toLowerCase();
  const fieldLower = field.toLowerCase();


  // Handle item-specific errors first for specificity
  if (detail.includes('item 1')) {
    if (detail.includes('scenarioid')) {
      return ERR_MSG.ITEM_SCENARIO_ID_REQUIRED;
    }
    if (detail.includes('seed')) {
      return ERR_MSG.ITEM_SEED_MUST_BE_INTEGER;
    }
  }

  // Handle missing required fields
  if (detail.includes('missing') || detail.includes('required')) {
    if (detail.includes('template is required')) {
      return ERR_MSG.TEMPLATE_REQUIRED;
    }
    if (detail.includes('data parameter is required')) {
      return ERR_MSG.DATA_PARAMETER_REQUIRED;
    }
    if (fieldLower.includes('items') || detail.includes('items') || detail.includes('\'items\'')) {
      return ERR_MSG.REQUEST_ITEMS_REQUIRED;
    }
    if (fieldLower.includes('scenarioid') || detail.includes('scenarioid') || detail.includes('\'scenarioid\'')) {
      return ERR_MSG.SCENARIO_ID_REQUIRED;
    }
    if (fieldLower.includes('left') || fieldLower.includes('right') || detail.includes('left and right') || detail.includes('\'left\'') || detail.includes('\'right\'')) {
      return ERR_MSG.LEFT_RIGHT_SCENARIOS_REQUIRED;
    }
    if (fieldLower.includes('runid')) {
      if (detail.includes('left and right')) {
        return ERR_MSG.LEFT_RIGHT_RUNID_REQUIRED;
      }
      return ERR_MSG.RUN_ID_REQUIRED;
    }
    if (fieldLower.includes('org')) {
      return ERR_MSG.ORG_PARAMETER_REQUIRED;
    }
    if (fieldLower.includes('plan')) {
      return ERR_MSG.PLAN_FIELD_REQUIRED;
    }
    if (fieldLower.includes('caps')) {
      return ERR_MSG.CAPS_FIELD_REQUIRED;
    }
    if (fieldLower.includes('period')) {
      return ERR_MSG.PERIOD_PARAMETER_REQUIRED;
    }
    if (fieldLower.includes('data')) {
      return ERR_MSG.DATA_PARAMETER_REQUIRED;
    }
    if (fieldLower.includes('template')) {
      return ERR_MSG.TEMPLATE_REQUIRED;
    }
    if (fieldLower.includes('baseline') || fieldLower.includes('items')) {
      return ERR_MSG.BASELINE_ITEMS_REQUIRED;
    }
    if (detail.includes('scenario') && detail.includes('seed')) {
      return ERR_MSG.SCENARIO_SEED_PARAMETERS_REQUIRED;
    }
    if (detail.includes('both left and right')) {
      return ERR_MSG.BOTH_LEFT_RIGHT_SCENARIOS_REQUIRED;
    }
  }

  // Handle type validation errors
  if (detail.includes('type') || detail.includes('expected')) {
    if (fieldLower.includes('seed') || detail.includes('integer')) {
      if (detail.includes('item 1')) {
        return ERR_MSG.ITEM_SEED_MUST_BE_INTEGER;
      }
      if (detail.includes('valid integer')) {
        return ERR_MSG.SEED_VALID_INTEGER;
      }
      return ERR_MSG.SEED_MUST_BE_NUMBER;
    }
  }

  // Handle array/list validation
  if (detail.includes('empty') && fieldLower.includes('items')) {
    return ERR_MSG.AT_LEAST_ONE_ITEM_REQUIRED;
  }

  // Handle size limits
  if (detail.includes('maximum') || detail.includes('too many')) {
    if (detail.includes('10') || detail.includes('items')) {
      return ERR_MSG.MAXIMUM_ITEMS_ALLOWED;
    }
  }

  // Handle duplicates
  if (detail.includes('duplicate')) {
    return ERR_MSG.DUPLICATE_SCENARIO_NOT_ALLOWED;
  }

  // Handle range validations
  if (detail.includes('between') || detail.includes('range')) {
    if (detail.includes('rpm')) {
      return ERR_MSG.CAPS_RPM_RANGE;
    }
    if (detail.includes('daily_tokens')) {
      return ERR_MSG.CAPS_DAILY_TOKENS_RANGE;
    }
    if (detail.includes('max_concurrency')) {
      return ERR_MSG.CAPS_MAX_CONCURRENCY_RANGE;
    }
    if (detail.includes('ttlmin')) {
      return ERR_MSG.TTL_MIN_RANGE;
    }
    if (detail.includes('limit')) {
      return ERR_MSG.LIMIT_RANGE;
    }
  }

  // Handle specific format requirements
  if (detail.includes('positive integer')) {
    return ERR_MSG.PAGE_POSITIVE_INTEGER;
  }
  if (detail.includes('iso8601')) {
    return ERR_MSG.SINCE_ISO8601;
  }
  if (detail.includes('non-empty string')) {
    return ERR_MSG.ORG_NON_EMPTY;
  }
  if (detail.includes('period format')) {
    return ERR_MSG.INVALID_PERIOD_FORMAT;
  }
  if (detail.includes('compressed data')) {
    return ERR_MSG.INVALID_COMPRESSED_DATA_FORMAT;
  }

  // Handle scenario validation
  if (detail.includes('scenario title is required')) {
    return ERR_MSG.SCENARIO_TITLE_REQUIRED;
  }

  // Handle size and complexity limits
  if (detail.includes('scenario too large for pilot') || (detail.includes('node') && detail.includes('cap'))) {
    return ERR_MSG.NODE_CAP_EXCEEDED;
  }
  if (detail.includes('compressed payload exceeds')) {
    return ERR_MSG.COMPRESSED_PAYLOAD_EXCEEDS;
  }

  // Handle template validation
  if (detail.includes('scenario') && detail.includes('template')) {
    return ERR_MSG.TEMPLATE_MUST_CONTAIN_SCENARIO;
  }

  // Default fallback
  return ERR_MSG.BAD_INPUT_SCHEMA;
}

/**
 * Extracts run ID from error detail for template substitution
 */
function extractRunId(devDetail: string): string {
  const match = devDetail.match(/run\s+([\w-]+)/);
  return match ? match[1] : 'unknown';
}