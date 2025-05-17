import { HistoryManager, HistoryState, HistoryOptions } from './types';

const DEFAULT_OPTIONS: HistoryOptions = {
  maxSize: 50,
  debug: false,
};

export function createHistoryManager<T>(
  initialState: T | null = null,
  options: HistoryOptions = {}
): HistoryManager<T> {
  const { maxSize, debug } = { ...DEFAULT_OPTIONS, ...options };

  return {
    past: [],
    present: initialState,
    future: [],
  };
}