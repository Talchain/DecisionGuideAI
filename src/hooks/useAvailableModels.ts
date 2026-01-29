/**
 * useAvailableModels Hook
 *
 * Fetches available AI models from the models-proxy endpoint.
 * Returns curated models by default with option to access all models.
 *
 * Features:
 * - 5 minute stale time (models don't change frequently)
 * - Fallback to hardcoded list if API unavailable
 * - Separate curated lists per operation type
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  fetchModels,
  getFallbackModelsResponse,
  type ModelsResponse,
  type ModelInfo,
  type OperationType,
} from '../config/aiModels'

// Query key for models
export const modelsQueryKey = ['models'] as const

// Cache configuration
const STALE_TIME = 5 * 60 * 1000 // 5 minutes
const CACHE_TIME = 30 * 60 * 1000 // 30 minutes

/**
 * Hook return type with convenience accessors
 */
export interface UseAvailableModelsResult {
  /** Full response with curated and all models */
  data: ModelsResponse | undefined

  /** Whether the query is loading */
  isLoading: boolean

  /** Error if fetch failed */
  error: Error | null

  /** Refetch models from API */
  refetch: () => void

  /** Get curated models for a specific operation */
  getCuratedModels: (operation: OperationType) => ModelInfo[]

  /** Get all available models */
  getAllModels: () => ModelInfo[]

  /** Get default model ID for an operation */
  getDefaultModelId: (operation: OperationType) => string

  /** Check if currently using fallback data */
  isFallback: boolean
}

/**
 * Fetch and cache available AI models
 *
 * @example
 * const { getCuratedModels, getAllModels, isLoading } = useAvailableModels()
 *
 * // Get recommended models for generation
 * const generationModels = getCuratedModels('generation')
 *
 * // Get all models when user clicks "Show all"
 * const allModels = getAllModels()
 */
export function useAvailableModels(): UseAvailableModelsResult {
  const query = useQuery<ModelsResponse, Error>({
    queryKey: modelsQueryKey,
    queryFn: fetchModels,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  })

  // Use fallback when loading or error
  const effectiveData = query.data ?? getFallbackModelsResponse()
  const isFallback = !query.data

  // Convenience accessors
  const getCuratedModels = (operation: OperationType): ModelInfo[] => {
    return effectiveData.curated[operation] ?? []
  }

  const getAllModels = (): ModelInfo[] => {
    return effectiveData.all ?? []
  }

  const getDefaultModelId = (operation: OperationType): string => {
    return effectiveData.defaults[operation] ?? ''
  }

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    getCuratedModels,
    getAllModels,
    getDefaultModelId,
    isFallback,
  }
}

export default useAvailableModels
