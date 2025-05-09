import { useState, useCallback } from 'react';
import { Option } from '../../types';
import { HistoryState } from './types';
import { createHistoryState, isValidHistoryState } from './utils';

const MAX_HISTORY = 50;

export function useHistoryStack() {
  const [stack, setStack] = useState<HistoryState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);

  const push = useCallback((options: Option[], metadata?: HistoryState['metadata']) => {
    if (!Array.isArray(options)) return;

    // Prevent duplicate states
    const lastState = stack[currentIndex];
    if (lastState && JSON.stringify(lastState.state) === JSON.stringify(options)) {
      return;
    }

    setStack(prevStack => {
      // Remove any states after current index
      const newStack = prevStack.slice(0, currentIndex + 1);
      // Add new state
      const updatedStack = [...newStack, createHistoryState(options, metadata)];
      // Maintain max size
      return updatedStack.slice(-MAX_HISTORY);
    });

    setCurrentIndex(prev => prev + 1);
    setRedoStack([]); // Clear redo stack when new state is pushed
  }, [currentIndex, stack]);

  const undo = useCallback(() => {
    if (currentIndex < 0 || stack.length === 0) return null;

    try {
      const currentState = stack[currentIndex];
      if (!isValidHistoryState(currentState)) {
        throw new Error('Invalid history state');
      }

      setRedoStack(prev => [currentState, ...prev]);
      setCurrentIndex(prev => prev - 1);

      return currentIndex > 0 ? stack[currentIndex - 1] : stack[0];
    } catch (error) {
      console.error('Undo stack operation failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }, [currentIndex, stack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return null;

    try {
      const nextState = redoStack[0];
      if (!nextState || !isValidHistoryState(nextState)) {
        throw new Error('Invalid redo state');
      }

      setStack(prev => {
        const newStack = [...prev.slice(0, currentIndex + 1), nextState];
        return newStack.slice(-MAX_HISTORY);
      });

      setCurrentIndex(prev => prev + 1);
      setRedoStack(prev => prev.slice(1));

      return nextState;
    } catch (error) {
      console.error('Redo stack operation failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }, [currentIndex, redoStack]);

  const clear = useCallback(() => {
    setStack([]);
    setCurrentIndex(-1);
    setRedoStack([]);
  }, []);

  return {
    stack,
    currentIndex,
    redoStack,
    push,
    undo,
    redo,
    clear,
    canUndo: currentIndex >= 0 && stack.length > 0,
    canRedo: redoStack.length > 0
  };
}