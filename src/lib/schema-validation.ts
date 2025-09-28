/**
 * Schema Validation Middleware
 * Validates request/response data against OpenAPI schemas (dev/test only)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { toPublicError } from './error-normaliser.js';

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Check if schema validation is enabled
 */
function isSchemaValidationEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' &&
         process.env.SCHEMA_VALIDATION_DISABLE !== '1';
}

/**
 * Simple JSON schema validator for basic types and structure
 */
class SimpleSchemaValidator {
  /**
   * Validate a value against a simple schema
   */
  validate(value: any, schema: any, path: string = ''): ValidationResult {
    const errors: ValidationError[] = [];

    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        if (!value || typeof value !== 'object' || !(requiredField in value)) {
          errors.push({
            field: path ? `${path}.${requiredField}` : requiredField,
            message: `Required field '${requiredField}' is missing`,
            value: undefined
          });
        }
      }
    }

    if (schema.properties && typeof value === 'object' && value !== null) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propName in value) {
          const propPath = path ? `${path}.${propName}` : propName;
          const propResult = this.validateProperty(value[propName], propSchema as any, propPath);
          errors.push(...propResult.errors);
        }
      }
    }

    if (schema.type) {
      const typeError = this.validateType(value, schema.type, path);
      if (typeError) {
        errors.push(typeError);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private validateProperty(value: any, schema: any, path: string): ValidationResult {
    return this.validate(value, schema, path);
  }

  private validateType(value: any, expectedType: string, path: string): ValidationError | null {
    const actualType = this.getActualType(value);

    if (expectedType === 'integer' && actualType === 'number' && Number.isInteger(value)) {
      return null; // Integer is valid number
    }

    if (expectedType === 'array' && Array.isArray(value)) {
      return null;
    }

    if (expectedType === actualType) {
      return null;
    }

    return {
      field: path,
      message: `Expected type '${expectedType}' but got '${actualType}'`,
      value
    };
  }

  private getActualType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
}

/**
 * Endpoint schemas for validation
 */
const ENDPOINT_SCHEMAS = {
  // Compare endpoints
  '/compare': {
    request: {
      type: 'object',
      required: ['left', 'right'],
      properties: {
        left: {
          type: 'object',
          required: ['scenarioId', 'seed'],
          properties: {
            scenarioId: { type: 'string' },
            seed: { type: 'integer' },
            budget: { type: 'integer' }
          }
        },
        right: {
          type: 'object',
          required: ['scenarioId', 'seed'],
          properties: {
            scenarioId: { type: 'string' },
            seed: { type: 'integer' },
            budget: { type: 'integer' }
          }
        }
      }
    },
    response: {
      type: 'object',
      required: ['schema', 'left', 'right', 'delta'],
      properties: {
        schema: { type: 'string' },
        left: { type: 'object' },
        right: { type: 'object' },
        delta: { type: 'object' },
        headline: { type: 'string' },
        key_drivers: { type: 'array' }
      }
    }
  },

  '/compare/batch': {
    request: {
      type: 'object',
      required: ['items'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['scenarioId', 'seed'],
            properties: {
              scenarioId: { type: 'string' },
              seed: { type: 'integer' }
            }
          }
        }
      }
    }
  },

  '/compare/sweep': {
    request: {
      type: 'object',
      required: ['baseScenario', 'targetPaths'],
      properties: {
        baseScenario: { type: 'object' },
        targetPaths: {
          type: 'array',
          items: { type: 'string' }
        },
        variations: {
          type: 'array',
          items: { type: 'number' }
        },
        maxVariants: { type: 'integer' }
      }
    }
  },

  '/templates/encode': {
    request: {
      type: 'object',
      required: ['template'],
      properties: {
        template: {
          type: 'object',
          required: ['template_name', 'scenario'],
          properties: {
            template_name: { type: 'string' },
            seed: { type: 'integer' },
            description: { type: 'string' },
            scenario: { type: 'object' }
          }
        }
      }
    }
  },

  '/templates/decode': {
    response: {
      type: 'object',
      required: ['template'],
      properties: {
        template: { type: 'object' }
      }
    }
  },

  // Tenant sessions
  '/pilot/mint-session': {
    request: {
      type: 'object',
      required: ['org', 'plan', 'caps'],
      properties: {
        org: { type: 'string' },
        plan: { type: 'string' },
        caps: { type: 'array' },
        ttlMin: { type: 'integer' }
      }
    }
  },

  // Queue
  '/queue/bump': {
    request: {
      type: 'object',
      required: ['org'],
      properties: {
        org: { type: 'string' },
        reason: { type: 'string' }
      }
    }
  }
};

const validator = new SimpleSchemaValidator();

/**
 * Validate request body against schema
 */
export function validateRequestBody(endpoint: string, body: any): ValidationResult {
  if (!isSchemaValidationEnabled()) {
    return { valid: true, errors: [] };
  }

  const schema = ENDPOINT_SCHEMAS[endpoint as keyof typeof ENDPOINT_SCHEMAS];
  if (!schema?.request) {
    return { valid: true, errors: [] }; // No schema defined = no validation
  }

  return validator.validate(body, schema.request);
}

/**
 * Validate query parameters against schema
 */
export function validateQueryParams(endpoint: string, params: any): ValidationResult {
  if (!isSchemaValidationEnabled()) {
    return { valid: true, errors: [] };
  }

  // Simple validation for known query endpoints
  if (endpoint === '/usage/summary') {
    const errors: ValidationError[] = [];

    if (!params.org || typeof params.org !== 'string') {
      errors.push({
        field: 'org',
        message: 'org parameter required and must be string',
        value: params.org
      });
    }

    if (!params.period || typeof params.period !== 'string') {
      errors.push({
        field: 'period',
        message: 'period parameter required and must be string',
        value: params.period
      });
    }

    return { valid: errors.length === 0, errors };
  }

  if (endpoint === '/queue/status') {
    if (!params.org || typeof params.org !== 'string') {
      return {
        valid: false,
        errors: [{
          field: 'org',
          message: 'org parameter required',
          value: params.org
        }]
      };
    }
  }

  return { valid: true, errors: [] };
}

/**
 * Validate response body against schema (dev/test only)
 */
export function validateResponseBody(endpoint: string, body: any): ValidationResult {
  if (!isSchemaValidationEnabled()) {
    return { valid: true, errors: [] };
  }

  const schema = ENDPOINT_SCHEMAS[endpoint as keyof typeof ENDPOINT_SCHEMAS];
  if (!schema?.response) {
    return { valid: true, errors: [] }; // No schema defined = no validation
  }

  return validator.validate(body, schema.response);
}

/**
 * Middleware function to validate requests
 */
export function schemaValidationMiddleware(endpoint: string, requestBody?: any, queryParams?: any): {
  valid: boolean;
  error?: any;
} {
  if (!isSchemaValidationEnabled()) {
    return { valid: true };
  }

  // Validate request body if provided
  if (requestBody !== undefined) {
    const bodyValidation = validateRequestBody(endpoint, requestBody);
    if (!bodyValidation.valid) {
      const firstError = bodyValidation.errors[0];
      const publicError = toPublicError({
        type: 'BAD_INPUT',
        devDetail: `Request validation failed: ${firstError.message}`,
        field: firstError.field
      });
      return {
        valid: false,
        error: {
          status: 400,
          body: publicError
        }
      };
    }
  }

  // Validate query parameters if provided
  if (queryParams !== undefined) {
    const paramsValidation = validateQueryParams(endpoint, queryParams);
    if (!paramsValidation.valid) {
      const firstError = paramsValidation.errors[0];
      const publicError = toPublicError({
        type: 'BAD_INPUT',
        devDetail: `Query parameter validation failed: ${firstError.message}`,
        field: firstError.field
      });
      return {
        valid: false,
        error: {
          status: 400,
          body: publicError
        }
      };
    }
  }

  return { valid: true };
}

/**
 * Get schema validation status
 */
export function getSchemaValidationStatus(): any {
  return {
    enabled: isSchemaValidationEnabled(),
    environment: process.env.NODE_ENV || 'development',
    disabled_explicitly: process.env.SCHEMA_VALIDATION_DISABLE === '1',
    validated_endpoints: Object.keys(ENDPOINT_SCHEMAS),
    total_schemas: Object.keys(ENDPOINT_SCHEMAS).length
  };
}