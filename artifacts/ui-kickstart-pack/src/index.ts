/**
 * DecisionGuide AI UI Kickstart Pack
 * Drop-in pack for Windsurf UI development
 */

// Export SSE Event Types
export * from './sse-events';

// Export Report Types
export * from './report-v1';

// Export Simulation Adapters
export * from './adapters';

// Import ReportV1 for type definitions below
import type { ReportV1 } from './report-v1';

// Export View Model Types
export interface ViewModelBase {
  timestamp: string;
  version: string;
  scenario?: string;
}

export interface StreamViewModel extends ViewModelBase {
  type: 'stream';
  initialState: 'idle' | 'streaming' | 'completed' | 'error' | 'cancelled';
  tokens?: Array<{
    id: string;
    text: string;
    timestamp: number;
    resumed?: boolean;
  }>;
  metadata?: {
    sessionId: string;
    totalTokens: number;
    totalCost: number;
    model: string;
  };
}

export interface JobsViewModel extends ViewModelBase {
  type: 'jobs';
  jobs: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'cancelled' | 'error';
    progress: number;
    timestamp: number;
    error?: string;
  }>;
}

export interface ReportViewModel extends ViewModelBase {
  type: 'report';
  reportId: string;
  status: 'loading' | 'loaded' | 'error' | 'no-data';
  report?: ReportV1;
  error?: string;
}

export type ViewModel = StreamViewModel | JobsViewModel | ReportViewModel;