// src/lib/api.ts

import { generatePromptMessages } from './prompts'
import { supabase } from './supabase'

// Error types for better categorization
export enum ApiErrorType {
  NETWORK = 'network',
  RATE_LIMIT = 'rate_limit',
  AUTHENTICATION = 'authentication',
  INVALID_PARAMETERS = 'invalid_parameters',
  SERVER_ERROR = 'server_error',
  UNKNOWN = 'unknown'
}

export interface ApiError extends Error {
  type: ApiErrorType;
  status?: number;
  retryAfter?: number;
}

// —————————————————————————————————————————————————————————————————————————————
// Helper: create chat completion with retries via Edge Function
// —————————————————————————————————————————————————————————————————————————————
async function createChatCompletion(
  messages: any[],
  options: {
    model?: string 
    temperature?: number
    max_tokens?: number
  } = {},
  retries = 3
): Promise<{ content: string; prompt: any; rawResponse: any }> {
  let lastError: Error | null = null
  let delay = 1000

  if (!Array.isArray(messages) || messages.length === 0) {
    const error = new Error('Invalid messages format') as ApiError;
    error.type = ApiErrorType.INVALID_PARAMETERS;
    throw error;
  }

  const supabaseUrl = supabase.supabaseUrl;
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/openai-proxy`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const error = new Error('Authentication required') as ApiError;
        error.type = ApiErrorType.AUTHENTICATION;
        throw error;
      }

      // Make request to Edge Function
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          messages,
          options: {
            model: options.model ?? 'gpt-4.1-mini',
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens ?? 1500,
            response_format: options.response_format
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.error || `API error: ${response.status}`) as ApiError;
        error.status = response.status;
        
        // Categorize error based on status code
        if (response.status === 429) {
          error.type = ApiErrorType.RATE_LIMIT;
          error.retryAfter = errorData.retryAfter || 60;
        } else if (response.status === 401 || response.status === 403) {
          error.type = ApiErrorType.AUTHENTICATION;
        } else if (response.status === 400) {
          error.type = ApiErrorType.INVALID_PARAMETERS;
        } else if (response.status >= 500) {
          error.type = ApiErrorType.SERVER_ERROR;
        } else {
          error.type = ApiErrorType.UNKNOWN;
        }
        
        throw error;
      }

      const completion = await response.json();

      const content = completion.content;
      if (!content) {
        const error = new Error('Empty response from API') as ApiError;
        error.type = ApiErrorType.SERVER_ERROR;
        throw error;
      }
      return { content, prompt: messages, rawResponse: completion }
    } catch (err) {
      // Ensure error has the ApiError type
      if (err instanceof Error && !('type' in err)) {
        const apiError = err as ApiError;
        
        // Categorize network errors
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          apiError.type = ApiErrorType.NETWORK;
        } else if (err.message.includes('timeout')) {
          apiError.type = ApiErrorType.NETWORK;
        } else {
          apiError.type = ApiErrorType.UNKNOWN;
        }
        
        lastError = apiError;
      } else {
        lastError = err instanceof Error ? err as ApiError : new Error('Unknown error occurred') as ApiError;
        if (!('type' in lastError)) {
          (lastError as ApiError).type = ApiErrorType.UNKNOWN;
        }
      }
      
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, delay))
        delay *= 2
      }
    }
  }

  if (!lastError) {
    const error = new Error('Failed to get API response after retries') as ApiError;
    error.type = ApiErrorType.UNKNOWN;
    throw error;
  }
  
  throw lastError;
}

// —————————————————————————————————————————————————————————————————————————————
// Types for Options Ideation
// —————————————————————————————————————————————————————————————————————————————
export interface OptionIdeation {
  label: string
  description: string
}

export interface BiasIdeation {
  name: string
  description: string
}

export interface OptionsAnalysisResponse {
  options: OptionIdeation[]
  biases: BiasIdeation[]
  prompt?: any
  rawResponse?: any
}

// —————————————————————————————————————————————————————————————————————————————
// generateOptionsIdeation (uses no response_format)
// —————————————————————————————————————————————————————————————————————————————
export const generateOptionsIdeation = async ({
  decision,
  decisionType,
  reversibility,
  importance,
  goals = []
}: {
  decision: string
  decisionType: string
  reversibility: string
  importance: string
  goals?: string[]
}): Promise<OptionsAnalysisResponse> => {
  try {
    if (!decision || !decisionType || !reversibility || !importance) {
      const error = new Error('Missing required parameters for options analysis') as ApiError;
      error.type = ApiErrorType.INVALID_PARAMETERS;
      throw error;
    }

    // Check authentication first
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        const error = new Error(`Authentication error: ${sessionError.message}`) as ApiError;
        error.type = ApiErrorType.AUTHENTICATION;
        throw error;
      }
      
      if (!session) {
        const error = new Error('You need to be signed in to generate options. Please sign in and try again.') as ApiError;
        error.type = ApiErrorType.AUTHENTICATION;
        throw error;
      }

      // Use the correct Supabase URL format
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        const error = new Error('Supabase URL not configured') as ApiError;
        error.type = ApiErrorType.SERVER_ERROR;
        throw error;
      }

      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/openai-proxy`;

      const messages = [
        {
          role: 'system',
          content: `
You are an expert in decision, behavioral, and cognitive science.
Your task is to help a user generate the most promising options for a decision,
and to highlight the cognitive biases they should guard against.

Always respond with exactly one JSON object—no extra text, markdown, or code fences.
If you cannot comply, return {"error": true, "message": "reason"}.
`.trim()
        },
        {
          role: 'user',
          content: `
Context:
• Decision: ${decision}
• Category: ${decisionType}
• Goals: ${goals.length ? goals.join(' | ') : 'None specified'}
• Importance: ${importance}
• Reversibility: ${reversibility}

Please output exactly one JSON object with these two keys:

{
  "options": [
    {
      "label": "Short, clear title of the option",
      "description": "A 1–2 sentence explanation of what this option involves"
    }
    // 3–6 such entries
  ],
  "biases": [
    {
      "name": "Name of cognitive bias",
      "description": "How it might skew the user's thinking here"
    }
    // at least 4, more if relevant
  ]
}

Requirements for options:
1. Produce 3–6 distinct, high-quality entries.
2. Include the top-priority choices plus at least one unconventional or creative angle.
3. If applicable, include one "test or reframe" option (e.g. a small experiment or data gathering).

Requirements for biases:
1. List at least 4 biases most likely to affect this decision.
2. For each, give a concise, plain-language description of its influence.

Do not include any text outside the JSON. If you fail to generate valid JSON, return:
{"error": true, "message": "Could not generate JSON as specified"}
`.trim()
        }
      ];

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          messages,
          options: {
            model: 'gpt-4',
            temperature: 0.7,
            max_tokens: 1500
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = errorData.error || `API error: ${response.status}`;
        
        // Provide more user-friendly messages for common error codes
        if (response.status === 429) {
          const error = new Error('Rate limit exceeded. Please wait a moment and try again.') as ApiError;
          error.type = ApiErrorType.RATE_LIMIT;
          error.status = response.status;
          error.retryAfter = 60; // Default to 60 seconds if not specified
          throw error;
        } else if (response.status >= 500) {
          const error = new Error('The AI service is currently unavailable. Please try again later.') as ApiError;
          error.type = ApiErrorType.SERVER_ERROR;
          error.status = response.status;
          throw error;
        }
        
        const error = new Error(errorMessage) as ApiError;
        error.type = ApiErrorType.UNKNOWN;
        error.status = response.status;
        throw error;
      }

      const result = await response.json();
      
      const content = result?.content;
      if (!content) {
        const error = new Error('Empty response from API') as ApiError;
        error.type = ApiErrorType.SERVER_ERROR;
        throw error;
      }

      // Parse the JSON response
      const parsed = JSON.parse(content);
      
      // Validate the response structure
      if (!parsed.options || !Array.isArray(parsed.options) || parsed.options.length === 0) {
        const error = new Error('The AI couldn\'t generate any options for this decision. Please try again with more details.') as ApiError;
        error.type = ApiErrorType.INVALID_PARAMETERS;
        throw error;
      }
      
      if (!parsed.biases || !Array.isArray(parsed.biases) || parsed.biases.length === 0) {
        const error = new Error('Invalid response: missing or invalid biases array') as ApiError;
        error.type = ApiErrorType.INVALID_PARAMETERS;
        throw error;
      }

      return parsed;
    } catch (error) {
      console.error('Options ideation error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Options ideation error:', error);
    
    if (error instanceof Error) {
      const errorMessage = error.message;
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        const apiError = new Error('Network error: Please check your internet connection and try again.') as ApiError;
        apiError.type = ApiErrorType.NETWORK;
        throw apiError;
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Timed out')) {
        const apiError = new Error('The request timed out. The AI service might be busy, please try again in a moment.') as ApiError;
        apiError.type = ApiErrorType.NETWORK;
        throw apiError;
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        const apiError = new Error('You\'ve reached the rate limit for AI requests. Please wait a moment before trying again.') as ApiError;
        apiError.type = ApiErrorType.RATE_LIMIT;
        apiError.retryAfter = 60; // Default to 60 seconds
        throw apiError;
      } else if (errorMessage.includes('authentication') || errorMessage.includes('Unauthorized')) {
        const apiError = new Error('Authentication error: Please sign in again and retry.') as ApiError;
        apiError.type = ApiErrorType.AUTHENTICATION;
        throw apiError;
      } else {
        const apiError = new Error(`Options generation failed: ${error.message}`) as ApiError;
        apiError.type = ApiErrorType.UNKNOWN;
        throw apiError;
      }
    }
    const apiError = new Error('Options generation failed. Please try again or contact support if the problem persists.') as ApiError;
    apiError.type = ApiErrorType.UNKNOWN;
    throw apiError;
  }
}

// —————————————————————————————————————————————————————————————————————————————
// Existing: analyzeDecision
// —————————————————————————————————————————————————————————————————————————————
export interface AnalysisRequest {
  decision: string
  decisionType: string
  reversibility: string
  importance: string
  messages?: any[]
  query?: string
  goals?: string[]
  context?: any[]
}

export interface AnalysisResponse {
  analysis: string
  cached: boolean
  prompt?: any
  rawResponse?: any
}

export const analyzeDecision = async ({
  decision,
  decisionType,
  reversibility,
  importance,
  messages = [],
  query = '',
  goals = []
}: AnalysisRequest): Promise<AnalysisResponse> => {
  try {
    if (!decision || !decisionType || !reversibility || !importance) {
      throw new Error('Missing required parameters for analysis')
    }

    const promptMessages = generatePromptMessages(
      decision,
      decisionType,
      reversibility,
      importance,
      goals,
      messages,
      query
    )

    const { content, prompt, rawResponse } = await createChatCompletion(
      promptMessages,
      { 
        model: 'gpt-4.1-mini',
        max_tokens: importance === 'critical_in_depth_analysis' ? 2000 : 1000 
      }
    )

    return {
      analysis: content,
      cached: false,
      prompt,
      rawResponse
    }
  } catch (error) {
    console.error(
      'Analysis error:',
      { error, context: { decision, decisionType, reversibility, importance } }
    )
    throw error
  }
}

// —————————————————————————————————————————————————————————————————————————————
// Existing: analyzeOptions (unmodified)
// —————————————————————————————————————————————————————————————————————————————
export interface Option {
  name: string
  pros: string[]
  cons: string[]
}

export interface Bias {
  name: string
  definition: string
  mitigationTip: string
}

interface OptionsAnalysisRawResponse {
  options: Option[]
  biases: Bias[]
  prompt?: any
  rawResponse?: any
}

export const analyzeOptions = async ({
  decision,
  decisionType,
  reversibility,
  importance,
  goals = []
}: AnalysisRequest): Promise<OptionsAnalysisRawResponse> => {
  try {
    if (!decision || !decisionType || !reversibility || !importance) {
      const error = new Error('Missing required parameters for options analysis') as ApiError;
      error.type = ApiErrorType.INVALID_PARAMETERS;
      throw error;
    }

    // Get the current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const error = new Error('Authentication required') as ApiError;
      error.type = ApiErrorType.AUTHENTICATION;
      throw error;
    }

    const supabaseUrl = supabase.supabaseUrl;
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/openai-proxy`;

    // Prepare messages for the API
    const messages = [
      {
        role: 'system',
        content:
          'You are a decision analysis and behavioural science expert. Analyze the decision and return a JSON response with options and biases. Ensure your analysis is realistic and relevant to the decision context, importance, reversibility, and any goals provided. Include 2-5 options with their pros and cons, and 3-6 cognitive biases with practical mitigation tips.'
      },
      {
        role: 'user',
        content: `Please analyze this decision and provide a response in JSON format with options and biases:

Decision: "${decision}"
Type: ${decisionType}
Reversibility: ${reversibility}
Importance: ${importance}
${goals?.length ? `Goals:\n${goals.join('\n')}` : ''}

Based on this information:
1. Identify 2-5 viable options for the decision. For each option, list:
   - Key pros (considering immediate, emotional, and long-term benefits)
   - Key cons (including risks, potential losses, and long-term impacts)
If relevant, suggest an additional option that would allow the user to test their decision, gather more information, or consider a reframed perspective on the decision.

2. Identify 3-6 cognitive biases most relevant to this decision. For each bias provide:
   - Its name
   - A very concise, plain-language definition
   - A very concise practical tip for mitigating its impact

Required JSON format:
{
  "options": [
    {
      "name": "Option name",
      "pros": ["pro1", "pro2", ...],
      "cons": ["con1", "con2", ...]
    }
  ],
  "biases": [
    {
      "name": "Bias name",
      "definition": "Brief definition",
      "mitigationTip": "How to mitigate this bias"
    }
  ]
}`
      }
    ];

    // Make request to Edge Function
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        messages,
        options: {
          model: 'gpt-4.1-mini',
          max_tokens: 1500,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      const error = new Error(errorData.error || `API error: ${response.status}`) as ApiError;
      error.status = response.status;
      
      // Categorize error based on status code
      if (response.status === 429) {
        error.type = ApiErrorType.RATE_LIMIT;
        error.retryAfter = errorData.retryAfter || 60;
      } else if (response.status === 401 || response.status === 403) {
        error.type = ApiErrorType.AUTHENTICATION;
      } else if (response.status === 400) {
        error.type = ApiErrorType.INVALID_PARAMETERS;
      } else if (response.status >= 500) {
        error.type = ApiErrorType.SERVER_ERROR;
      } else {
        error.type = ApiErrorType.UNKNOWN;
      }
      
      throw error;
    }

    const result = await response.json();
    const content = result.content;

    const parsed = JSON.parse(content);
    return { ...parsed, prompt: messages, rawResponse: result };
  } catch (error) {
    console.error(
      'Options analysis error:',
      { error, context: { decision, decisionType, reversibility, importance } }
    );
    
    // Ensure error has the ApiError type
    if (error instanceof Error && !('type' in error)) {
      const apiError = error as ApiError;
      apiError.type = ApiErrorType.UNKNOWN;
      throw apiError;
    }
    throw error;
  }
}

// —————————————————————————————————————————————————————————————————————————————
// Existing: analyzeGoalClarification
// —————————————————————————————————————————————————————————————————————————————
export interface GoalClarificationResponse {
  reason: string
  suggestedQuestion?: string
}

export const analyzeGoalClarification = async ({
  decision,
  decisionType,
  reversibility,
  importance
}: AnalysisRequest): Promise<GoalClarificationResponse> => {
  try {
    // Get the current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Authentication required');
    }

    const supabaseUrl = supabase.supabaseUrl;
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/openai-proxy`;

    // Prepare messages for the API
    const messages = [
      {
        role: 'system',
        content: 'You are a decision analysis expert. Analyze if goal clarification is needed and provide a response in JSON format.'
      },
      {
        role: 'user',
        content: `Please analyze if goal clarification is needed and provide a response in JSON format:

Decision: "${decision}"
Type: ${decisionType}
Reversibility: ${reversibility}
Importance: ${importance}

Required JSON format:
{
  "reason": "Explanation of whether goal clarification is needed",
  "suggestedQuestion": "Optional question to help clarify goals"
}`
      }
    ];

    // Make request to Edge Function
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        messages,
        options: {
          max_tokens: 500,
          temperature: 0.3,
          response_format: { type: 'json_object' }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.content;

    const parsed = JSON.parse(content);
    return {
      reason: parsed.reason,
      suggestedQuestion: parsed.suggestedQuestion
    };
  } catch (error) {
    console.error('Goal clarification error:', error);
    throw error;
  }
}

// —————————————————————————————————————————————————————————————————————————————
// Existing: registerInterest
// —————————————————————————————————————————————————————————————————————————————
interface RegistrationError {
  code: string
  message: string
  details?: { status?: string }
}

export async function registerInterest(
  email: string
): Promise<{ error: RegistrationError | null; data?: any }> {
  try {
    // First check if email already exists using a public function
    const { data: existingRegistration, error: checkError } =
      await supabase.rpc('check_registration_exists', {
        email_to_check: email,
      })

    if (checkError) {
      console.error('Error checking existing registration:', checkError)
      return {
        error: {
          code: 'CHECK_ERROR',
          message: 'Failed to check registration status. Please try again.',
        },
      }
    }

    if (existingRegistration?.exists) {
      return {
        error: {
          code: '23505', // Postgres unique violation code
          message:
            existingRegistration.status === 'approved'
              ? 'This email is already registered and approved. Please check your email for access instructions.'
              : "This email is already registered. You'll be notified when early access is available.",
          details: {
            status: existingRegistration.status,
          },
        },
      }
    }

    // If email doesn't exist, proceed with registration
    const { data, error: insertError } = await supabase
      .from('interest_registrations')
      .insert([
        {
          email,
          ip_address: window.location.hostname,
          status: 'pending',
        },
      ])
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting registration:', insertError)

      // Handle specific error cases
      if (insertError.code === '23514') {
        return {
          error: {
            code: '23514',
            message: 'Please enter a valid email address.',
          },
        }
      }

      return {
        error: {
          code: 'INSERT_ERROR',
          message: 'Failed to register interest. Please try again.',
        },
      }
    }

    return { data, error: null }
  } catch (error) {
    console.error('Unexpected error during registration:', error)
    return {
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred. Please try again.',
      },
    }
  }
}