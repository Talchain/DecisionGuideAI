export const STORAGE_PREFIX = 'proscons';

export const ERROR_MESSAGES = {
  PARSE: 'Failed to parse stored data',
  INVALID_DATA: 'Invalid data format in storage',
  SAVE: 'Failed to save data to storage',
  REMOVE: 'Failed to remove data from storage'
} as const;

export const DEBUG_MESSAGES = {
  READ: 'Reading from storage',
  WRITE: 'Writing to storage',
  REMOVE: 'Removing from storage',
  INIT: 'Initializing storage'
} as const;