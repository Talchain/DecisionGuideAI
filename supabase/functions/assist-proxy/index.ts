// supabase/functions/assist-proxy/index.ts
//
// M2.1: BFF proxy for Assistants API (v1.3.1)
// SECURITY: Server-side proxy to keep API keys out of client bundles.
// All secrets MUST be set via Supabase Edge Function secrets.

// SECURITY: Read API key from environment (never commit)
const ASSIST_API_KEY = Deno.env.get("ASSIST_API_KEY");
const ASSIST_API_BASE =
  Deno.env.get("ASSIST_API_BASE") || "https://assistants-api.example.com";

if (!ASSIST_API_KEY) {
  throw new Error("ASSIST_API_KEY environment variable is required");
}

// SECURITY: CORS allow-list (never use wildcard in production)
const ALLOWED_ORIGINS = [
  "https://olumi.netlify.app",
  "http://localhost:5173", // Dev only
  "http://localhost:4173", // Preview builds
];

// M2: 65s timeout for draft requests
const REQUEST_TIMEOUT_MS = 65000;

// =============================================================================
// Rate Limiting (in-memory per isolate)
// =============================================================================
// Note: In-memory rate limiting provides basic protection. For production at
// scale, consider using Upstash Redis for distributed rate limiting.

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 requests per minute per IP

const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const record = rateLimits.get(ip);

  // New window or expired entry
  if (!record || now > record.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW;
    rateLimits.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt };
  }

  // Over limit
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  // Increment count
  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count, resetAt: record.resetAt };
}

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// Helper to check if origin is allowed and get CORS headers
function getCorsHeaders(
  requestOrigin: string | null
): Record<string, string> | null {
  // SECURITY: Reject unknown origins explicitly (don't fallback)
  if (!requestOrigin || !ALLOWED_ORIGINS.includes(requestOrigin)) {
    return null; // Signal rejection
  }

  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-correlation-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

// Generate correlation ID if not provided (M2.6)
function getOrGenerateCorrelationId(headers: Headers): string {
  const existing = headers.get("x-correlation-id");
  if (existing) {
    return existing;
  }
  return crypto.randomUUID();
}

// Main handler
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // SECURITY: Reject unknown origins explicitly
  if (!corsHeaders) {
    console.warn("⛔ Rejected request from unknown origin:", origin);
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // SECURITY: Rate limiting check
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(clientIp);

  // Build rate limit headers
  const rateLimitHeaders = {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
  };

  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    console.warn(`[assist-proxy] Rate limit exceeded for IP: ${clientIp}`);
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded. Please try again later.",
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          ...rateLimitHeaders,
          "Retry-After": String(retryAfter),
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Extract and generate correlation ID (M2.6)
  const correlationId = getOrGenerateCorrelationId(req.headers);
  console.log(`[assist-proxy] Request started (correlation: ${correlationId})`);

  try {
    // Parse request body
    const body = await req.json();
    const { path, payload } = body;

    if (!path || !payload) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: path, payload",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate path (must be /draft-graph or /draft-graph/stream)
    if (
      path !== "/draft-graph" &&
      path !== "/draft-graph/stream"
    ) {
      return new Response(
        JSON.stringify({
          error: "Invalid path. Must be /draft-graph or /draft-graph/stream",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determine if streaming
    const isStreaming = path === "/draft-graph/stream";

    // Build upstream request URL
    const upstreamUrl = `${ASSIST_API_BASE}/v1${path}`;

    console.log(
      `[assist-proxy] Proxying to ${upstreamUrl} (streaming: ${isStreaming}, correlation: ${correlationId})`
    );

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      // Forward request to Assistants API
      const upstreamResponse = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ASSIST_API_KEY}`,
          "x-api-key": ASSIST_API_KEY,
          "x-correlation-id": correlationId, // M2.6: Forward correlation ID
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // For streaming responses, pipe through
      if (isStreaming && upstreamResponse.body) {
        console.log(
          `[assist-proxy] Streaming response started (correlation: ${correlationId})`
        );

        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          headers: {
            ...corsHeaders,
            ...rateLimitHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      // For sync responses, parse and return JSON
      const data = await upstreamResponse.json();

      console.log(
        `[assist-proxy] Request completed (status: ${upstreamResponse.status}, correlation: ${correlationId})`
      );

      return new Response(JSON.stringify(data), {
        status: upstreamResponse.status,
        headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      clearTimeout(timeoutId);

      // Handle timeout
      if (err.name === "AbortError") {
        console.error(
          `[assist-proxy] Request timed out after ${REQUEST_TIMEOUT_MS}ms (correlation: ${correlationId})`
        );
        return new Response(
          JSON.stringify({
            error: "Request timed out",
            timeout_ms: REQUEST_TIMEOUT_MS,
          }),
          {
            status: 504,
            headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" },
          }
        );
      }

      throw err;
    }
  } catch (err: any) {
    console.error(
      `[assist-proxy] Error (correlation: ${correlationId}):`,
      err
    );

    // Don't leak internal error details to client
    const errorMessage = err.message?.includes("rate_limit")
      ? "Assistants API rate limit exceeded. Please try again later."
      : err.message?.includes("insufficient_quota")
      ? "Assistants API quota exceeded. Please contact support."
      : "Failed to complete request. Please try again.";

    return new Response(
      JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, ...rateLimitHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
