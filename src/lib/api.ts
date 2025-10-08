// src/lib/api.ts

import OpenAI from 'openai'
import { generatePromptMessages } from './prompts'
import { supabase } from './supabase'

// —————————————————————————————————————————————————————————————————————————————
// Environment variables & OpenAI client
// —————————————————————————————————————————————————————————————————————————————
const VITE_OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const useEngineOnly = !VITE_OPENAI_API_KEY

if (useEngineOnly) {
  console.warn('⚠️ VITE_OPENAI_API_KEY not set - OpenAI client-side calls disabled. Using Engine service only.')
}

const openai = VITE_OPENAI_API_KEY ? new OpenAI({
  apiKey: VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
}) : null

// —————————————————————————————————————————————————————————————————————————————
// Helper: create chat completion with retries (no response_format)
// —————————————————————————————————————————————————————————————————————————————
async function createChatCompletion(
  messages: any[],
  options: {
    model?: string
    temperature?: number
    max_tokens?: number
    response_format?: { type: 'json_object' | 'text' }
  } = {},
  retries = 3
): Promise<{ content: string; prompt: any; rawResponse: any }> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Set VITE_OPENAI_API_KEY or use Engine service.')
  }

  let lastError: Error | null = null
  let delay = 1000

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Invalid messages format')
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: options.model ?? 'gpt-4',
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 1500,
        // Pass through response_format when callers request JSON-object mode
        ...(options.response_format ? { response_format: options.response_format } : {})
      })

      const content = completion.choices[0].message.content
      if (!content) {
        throw new Error('Empty response from API')
      }
      return { content, prompt: messages, rawResponse: completion }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error occurred')
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, delay))
        delay *= 2
      }
    }
  }

  throw lastError || new Error('Failed to get API response after retries')
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
3. If applicable, include one “test or reframe” option (e.g. a small experiment or data gathering).

Requirements for biases:
1. List at least 4 biases most likely to affect this decision.
2. For each, give a concise, plain-language description of its influence.

Do not include any text outside the JSON. If you fail to generate valid JSON, return:
{"error": true, "message": "Could not generate JSON as specified"}
`.trim()
    }
  ]

  const { content, prompt, rawResponse } = await createChatCompletion(
    messages,
    {
      model: 'gpt-4',
      temperature: 0.7,
      max_tokens: 1500
    }
  )

  const parsed = JSON.parse(content)
  return { ...parsed, prompt, rawResponse }
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
      { max_tokens: importance === 'critical_in_depth_analysis' ? 2000 : 1000 }
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
      throw new Error('Missing required parameters for options analysis')
    }

    const { content, prompt, rawResponse } = await createChatCompletion(
      [
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
      ],
      {
        max_tokens: 1500,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }
    )

    const parsed = JSON.parse(content)
    return { ...parsed, prompt, rawResponse }
  } catch (error) {
    console.error(
      'Options analysis error:',
      { error, context: { decision, decisionType, reversibility, importance } }
    )
    throw error
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
    const { content } = await createChatCompletion(
      [
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
      ],
      { max_tokens: 500, temperature: 0.3, response_format: { type: 'json_object' } }
    )
    const parsed = JSON.parse(content)
    return {
      reason: parsed.reason,
      suggestedQuestion: parsed.suggestedQuestion
    }
  } catch (error) {
    console.error('Goal clarification error:', error)
    throw error
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