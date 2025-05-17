// Core types for history management
export interface HistoryState<T> {
  state: T;
  timestamp: number;
  id: string;
  metadata?: {
    type: OperationType;
    description: string;
    batchId?: string;
  };
}

export type OperationType = 
  | 'add_option'
  | 'delete_option'
  | 'update_option'
  | 'add_item'
  | 'delete_item'
  | 'update_item'
  | 'update_score'
  | 'reorder_items'
  | 'batch_operation';

export interface HistoryManager<T> {
  past: HistoryState<T>[];
  present: T | null;
  future: HistoryState<T>[];
  batchId?: string;
}

export interface HistoryOptions {
  maxSize?: number;
  batchDelay?: number;
  debug?: boolean;
}

export interface BatchOperation {
  id: string;
  startTime: number;
  description: string;
}