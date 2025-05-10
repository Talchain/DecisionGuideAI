// src/lib/api.ts

import OpenAI from 'openai'
import { generatePromptMessages } from './prompts'
import { supabase } from './supabase'

// —————————————————————————————————————————————————————————————————————————————
// Environment variables & OpenAI client
// —————————————————————————————————————————————————————————————————————————————
const VITE_OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
if (!VITE_OPENAI_API_KEY) {
  console.error('Missing OpenAI API key')
  throw new Error('Missing OpenAI API key')
}

const openai = new OpenAI({
  apiKey: VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
})

// —————————————————————————————————————————————————————————————————————————————
// Helper: create chat completion with retries & JSON support
// —————————————————————————————————————————————————————————————————————————————
async function createChatCompletion(
  messages: any[],
  options: {
    model?: string
    temperature?: number
    max_tokens?: number
    response_format?: { type: string }
  } = {},
  retries = 3
): Promise<{ content: string; prompt: any; rawResponse: any }> {
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
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
        response_format: options.response_format,
      })

      const content = completion.choices[0].message.content
      if (!content) throw new Error('Empty response from API')
      return { content, prompt: messages, rawResponse: completion }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error')
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
// generateOptionsIdeation
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
Your task is to help a user generate the most promising options for a decision, and to highlight the cognitive biases they should guard against.

Always respond with exactly one JSON object—no extra text, markdown, or code fences.
If you cannot comply, return {"error": true, "message": "reason"}.
`.trim()
    },
    {
      role: 'user',
      content: `
Please analyse this decision context to generate viable options and potential biases:

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
      max_tokens: 1500,
      response_format: { type: 'json_object' }
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
    return { analysis: content, cached: false, prompt, rawResponse }
  } catch (error) {
    console.error('Analysis error:', { error, context: { decision, decisionType, reversibility, importance }})
    throw error
  }
}

// —————————————————————————————————————————————————————————————————————————————
// Existing: analyzeOptions (pros/cons version)
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
   - Key pros
   - Key cons
2. Identify 3-6 cognitive biases most relevant to this decision. For each bias provide:
   - Its name
   - A concise definition
   - A practical tip for mitigation

Required JSON format:
{
  "options": [
    {
      "name": "Option name",
      "pros": ["pro1", "pro2"],
      "cons": ["con1", "con2"]
    }
  ],
  "biases": [
    {
      "name": "Bias name",
      "definition": "Brief definition",
      "mitigationTip": "Mitigation advice"
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
    console.error('Options analysis error:', { error, context: { decision, decisionType, reversibility, importance }})
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
    const { content, prompt, rawResponse } = await createChatCompletion(
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
    // Check if email already exists
    const { data: existing, error: checkErr } = await supabase.rpc(
      'check_registration_exists',
      { email_to_check: email }
    )
    if (checkErr) {
      console.error('Error checking existing registration:', checkErr)
      return {
        error: {
          code: 'CHECK_ERROR',
          message: 'Failed to check registration status. Please try again.'
        }
      }
    }
    if (existing?.exists) {
      return {
        error: {
          code: '23505',
          message:
            existing.status === 'approved'
              ? 'This email is already registered and approved.'
              : 'This email is registered; you will be notified when access is available.',
          details: { status: existing.status }
        }
      }
    }
    // Insert new registration
    const { data, error: insertErr } = await supabase
      .from('interest_registrations')
      .insert([{ email, ip_address: window.location.hostname, status: 'pending' }])
      .select()
      .single()
    if (insertErr) {
      console.error('Error inserting registration:', insertErr)
      return {
        error: {
          code: insertErr.code ?? 'INSERT_ERROR',
          message: insertErr.code === '23514'
            ? 'Please enter a valid email address.'
            : 'Failed to register interest. Please try again.'
        }
      }
    }
    return { data, error: null }
  } catch (error) {
    console.error('Unexpected registration error:', error)
    return {
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred. Please try again.'
      }
    }
  }
}