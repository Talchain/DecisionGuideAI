import { supabase } from './supabase';
import type { OptionIdeation, BiasIdeation } from './api';

export interface OptionsIdeationResponse {
  options: OptionIdeation[];
  biases: BiasIdeation[];
}

export async function generateOptionsIdeation({
  decision,
  decisionType,
  reversibility,
  importance,
  goals = []
}: {
  decision: string;
  decisionType: string;
  reversibility: string;
  importance: string;
  goals?: string[];
}): Promise<OptionsIdeationResponse> {
  try {
    if (!decision || !decisionType || !reversibility || !importance) {
      throw new Error('Missing required parameters for options ideation');
    }

    // Get the current session for authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      throw new Error(`Authentication error: ${sessionError.message}`);
    }
    
    if (!session) {
      throw new Error('You need to be signed in to generate options. Please sign in and try again.');
    }

    // Use the correct Supabase URL format
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/openai-proxy`;
    
    // Prepare messages for the API
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

    console.log('Making request to:', edgeFunctionUrl);
    console.log('With session token:', session.access_token ? 'Present' : 'Missing');

    // Make request to Edge Function with proper headers and timeout
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || ''
      },
      body: JSON.stringify({
        messages,
        options: {
          model: 'gpt-4',
          temperature: 0.7,
          max_tokens: 1500
        }
      }),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorText = await response.text();
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
          console.error('Error response data:', errorData);
        } catch (parseError) {
          // If JSON parsing fails, use the raw text
          console.error('Error response (not JSON):', errorText);
          errorMessage = errorText || errorMessage;
        }
      } catch (e) {
        console.error('Failed to read error response:', e);
      }
      
      // Provide more user-friendly messages for common error codes
      if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (response.status >= 500) {
        errorMessage = 'The AI service is currently unavailable. Please try again later.';
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('Success response:', result);
    
    const content = result?.content;
    if (!content) {
      throw new Error('Empty response from API');
    }

    // Parse the JSON response
    const parsed = JSON.parse(content);
    
    // Validate the response structure
    if (!parsed.options || !Array.isArray(parsed.options) || parsed.options.length === 0) {
      throw new Error('The AI couldn\'t generate any options for this decision. Please try again with more details.');
    }
    
    if (!parsed.biases || !Array.isArray(parsed.biases) || parsed.biases.length === 0) {
      throw new Error('Invalid response: missing or invalid biases array');
    }

    return parsed;
  } catch (error) {
    console.error(
      'Options ideation error:',
      { error, context: { decision, decisionType, reversibility, importance } }
    );
    
    // Provide user-friendly error messages based on error type
    if (error instanceof Error) {
      const errorMessage = error.message;
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        throw new Error('Network error: Please check your internet connection and try again.');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Timed out')) {
        throw new Error('The request timed out. The AI service might be busy, please try again in a moment.');
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        throw new Error('You\'ve reached the rate limit for AI requests. Please wait a moment before trying again.');
      } else if (errorMessage.includes('authentication') || errorMessage.includes('Unauthorized')) {
        throw new Error('Authentication error: Please sign in again and retry.');
      } else {
        throw new Error(`Options generation failed: ${error.message}`);
      }
    }
    throw new Error('Options generation failed. Please try again or contact support if the problem persists.');
  }
}