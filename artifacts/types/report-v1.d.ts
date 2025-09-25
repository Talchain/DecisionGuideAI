/**
 * Report v1 TypeScript Types
 * Generated from OpenAPI specification and existing interfaces
 */

export interface ReportV1Meta {
  /** Random seed for reproducibility */
  seed: number;
  /** ISO 8601 timestamp of when the report was generated */
  timestamp: string;
  /** Total duration in milliseconds */
  duration: number;
  /** API route that generated this report */
  route: string;
  /** Total tokens used (optional) */
  totalTokens?: number;
  /** Total cost in USD (optional) */
  totalCost?: number;
  /** Model identifier used */
  model?: string;
  /** Final status of the report */
  status: 'completed' | 'cancelled' | 'error' | 'timeout';
}

export interface ReportV1Step {
  /** Unique step identifier */
  id: string | number;
  /** Type of processing step */
  type: 'analysis' | 'generation' | 'validation' | 'processing';
  /** Step start time (Unix timestamp) */
  startTime: number;
  /** Step end time (Unix timestamp) */
  endTime: number;
  /** Step duration in milliseconds */
  duration: number;
  /** Step completion status */
  status: 'completed' | 'cancelled' | 'error' | 'skipped';
  /** Tokens consumed by this step */
  tokens?: number;
  /** Cost for this step in USD */
  cost?: number;
}

export interface ReportV1Totals {
  /** Total number of steps planned */
  totalSteps: number;
  /** Number of completed steps */
  completedSteps: number;
  /** Sum of all tokens used */
  totalTokens: number;
  /** Sum of all costs in USD */
  totalCost: number;
  /** Total duration across all steps in milliseconds */
  totalDuration: number;
}

export interface ReportV1 {
  /** Schema version */
  version: '1.0';
  /** Report metadata */
  meta: ReportV1Meta;
  /** Processing steps */
  steps: ReportV1Step[];
  /** Aggregate totals */
  totals: ReportV1Totals;
}

export interface RedactionConfig {
  /** Fields to completely remove from output */
  removeFields?: string[];
  /** Fields to mask with placeholder text */
  maskFields?: string[];
  /** Custom masking text (default: "***REDACTED***") */
  maskText?: string;
}

/**
 * API Response wrapper for Report v1
 */
export interface ReportV1Response {
  success: boolean;
  data?: ReportV1;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  timestamp: string;
}

/**
 * Report request parameters
 */
export interface ReportV1Request {
  /** Session ID to fetch report for */
  sessionId: string;
  /** Optional redaction configuration */
  redaction?: RedactionConfig;
}
