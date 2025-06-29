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
          model: 'gpt-4',
          temperature: 0.7,
          max_tokens: 1500
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.content;

    // Parse the JSON response
    const parsed = JSON.parse(content);
    return parsed;
  } catch (error) {
    console.error(
      'Options ideation error:',
      { error, context: { decision, decisionType, reversibility, importance } }
    );
    throw error;
  }
}