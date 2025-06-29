// src/lib/api.ts

import { generatePromptMessages } from './prompts'
import { supabase } from './supabase'

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

    // Get the current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Authentication required');
    }

    const supabaseUrl = supabase.supabaseUrl;
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/openai-proxy`;

    const promptMessages = generatePromptMessages(
      decision,
      decisionType,
      reversibility,
      importance,
      goals,
      messages,
      query
    )

    // Make request to Edge Function
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        messages: promptMessages,
        options: {
          max_tokens: importance === 'critical_in_depth_analysis' ? 2000 : 1000,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.content;

    return {
      analysis: content,
      cached: false,
      prompt: promptMessages,
      rawResponse: result
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
      throw new Error('Missing required parameters for options analysis')
    }

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
          max_tokens: 1500,
          temperature: 0.7,
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
    return { ...parsed, prompt: messages, rawResponse: result };
  } catch (error) {
    console.error(
      'Options analysis error:',
      { error, context: { decision, decisionType, reversibility, importance } }
    );
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