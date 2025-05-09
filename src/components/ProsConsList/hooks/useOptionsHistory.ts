import { useState, useCallback, useEffect } from 'react';
import type { Option } from '../types';
import { useHistoryStack } from './history/useHistoryStack';
import { useOperationState } from './history/useOperationState';
import { isValidHistoryState } from './history/utils';

function useOptionsHistory(initialOptions: Option[] = []) {
  const [options, setOptions] = useState<Option[]>(initialOptions);
  const [isDirty, setIsDirty] = useState(false);

  const {
    push: pushToHistory,
    undo: undoHistory,
    redo: redoHistory,
    canUndo,
    canRedo,
    clear: clearHistory
  } = useHistoryStack();

  const {
    startOperation,
    endOperation,
    isOperationInProgress
  } = useOperationState();

  // Initialize history with initial options
  useEffect(() => {
    if (initialOptions.length > 0) {
      pushToHistory(initialOptions, {
        type: 'init',
        description: 'Initial options'
      });
    }
  }, [initialOptions, pushToHistory]);

  const addToHistory = useCallback((newOptions: Option[]) => {
    if (isOperationInProgress()) {
      endOperation();
      return;
    }

    try {
      if (!Array.isArray(newOptions)) {
        throw new Error('Invalid options format');
      }

      pushToHistory(newOptions, {
        type: 'update',
        description: 'Update options'
      });
      setIsDirty(true);
    } catch (error) {
      console.error('Failed to add to history:', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [pushToHistory, endOperation, isOperationInProgress]);

  const handleUndo = useCallback(() => {
    if (isOperationInProgress()) return;

    startOperation('undo');
    const previousState = undoHistory();

    try {
      if (previousState && isValidHistoryState(previousState)) {
        setOptions(previousState.state);
        setIsDirty(true);
      }
    } catch (error) {
      console.error('Undo operation failed:', error instanceof Error ? error.message : 'Unknown error');
    }

    endOperation();
  }, [undoHistory, startOperation, endOperation, isOperationInProgress]);

  const handleRedo = useCallback(() => {
    if (isOperationInProgress()) return;

    startOperation('redo');
    const nextState = redoHistory();

    try {
      if (nextState && isValidHistoryState(nextState)) {
        setOptions(nextState.state);
        setIsDirty(true);
      }
    } catch (error) {
      console.error('Redo operation failed:', error instanceof Error ? error.message : 'Unknown error');
    }

    endOperation();
  }, [redoHistory, startOperation, endOperation, isOperationInProgress]);

  const reset = useCallback(() => {
    setOptions([]);
    setIsDirty(false);
    clearHistory();
  }, [clearHistory]);

  return {
    options,
    setOptions,
    isDirty,
    setIsDirty,
    addToHistory,
    handleUndo,
    handleRedo,
    reset,
    canUndo,
    canRedo
  };
}