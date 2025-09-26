/**
 * Run Report v1 TypeScript Types
 * For DecisionGuide AI reporting interface
 */

export interface ReportV1Meta {
  seed: number;
  timestamp: string;
  duration: number; // milliseconds
  route: string;
  totalTokens?: number;
  totalCost?: number;
  model?: string;
  status: 'completed' | 'cancelled' | 'error' | 'timeout';
}

export interface ReportV1Step {
  id: string | number;
  type: 'analysis' | 'generation' | 'validation' | 'processing';
  startTime: number;
  endTime: number;
  duration: number;
  status: 'completed' | 'cancelled' | 'error' | 'skipped';
  tokens?: number;
  cost?: number;
}

export interface ReportV1 {
  version: '1.0';
  meta: ReportV1Meta;
  steps: ReportV1Step[];
  totals: {
    totalSteps: number;
    completedSteps: number;
    totalTokens: number;
    totalCost: number;
    totalDuration: number;
  };
}

export interface RedactionConfig {
  /** Fields to completely remove */
  removeFields?: string[];
  /** Fields to mask (e.g., "***REDACTED***") */
  maskFields?: string[];
  /** Custom masking function */
  customMask?: (value: any) => any;
}