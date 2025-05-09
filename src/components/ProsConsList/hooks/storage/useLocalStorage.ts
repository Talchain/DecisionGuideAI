import { useState, useCallback } from 'react';
import { StorageOptions, StorageError } from './types';
import { createStorageKey, createStorageError, validateStorageData, safelyParseJSON } from './utils';
import { ERROR_MESSAGES, DEBUG_MESSAGES, STORAGE_PREFIX } from './constants';

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: StorageOptions = {}
) {
  const { prefix = STORAGE_PREFIX, debug = false } = options;
  const storageKey = createStorageKey(key, prefix);

  // Initialize state with stored value or initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (debug) console.debug(DEBUG_MESSAGES.INIT, { key: storageKey });

      const item = window.localStorage.getItem(storageKey);
      if (!item) return initialValue;

      const parsedItem = safelyParseJSON(item);
      if (!validateStorageData(parsedItem)) {
        throw createStorageError(
          ERROR_MESSAGES.INVALID_DATA,
          'INVALID_DATA'
        );
      }

      return parsedItem;
    } catch (error) {
      const isStorageError = error instanceof Error && error.name === 'StorageError';
      console.error(
        `Error reading from localStorage: ${isStorageError ? error.message : ERROR_MESSAGES.PARSE}`,
        { key: storageKey, error }
      );
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        if (debug) console.debug(DEBUG_MESSAGES.WRITE, { key: storageKey });

        const valueToStore = value instanceof Function ? value(storedValue) : value;
        
        if (!validateStorageData(valueToStore)) {
          throw createStorageError(
            ERROR_MESSAGES.INVALID_DATA,
            'INVALID_DATA'
          );
        }

        const serializedValue = JSON.stringify(valueToStore);
        setStoredValue(valueToStore);
        window.localStorage.setItem(storageKey, serializedValue);
      } catch (error) {
        console.error(`Error saving to localStorage: ${ERROR_MESSAGES.SAVE}`, {
          key: storageKey,
          error
        });
        throw createStorageError(
          ERROR_MESSAGES.SAVE,
          'STORAGE_ERROR',
          error instanceof Error ? error : undefined
        );
      }
    },
    [storageKey, storedValue, debug]
  );

  const removeValue = useCallback(() => {
    try {
      if (debug) console.debug(DEBUG_MESSAGES.REMOVE, { key: storageKey });

      window.localStorage.removeItem(storageKey);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Error removing from localStorage: ${ERROR_MESSAGES.REMOVE}`, {
        key: storageKey,
        error
      });
    }
  }, [storageKey, initialValue, debug]);

  return {
    value: storedValue,
    setValue,
    removeValue,
    key: storageKey,
    hasValue: validateStorageData(storedValue)
  };
}