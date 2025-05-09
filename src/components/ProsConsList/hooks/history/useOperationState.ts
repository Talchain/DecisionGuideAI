import { useRef, useCallback } from 'react';
import type { Operation, OperationType } from './types';

const OPERATION_TIMEOUT = 100; // ms

export function useOperationState() {
  const operationRef = useRef<Operation>({
    type: 'none',
    inProgress: false,
    timestamp: 0,
    id: ''
  });

  const startOperation = useCallback((type: OperationType) => {
    operationRef.current = {
      type,
      inProgress: true,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    };
  }, []);

  const endOperation = useCallback(() => {
    // Add small delay to prevent race conditions
    setTimeout(() => {
      operationRef.current = {
        type: 'none',
        inProgress: false,
        timestamp: Date.now(),
        id: ''
      };
    }, OPERATION_TIMEOUT);
  }, []);

  const isOperationInProgress = useCallback(() => {
    return operationRef.current.inProgress;
  }, []);

  const getCurrentOperation = useCallback(() => {
    return { ...operationRef.current };
  }, []);

  return {
    startOperation,
    endOperation,
    isOperationInProgress,
    getCurrentOperation
  };
}