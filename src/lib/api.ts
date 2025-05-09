import OpenAI from 'openai';
import { generatePromptMessages } from "./prompts";
import { supabase } from './supabase';

// Environment variables
const VITE_OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

// Type definitions
export interface Option {
  name: string;
  pros: string[];
  cons: string[];
}

export interface Bias {
  name: string;
  definition: string;
  mitigationTip: string;
}

interface InterestRegistration {
  email: string;
  ip_address?: string;
  status?: string;
}

interface RegistrationError {
  code: string;
  message: string;
  details?: {
    status?: string;
  };
}

interface OptionsAnalysisResponse {
  options: Option[];
  biases: Bias[];
  prompt?: string;
  rawResponse?: any;
}

interface AnalysisRequest {
  decision: string;
  decisionType: string;
  reversibility: string;
  importance: string;
  messages?: any[];
  query?: string;
  goals?: string[];
  context?: any[];
}

interface AnalysisResponse {
  analysis: string;
  cached: boolean;
  prompt?: string;
  rawResponse?: any;
}

interface GoalClarificationResponse {
  reason: string;
  suggestedQuestion?: string;
}

// Helper function to create chat completion with retries and backoff
const createChatCompletion = async (
  messages: any[],
  options: { temperature?: number; max_tokens?: number; response_format?: { type: string } } = {},
  retries = 3
): Promise<{ content: string; prompt: any; rawResponse: any }> => {
  let lastError: Error | null = null;
  let delay = 1000;

  // Validate messages
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Invalid messages format');
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 1000,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
        response_format: options.response_format
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from API');
      }

      return {
        content,
        prompt: messages,
        rawResponse: completion
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error occurred');
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  throw lastError || new Error('Failed to get API response after retries');
};

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
    // Validate required parameters
    if (!decision || !decisionType || !reversibility || !importance) {
      throw new Error('Missing required parameters for analysis');
    }

    const promptMessages = generatePromptMessages(
      decision,
      decisionType,
      reversibility,
      importance,
      goals,
      messages,
      query
    );

    const { content, prompt, rawResponse } = await createChatCompletion(promptMessages, {
      max_tokens: importance === 'critical_in_depth_analysis' ? 2000 : 1000
    });

    return {
      analysis: content,
      cached: false,
      prompt,
      rawResponse
    };
  } catch (error) {
    console.error('Analysis error:', { error, context: { decision, decisionType, reversibility, importance }});
    throw error;
  }
};

export const analyzeOptions = async ({
  decision,
  decisionType,
  reversibility,
  importance,
  goals = []
}: AnalysisRequest): Promise<OptionsAnalysisResponse> => {
  try {
    // Validate required parameters
    if (!decision || !decisionType || !reversibility || !importance) {
      throw new Error('Missing required parameters for options analysis');
    }

    const { content, prompt, rawResponse } = await createChatCompletion([
      {
        role: 'system',
        content: 'You are a decision analysis and behavioural science expert. Analyze the decision and return a JSON response with options and biases.  Ensure your analysis is realistic and relevant to the decision context, importance, reversibility, and and any goals provided. Include 2-5 options with their pros and cons, and 3-6 cognitive biases with practical mitigation tips.'
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
    ], {
      max_tokens: 1500,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const parsedResponse = JSON.parse(content);
    return {
      ...parsedResponse,
      prompt,
      rawResponse
    };
  } catch (error) {
    console.error('Options analysis error:', { error, context: { decision, decisionType, reversibility, importance }});
    throw error;
  }
};

const analyzeGoalClarification = async ({
  decision,
  decisionType,
  reversibility,
  importance
}: AnalysisRequest): Promise<GoalClarificationResponse> => {
  try {
    const { content } = await createChatCompletion([
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
    ], {
      max_tokens: 500,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const response = JSON.parse(content);
    return {
      reason: response.reason,
      suggestedQuestion: response.suggestedQuestion
    };
  } catch (error) {
    console.error('Goal clarification error:', error);
    throw error;
  }
};

export async function registerInterest(
  email: string
): Promise<{ error: RegistrationError | null; data?: any }> {
  try {
    // First check if email already exists using a public function
    const { data: existingRegistration, error: checkError } =
      await supabase.rpc('check_registration_exists', {
        email_to_check: email,
      });

    if (checkError) {
      console.error('Error checking existing registration:', checkError);
      return {
        error: {
          code: 'CHECK_ERROR',
          message: 'Failed to check registration status. Please try again.',
        },
      };
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
      };
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
      .single();

    if (insertError) {
      console.error('Error inserting registration:', insertError);

      // Handle specific error cases
      if (insertError.code === '23514') {
        return {
          error: {
            code: '23514',
            message: 'Please enter a valid email address.',
          },
        };
      }

      return {
        error: {
          code: 'INSERT_ERROR',
          message: 'Failed to register interest. Please try again.',
        },
      };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error during registration:', error);
    return {
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred. Please try again.',
      },
    };
  }
}

;