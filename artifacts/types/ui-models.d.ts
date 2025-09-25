/**
 * UI View Model Types
 * State shapes for Decision Guide AI UI components
 */

/**
 * Token data for streaming display
 */
export interface UIToken {
  /** Unique token identifier */
  id: string;
  /** Token text content */
  text: string;
  /** Generation timestamp */
  timestamp: number;
}

/**
 * Stream view model for main streaming interface
 */
export interface StreamViewModel {
  /** Current session ID */
  sessionId: string;
  /** Current streaming status */
  status: 'idle' | 'streaming' | 'completed' | 'cancelled' | 'error';
  /** Array of generated tokens */
  tokens: UIToken[];
  /** Final metadata (available when completed) */
  metadata?: {
    /** Total tokens generated */
    totalTokens: number;
    /** Total cost in USD */
    totalCost: number;
    /** Total duration in milliseconds */
    duration: number;
    /** Model identifier */
    model: string;
  };
  /** Error details (if status is 'error') */
  error?: {
    /** Error code */
    code: string;
    /** User-friendly error message */
    message: string;
    /** Technical error details */
    details?: string;
  };
}

/**
 * Job data for progress tracking
 */
export interface UIJob {
  /** Job identifier */
  id: string;
  /** Human-readable job name */
  name: string;
  /** Current job status */
  status: 'pending' | 'running' | 'completed' | 'cancelled' | 'error';
  /** Progress percentage (0-100) */
  progress: number;
  /** Job start time */
  startTime?: number;
  /** Job end time */
  endTime?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Jobs panel view model
 */
export interface JobsViewModel {
  /** Current session ID */
  sessionId: string;
  /** Array of jobs */
  jobs: UIJob[];
}

/**
 * Report step data for UI display
 */
export interface UIReportStep {
  /** Step identifier */
  id: string;
  /** Step type */
  type: 'analysis' | 'generation' | 'validation' | 'processing';
  /** Step duration in milliseconds */
  duration: number;
  /** Step status */
  status: 'completed' | 'cancelled' | 'error';
  /** Tokens used in this step */
  tokens: number;
  /** Cost for this step */
  cost: number;
}

/**
 * Report drawer view model
 */
export interface ReportViewModel {
  /** Report identifier */
  reportId: string;
  /** Report metadata */
  meta: {
    /** Random seed used */
    seed: number;
    /** Report timestamp */
    timestamp: string;
    /** Total duration */
    duration: number;
    /** Final status */
    status: 'completed' | 'cancelled' | 'error';
    /** Model used */
    model: string;
  };
  /** Aggregate totals */
  totals: {
    /** Total tokens used */
    totalTokens: number;
    /** Total cost in USD */
    totalCost: number;
    /** Total number of steps */
    totalSteps: number;
    /** Number of completed steps */
    completedSteps: number;
  };
  /** Processing steps */
  steps: UIReportStep[];
}

/**
 * Global UI state
 */
export interface UIState {
  /** Current stream state */
  stream: StreamViewModel;
  /** Current jobs state */
  jobs: JobsViewModel;
  /** Current report state (if open) */
  report?: ReportViewModel;
  /** UI preferences */
  preferences: {
    /** Theme preference */
    theme: 'light' | 'dark' | 'auto';
    /** Show advanced controls */
    showAdvanced: boolean;
    /** Auto-open report on completion */
    autoOpenReport: boolean;
  };
}
