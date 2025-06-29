import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import OpenAI from "npm:openai@4.28.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

// Environment variables
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Rate limiting (simple in-memory implementation)
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in milliseconds

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(
  SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY || ""
);

// Check rate limit for a user or IP
function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userRateLimit = rateLimits.get(identifier);

  if (!userRateLimit || userRateLimit.resetTime < now) {
    // Reset or initialize rate limit
    rateLimits.set(identifier, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (userRateLimit.count >= RATE_LIMIT) {
    return false; // Rate limit exceeded
  }

  // Increment count
  userRateLimit.count += 1;
  rateLimits.set(identifier, userRateLimit);
  return true;
}

// Sanitize error messages to avoid leaking sensitive information
function sanitizeErrorMessage(error: any): string {
  if (!error) return "Unknown error occurred";
  
  // If it's an OpenAI API error, extract only the message
  if (error.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  
  // For other errors, return a generic message
  return error.message || "An error occurred while processing your request";
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract JWT token
    const token = authHeader.replace("Bearer ", "");
    
    // Verify the token and get user info
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Apply rate limiting
    const identifier = user.id;
    if (!checkRateLimit(identifier)) {
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: RATE_WINDOW / 1000
        }),
        {
          status: 429,
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": (RATE_WINDOW / 1000).toString()
          },
        }
      );
    }

    // Parse request body
    const requestData = await req.json();
    const { messages, options = {} } = requestData;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid request: messages array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Set default options if not provided
    const model = options.model || "gpt-4";
    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const max_tokens = options.max_tokens || 1500;
    const response_format = options.response_format || undefined;

    // Log request (without sensitive data)
    console.log(`Processing request for user ${user.id.substring(0, 8)}...`);
    console.log(`Model: ${model}, Temperature: ${temperature}, Max tokens: ${max_tokens}`);
    console.log(`Number of messages: ${messages.length}`);

    // Make request to OpenAI
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
      response_format,
    });
    const endTime = Date.now();

    // Log completion time (without sensitive data)
    console.log(`Request completed in ${endTime - startTime}ms`);
    console.log(`Tokens used: ${completion.usage?.total_tokens || 'unknown'}`);

    // Return the response
    return new Response(
      JSON.stringify({
        content: completion.choices[0].message.content,
        usage: completion.usage,
        model: completion.model,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Log error (without sensitive data)
    console.error("Error processing request:", error.name, error.status);
    
    // Determine appropriate status code
    let statusCode = 500;
    if (error.status === 429) statusCode = 429; // Rate limit
    else if (error.status === 400) statusCode = 400; // Bad request
    
    // Return sanitized error
    return new Response(
      JSON.stringify({ 
        error: sanitizeErrorMessage(error),
        status: statusCode
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});