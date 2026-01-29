/**
 * Centralized AI Model Configuration
 *
 * Single source of truth for all AI model definitions, display names, and defaults.
 * Used across the application for model selection UI and API requests.
 */

export type ModelTier = 'Quality' | 'Fast';

export type OperationType = 'generation' | 'repair' | 'enrichment';

export interface AIModel {
  id: string;
  displayName: string;
  tier: ModelTier;
}

/**
 * All available AI models for the Olumi platform
 */
export const AI_MODELS: readonly AIModel[] = [
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o (Recommended)',
    tier: 'Quality',
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    tier: 'Fast',
  },
  {
    id: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    tier: 'Quality',
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    displayName: 'Claude Sonnet 4.5',
    tier: 'Quality',
  },
  {
    id: 'claude-3-5-haiku-20241022',
    displayName: 'Claude Haiku',
    tier: 'Fast',
  },
] as const;

/**
 * Default model for each operation type
 * These defaults are used when user has not explicitly selected a model
 */
export const DEFAULT_MODELS: Record<OperationType, string> = {
  generation: 'gpt-4o',
  repair: 'claude-sonnet-4-20250514',
  enrichment: 'claude-sonnet-4-20250514',
} as const;

/**
 * Get model display name by ID
 */
export function getModelDisplayName(modelId: string): string {
  const model = AI_MODELS.find((m) => m.id === modelId);
  return model?.displayName ?? modelId;
}

/**
 * Get model tier by ID
 */
export function getModelTier(modelId: string): ModelTier | undefined {
  const model = AI_MODELS.find((m) => m.id === modelId);
  return model?.tier;
}

/**
 * Check if a model ID is valid
 */
export function isValidModelId(modelId: string): boolean {
  return AI_MODELS.some((m) => m.id === modelId);
}

/**
 * Get default model for an operation type
 */
export function getDefaultModel(operation: OperationType): string {
  return DEFAULT_MODELS[operation];
}
