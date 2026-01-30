// supabase/functions/models-proxy/index.ts
//
// Proxy for CEE Admin API models endpoint
// Returns available AI models for the model selection UI

// SECURITY: Read API keys from environment (never commit)
// Try ASSIST_ADMIN_KEY first, fall back to ASSIST_API_KEY
const ASSIST_ADMIN_KEY = Deno.env.get("ASSIST_ADMIN_KEY") || Deno.env.get("ASSIST_API_KEY");
const ASSIST_API_BASE =
  Deno.env.get("ASSIST_API_BASE") || "https://assistants-api.example.com";

if (!ASSIST_ADMIN_KEY) {
  throw new Error("ASSIST_ADMIN_KEY or ASSIST_API_KEY environment variable is required");
}

// SECURITY: CORS allow-list
const ALLOWED_ORIGINS = [
  "https://olumi.netlify.app",
  "http://localhost:5173",
  "http://localhost:4173",
];

// Cache duration (5 minutes) - models don't change frequently
const CACHE_MAX_AGE = 300;

// In-memory cache for model list
let cachedModels: ModelsResponse | null = null;
let cacheExpiry = 0;

// Types matching CEE API response
interface CEEModel {
  id: string;
  provider: string;
  tier: string;
  description: string;
  max_tokens: number;
  is_reasoning: boolean;
  supports_extended_thinking: boolean;
  supports_temperature: boolean;
  source: "registry" | "provider";
  in_registry: boolean;
}

interface ModelInfo {
  id: string;
  displayName: string;
  tier: "fast" | "quality" | "premium";
  provider: "openai" | "anthropic";
  maxTokens: number;
  isReasoning: boolean;
}

interface ModelsResponse {
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

// Curated model IDs for each operation (recommended models)
const CURATED_GENERATION = [
  "gpt-4o",
  "gpt-5.2",
  "gpt-5-mini",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-20250514",
];

const CURATED_REPAIR = [
  "claude-sonnet-4-20250514",
  "claude-sonnet-4-5-20250929",
  "gpt-4o",
  "claude-3-5-haiku-20241022",
];

const CURATED_ENRICHMENT = CURATED_GENERATION;

// Default models per operation
const DEFAULTS = {
  generation: "gpt-4o",
  repair: "claude-sonnet-4-20250514",
  enrichment: "gpt-4o",
};

function getCorsHeaders(
  requestOrigin: string | null
): Record<string, string> | null {
  if (!requestOrigin || !ALLOWED_ORIGINS.includes(requestOrigin)) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

function transformModel(ceeModel: CEEModel): ModelInfo {
  return {
    id: ceeModel.id,
    displayName: ceeModel.description || ceeModel.id,
    tier: ceeModel.tier as "fast" | "quality" | "premium",
    provider: ceeModel.provider as "openai" | "anthropic",
    maxTokens: ceeModel.max_tokens,
    isReasoning: ceeModel.is_reasoning,
  };
}

function buildResponse(allModels: ModelInfo[]): ModelsResponse {
  // Filter curated models for each operation
  const curatedGeneration = allModels.filter((m) =>
    CURATED_GENERATION.includes(m.id)
  );
  const curatedRepair = allModels.filter((m) => CURATED_REPAIR.includes(m.id));
  const curatedEnrichment = allModels.filter((m) =>
    CURATED_ENRICHMENT.includes(m.id)
  );

  // Sort curated lists by the predefined order
  const sortByCuratedOrder = (models: ModelInfo[], order: string[]) =>
    models.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  return {
    curated: {
      generation: sortByCuratedOrder(curatedGeneration, CURATED_GENERATION),
      repair: sortByCuratedOrder(curatedRepair, CURATED_REPAIR),
      enrichment: sortByCuratedOrder(curatedEnrichment, CURATED_ENRICHMENT),
    },
    all: allModels,
    defaults: DEFAULTS,
  };
}

async function fetchModelsFromCEE(): Promise<ModelInfo[]> {
  const upstreamUrl = `${ASSIST_API_BASE}/admin/v1/test-prompt-llm/models`;

  console.log(`[models-proxy] Fetching models from ${upstreamUrl}`);

  const response = await fetch(upstreamUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      // CEE admin endpoint uses lowercase x-admin-key
      "x-admin-key": ASSIST_ADMIN_KEY!,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[models-proxy] CEE API error: ${response.status} - ${errorText}`
    );
    throw new Error(`CEE API returned ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  console.log(`[models-proxy] CEE response keys: ${Object.keys(data).join(", ")}`);

  const ceeModels: CEEModel[] = data.models || data;

  return ceeModels.map(transformModel);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Reject unknown origins
  if (!corsHeaders) {
    console.warn("[models-proxy] Rejected request from unknown origin:", origin);
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only accept GET
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const now = Date.now();

    // Return cached response if still valid
    if (cachedModels && now < cacheExpiry) {
      console.log("[models-proxy] Returning cached models");
      return new Response(JSON.stringify(cachedModels), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
          "X-Cache": "HIT",
        },
      });
    }

    // Fetch fresh models from CEE
    const allModels = await fetchModelsFromCEE();
    const response = buildResponse(allModels);

    // Update cache
    cachedModels = response;
    cacheExpiry = now + CACHE_MAX_AGE * 1000;

    console.log(
      `[models-proxy] Fetched ${allModels.length} models, cached for ${CACHE_MAX_AGE}s`
    );

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
        "X-Cache": "MISS",
      },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[models-proxy] Error:", errorMessage);

    return new Response(
      JSON.stringify({
        error: "Failed to fetch models. Please try again.",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
