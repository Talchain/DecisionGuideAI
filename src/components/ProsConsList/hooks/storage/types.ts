export interface StorageOptions {
  prefix?: string;
  debug?: boolean;
}

export interface StorageError extends Error {
  code: 'PARSE_ERROR' | 'STORAGE_ERROR' | 'INVALID_DATA';
  originalError?: Error;
}