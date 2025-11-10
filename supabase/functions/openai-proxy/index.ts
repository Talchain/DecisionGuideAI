// supabase/functions/openai-proxy/index.ts
//
// SECURITY: Server-side OpenAI proxy to keep API keys out of client bundles.
// All secrets MUST be set via Supabase Edge Function secrets.
// See SECURITY.md for rotation procedures.

import { OpenAI } from "npm:openai@4.20.1";

// SECURITY: Read API key from environment (never commit)
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

// Initialize OpenAI client (server-side only)
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// SECURITY: CORS allow-list (never use wildcard in production)
const ALLOWED_ORIGINS = [
  "https://decisionguide.ai",
  "https://app.olumi.app",
  "http://localhost:5173",  // Dev only
  "http://localhost:4173",  // Preview builds
];

// Helper to check if origin is allowed and get CORS headers
function getCorsHeaders(requestOrigin: string | null): Record<string, string> | null {
  // SECURITY: Reject unknown origins explicitly (don't fallback)
  if (!requestOrigin || !ALLOWED_ORIGINS.includes(requestOrigin)) {
    return null; // Signal rejection
  }

  return {
    "Access-Control-Allow-Origin":  requestOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Validation: messages must be an array with at least one message
function validateMessages(messages: any): messages is Array<{ role: string; content: string }> {
  if (!Array.isArray(messages) || messages.length === 0) {
    return false;
  }

  return messages.every(
    (msg) =>
      typeof msg === "object" &&
      typeof msg.role === "string" &&
      typeof msg.content === "string"
  );
}

// Validation: options must be a valid object
interface ChatOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" | "text" };
}

function validateOptions(options: any): options is ChatOptions {
  if (typeof options !== "object" || options === null) {
    return false;
  }

  // Validate model if provided
  if (options.model !== undefined && typeof options.model !== "string") {
    return false;
  }

  // Validate temperature if provided
  if (options.temperature !== undefined) {
    if (typeof options.temperature !== "number" || options.temperature < 0 || options.temperature > 2) {
      return false;
    }
  }

  // Validate max_tokens if provided
  if (options.max_tokens !== undefined) {
    if (typeof options.max_tokens !== "number" || options.max_tokens < 1 || options.max_tokens > 4000) {
      return false;
    }
  }

  // Validate response_format if provided
  if (options.response_format !== undefined) {
    if (
      typeof options.response_format !== "object" ||
      !["json_object", "text"].includes(options.response_format.type)
    ) {
      return false;
    }
  }

  return true;
}

// Rate limiting: simple in-memory tracker (per IP)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimits.get(ip);

  if (!record || now > record.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

// Main handler
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // SECURITY: Reject unknown origins explicitly
  if (!corsHeaders) {
    console.warn("⛔ Rejected request from unknown origin:", origin);
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Rate limiting by IP (basic protection)
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const { messages, options = {} } = body;

    if (!validateMessages(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages format. Expected non-empty array of {role, content} objects." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!validateOptions(options)) {
      return new Response(
        JSON.stringify({ error: "Invalid options format." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call OpenAI with validated inputs
    const completion = await openai.chat.completions.create({
      model: options.model ?? "gpt-4",
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1500,
      ...(options.response_format ? { response_format: options.response_format } : {}),
    });

    // Extract content
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI API");
    }

    // Return structured response
    return new Response(
      JSON.stringify({
        content,
        usage: completion.usage,
        model: completion.model,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("❌ OpenAI proxy error:", err);

    // Don't leak internal error details to client
    const errorMessage = err.message?.includes("rate_limit")
      ? "OpenAI rate limit exceeded. Please try again later."
      : err.message?.includes("insufficient_quota")
      ? "OpenAI API quota exceeded. Please contact support."
      : "Failed to complete request. Please try again.";

    return new Response(
      JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
