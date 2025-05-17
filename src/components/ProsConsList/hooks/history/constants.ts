export const MAX_HISTORY_SIZE = 30;
export const BATCH_DELAY = 1000;
export const OPERATION_TIMEOUT = 100;

export const DEBUG_MESSAGES = {
  PUSH_STATE: 'Pushing new state to history',
  UNDO: 'Performing undo operation',
  REDO: 'Performing redo operation',
  BATCH_START: 'Starting batch operation',
  BATCH_END: 'Ending batch operation',
  INIT: 'Initializing history manager',
  ERROR: {
    INVALID_STATE: 'Invalid state provided',
    OPERATION_IN_PROGRESS: 'Operation already in progress',
    MAX_SIZE_REACHED: 'Maximum history size reached',
    NO_CHANGES: 'No changes to undo/redo',
  },
} as const;