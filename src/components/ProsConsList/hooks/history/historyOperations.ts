import { HistoryManager, HistoryState, OperationType, BatchOperation } from './types';
import { createHistoryState, trimHistory, shouldBatchOperations, isValidHistoryState, hasStateChanged } from './utils';
import { BATCH_DELAY } from './constants';

interface PushStateOptions {
  debug?: boolean;
  batchDelay?: number;
  batchOperation?: BatchOperation | null;
  force?: boolean;
}

export function pushState<T>(
  manager: HistoryManager<T>,
  newState: T,
  type: OperationType,
  description: string,
  options: PushStateOptions = {}
): HistoryManager<T> {
  const { debug = false, force = false, batchDelay = 0 } = options;
  
  if (!manager.present) {
    return createHistoryManager(newState);
  }

  // Deep compare states to ensure we catch all changes
  if (!force && JSON.stringify(manager.present) === JSON.stringify(newState)) {
    return manager;
  }
  
  const historyState = createHistoryState(
    manager.present,
    type,
    description
  );

  const newPast = [...manager.past, historyState];

  return {
    past: trimHistory(newPast),
    present: newState,
    future: [],
  };
}

export function undo<T>(manager: HistoryManager<T>): HistoryManager<T> {
  if (manager.past.length === 0 || !manager.present) return manager;

  const previousState = manager.past[manager.past.length - 1];
  if (!isValidHistoryState<T>(previousState)) {
    console.error('Invalid history state encountered during undo');
    return manager;
  }

  const newPast = manager.past.slice(0, -1);

  return {
    past: newPast,
    present: previousState.state,
    future: [
      createHistoryState(
        manager.present,
        'batch_operation',
        'Undo operation'
      ),
      ...manager.future
    ],
  };
}

export function redo<T>(manager: HistoryManager<T>): HistoryManager<T> {
  if (manager.future.length === 0 || !manager.present) return manager;

  const nextState = manager.future[0];
  if (!isValidHistoryState<T>(nextState)) {
    console.error('Invalid history state encountered during redo');
    return manager;
  }

  const newFuture = manager.future.slice(1);

  return {
    past: [
      ...manager.past,
      createHistoryState(
        manager.present,
        'batch_operation',
        'Redo operation'
      )
    ],
    present: nextState.state,
    future: newFuture,
  };
}

export function clear<T>(manager: HistoryManager<T>): HistoryManager<T> {
  return {
    past: [],
    present: manager.present,
    future: [],
  };
}