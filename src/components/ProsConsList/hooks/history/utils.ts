import { HistoryState, OperationType, BatchOperation } from './types';
import { MAX_HISTORY_SIZE } from './constants';

export function isValidHistoryState<T>(state: any): state is HistoryState<T> {
  return (
    state &&
    typeof state === 'object' &&
    'state' in state &&
    'timestamp' in state &&
    'id' in state &&
    typeof state.timestamp === 'number' &&
    typeof state.id === 'string'
  );
}

export function createHistoryState<T>(
  state: T,
  type: OperationType,
  description: string = '',
  batchId?: string
): HistoryState<T> {
  if (!state) {
    throw new Error('Cannot create history state from undefined or null');
  }

  // Deep clone to prevent reference issues
  const clonedState = structuredClone(state);

  return {
    state: clonedState,
    timestamp: Date.now(),
    id: generateId(),
    metadata: {
      type,
      description,
      batchId
    }
  };
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function trimHistory<T>(history: HistoryState<T>[]): HistoryState<T>[] {
  return history.slice(-MAX_HISTORY_SIZE);
}

export function shouldBatchOperations(
  lastOperation: HistoryState<any> | null,
  currentBatch: BatchOperation | null,
  batchDelay: number
): boolean {
  if (!lastOperation?.metadata?.batchId || !currentBatch) return false;
  
  const timeDiff = Date.now() - currentBatch.startTime;
  return (
    timeDiff < batchDelay &&
    lastOperation.metadata.batchId === currentBatch.id
  );
}

export function hasStateChanged<T>(oldState: T, newState: T): boolean {
  if (oldState === newState) return false;
  try {
    return JSON.stringify(oldState) !== JSON.stringify(newState);
  } catch (error) {
    console.warn('Error comparing states:', error);
    return true;
  }
}

function createBatchOperation(description: string = 'Batch operation'): BatchOperation {
  return {
    id: generateId(),
    startTime: Date.now(),
    description
  };
}

export function debugLog(message: string, data?: any, debug = false): void {
  if (!debug) return;
  console.group(`[History Manager] ${message}`);
  if (data) console.log(data);
  console.groupEnd();
}