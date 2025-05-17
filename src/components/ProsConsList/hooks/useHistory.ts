import { useState, useCallback, useRef, useEffect } from 'react';
import { HistoryManager, HistoryOptions, BatchOperation, OperationType } from './history/types';
import { createHistoryManager } from './history/createHistoryManager';
import { pushState, undo, redo, clear } from './history/historyOperations';
import { OPERATION_TIMEOUT, DEBUG_MESSAGES } from './history/constants';
import { debugLog, hasStateChanged } from './history/utils';

interface PushOptions {
  description?: string;
  type?: OperationType;
}

export function useHistory<T>(
  initialState: T | null = null,
  options: HistoryOptions = {}
) {
  const [manager, setManager] = useState<HistoryManager<T>>(() =>
    createHistoryManager(initialState, options)
  );
  
  const isOperationInProgress = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const { debug = false, batchDelay } = options;
  const initialStateRef = useRef(initialState);

  // Track if there are unsaved changes
  const hasChanges = useCallback(() => {
    return manager.past.length > 0 || 
           (manager.present && hasStateChanged(initialStateRef.current, manager.present));
  }, [manager.past.length, manager.present]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const clearOperationFlag = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      isOperationInProgress.current = false;
      timeoutRef.current = null;
    }, OPERATION_TIMEOUT);
  }, []);

  const push = useCallback((
    newState: T,
    { description = '', type = 'update_item' }: PushOptions = {}
  ) => {
    if (isOperationInProgress.current) {
      console.debug(DEBUG_MESSAGES.ERROR.OPERATION_IN_PROGRESS, { type });
      return;
    }

    const oldState = manager.present;
    // Deep comparison to ensure we catch all changes
    if (JSON.stringify(oldState) === JSON.stringify(newState)) {
      return;
    }

    console.debug(DEBUG_MESSAGES.PUSH_STATE, { type, description });
    isOperationInProgress.current = true;

    setManager(currentManager => {
      const newManager = pushState(currentManager, newState, type, description, {
        debug,
        batchDelay,
        batchOperation: null
      });
      return newManager;
    });

    clearOperationFlag();
  }, [debug, batchDelay, clearOperationFlag, manager.present]);

  const undoChange = useCallback(() => {
    if (isOperationInProgress.current) {
      debugLog(DEBUG_MESSAGES.ERROR.OPERATION_IN_PROGRESS, { operation: 'undo' }, debug);
      return;
    }

    debugLog(DEBUG_MESSAGES.UNDO, null, debug);
    isOperationInProgress.current = true;

    setManager(currentManager => undo(currentManager));
    clearOperationFlag();
  }, [debug, clearOperationFlag]);

  const redoChange = useCallback(() => {
    if (isOperationInProgress.current || !manager.present) {
      debugLog(DEBUG_MESSAGES.ERROR.OPERATION_IN_PROGRESS, { operation: 'redo' }, debug);
      return;
    }

    debugLog(DEBUG_MESSAGES.REDO, null, debug);
    isOperationInProgress.current = true;

    setManager(currentManager => redo(currentManager));
    clearOperationFlag();
  }, [debug, clearOperationFlag]);

  const clearHistory = useCallback(() => {
    if (isOperationInProgress.current) return;
    setManager(currentManager => clear(currentManager));
  }, []);

  return {
    state: manager.present,
    canUndo: manager.past.length > 0,
    canRedo: manager.future.length > 0,
    push,
    undo: undoChange,
    redo: redoChange,
    clear: clearHistory,
    hasChanges: hasChanges()
  };
}