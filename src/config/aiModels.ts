/**
 * Centralized AI Model Configuration
 *
 * Single source of truth for all AI model definitions, display names, and defaults.
 * Used across the application for model selection UI and API requests.
 *
 * Models are fetched dynamically from the CEE API via the models-proxy endpoint.
 */

export type ModelTier = 'quality' | 'fast' | 'premium';

export type OperationType = 'generation' | 'repair' | 'enrichment';

export interface ModelInfo {
  id: string;
  displayName: string;
  tier: ModelTier;
  provider: 'openai' | 'anthropic';
  maxTokens: number;
  isReasoning: boolean;
}

export interface ModelsResponse {
  curated: {
    generation: ModelInfo[];
    repair: ModelInfo[];
    enrichment: ModelInfo[];
  };
  all: ModelInfo[];
  defaults: {
    generation: string;
    repair: string;
    enrichment: string;
  };
}

// Legacy type for backward compatibility
export interface AIModel {
  id: string;
  displayName: string;
  tier: 'Quality' | 'Fast';
}

/**
 * Default model for each operation type
 * These defaults are used when user has not explicitly selected a model
 */
export const DEFAULT_MODELS: Record<OperationType, string> = {
  generation: 'gpt-4o',
  repair: 'claude-sonnet-4-20250514',
  enrichment: 'gpt-4o',
} as const;

/**
 * Fallback models used when API is unavailable
 */
export const FALLBACK_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o (Recommended)',
    tier: 'quality',
    provider: 'openai',
    maxTokens: 16384,
    isReasoning: false,
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    tier: 'fast',
    provider: 'openai',
    maxTokens: 16384,
    isReasoning: false,
  },
  {
    id: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    tier: 'quality',
    provider: 'anthropic',
    maxTokens: 8192,
    isReasoning: false,
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    displayName: 'Claude Sonnet 4.5',
    tier: 'quality',
    provider: 'anthropic',
    maxTokens: 8192,
    isReasoning: false,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    displayName: 'Claude Haiku',
    tier: 'fast',
    provider: 'anthropic',
    maxTokens: 8192,
    isReasoning: false,
  },
];

// Legacy export for backward compatibility
export const AI_MODELS: readonly AIModel[] = FALLBACK_MODELS.map((m) => ({
  id: m.id,
  displayName: m.displayName,
  tier: m.tier === 'fast' ? 'Fast' : 'Quality',
})) as readonly AIModel[];

/**
 * Fetch available models from the models-proxy endpoint
 */
export async function fetchModels(): Promise<ModelsResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not configured');
  }

  if (!supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY is not configured');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/models-proxy`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }

  return response.json();
}

/**
 * Get model display name by ID (uses fallback list)
 */
export function getModelDisplayName(modelId: string): string {
  const model = FALLBACK_MODELS.find((m) => m.id === modelId);
  return model?.displayName ?? modelId;
}

/**
 * Get model tier by ID (uses fallback list)
 */
export function getModelTier(modelId: string): ModelTier | undefined {
  const model = FALLBACK_MODELS.find((m) => m.id === modelId);
  return model?.tier;
}

/**
 * Check if a model ID is in the fallback list
 */
export function isValidModelId(modelId: string): boolean {
  return FALLBACK_MODELS.some((m) => m.id === modelId);
}

/**
 * Get default model for an operation type
 */
export function getDefaultModel(operation: OperationType): string {
  return DEFAULT_MODELS[operation];
}

/**
 * Format tier for display (capitalize first letter)
 */
export function formatTier(tier: ModelTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * Get fallback ModelsResponse when API is unavailable
 */
export function getFallbackModelsResponse(): ModelsResponse {
  return {
    curated: {
      generation: FALLBACK_MODELS,
      repair: FALLBACK_MODELS,
      enrichment: FALLBACK_MODELS,
    },
    all: FALLBACK_MODELS,
    defaults: DEFAULT_MODELS,
  };
}
