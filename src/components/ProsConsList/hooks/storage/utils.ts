import { StorageError } from './types';
import { ERROR_MESSAGES } from './constants';

export function createStorageKey(key: string, prefix?: string): string {
  return prefix ? `${prefix}_${key}` : key;
}

export function validateStorageData<T>(data: T): boolean {
  if (data === null || data === undefined) return false;
  if (Array.isArray(data)) return true;
  if (typeof data === 'object') return Object.keys(data).length > 0;
  return true;
}

export function safelyParseJSON(data: string): any {
  try {
    return JSON.parse(data);
  } catch (error) {
    throw createStorageError(
      ERROR_MESSAGES.PARSE,
      'PARSE_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

export function createStorageError(
  message: string,
  code: StorageError['code'],
  originalError?: Error
): StorageError {
  const error = new Error(message) as StorageError;
  error.code = code;
  error.originalError = originalError;
  return error;
}