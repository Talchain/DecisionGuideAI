import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

interface ConsiderationConfig {
  primary: string[];
  optional?: string[];
  contextLabel: string;
}

interface PromptConfig {
  [key: string]: ConsiderationConfig;
}

interface ImportanceConfig {
  [key: string]: string;
}

interface ReversibilityConfig {
  label: string;
  context: string;
}

interface PromptTemplates {
  decisionTypes: PromptConfig;
  importanceLevels: ImportanceConfig;
  importanceLabels: ImportanceConfig;
  reversibilityTypes: Record<string, ReversibilityConfig>;
  systemPrompt: string;
}

const templates: PromptTemplates = {
  decisionTypes: {
    professional: {
      primary: [
        "Impact on organization and stakeholders",
        "Resource requirements",
        "Implementation timeline",
        "Key risks and opportunities"
      ],
      optional: [
        "Market implications",
        "Change management needs",
        "Long-term sustainability",
        "Compliance considerations"
      ],
      contextLabel: "professional/organizational"
    },
    financial: {
      primary: [
        "Return on investment",
        "Risk assessment",
        "Market conditions",
        "Cash flow impact"
      ],
      optional: [
        "Tax implications",
        "Alternative options",
        "Long-term sustainability",
        "Risk management"
      ],
      contextLabel: "financial/investment"
    },
    health: {
      primary: [
        "Quality of life impact",
        "Required lifestyle changes",
        "Support needed",
        "Well-being factors"
      ],
      optional: [
        "Medical evidence",
        "Alternative approaches",
        "Long-term implications",
        "Recovery needs"
      ],
      contextLabel: "health/lifestyle"
    },
    career: {
      primary: [
        "Growth potential",
        "Required changes",
        "Timeline implications",
        "Key opportunities"
      ],
      optional: [
        "Industry trends",
        "Skill development needs",
        "Work-life balance",
        "Long-term prospects"
      ],
      contextLabel: "career/professional development"
    },
    relationships: {
      primary: [
        "Emotional impact",
        "Communication needs",
        "Required changes",
        "Support implications"
      ],
      optional: [
        "Long-term outlook",
        "Values alignment",
        "Cultural factors",
        "Mutual benefits"
      ],
      contextLabel: "interpersonal/relationship"
    },
    other: {
      primary: [
        "Key impacts",
        "Required resources",
        "Timeline needs",
        "Main risks"
      ],
      optional: [
        "Alternative options",
        "Success metrics",
        "Long-term implications",
        "Stakeholder impact"
      ],
      contextLabel: "general"
    }
  },

  reversibilityTypes: {
    reversible: {
      label: "Fully Reversible",
      context: "The decision can be undone or changed later with minimal consequences"
    },
    partially: {
      label: "Partially Reversible",
      context: "Some aspects of the decision can be changed, but others will have lasting effects"
    },
    irreversible: {
      label: "Irreversible",
      context: "The decision cannot be undone once made and will have permanent consequences"
    },
    unsure: {
      label: "Uncertain Reversibility",
      context: "The ability to reverse or change this decision later is unclear or depends on unknown factors"
    }
  },

  importanceLevels: {
    low_priority_quick_assessment: 'Focus on immediate key factors and quick wins. Keep it brief and actionable.',
    moderate_priority_thorough_quick: 'Balance thoroughness with efficiency. Highlight practical next steps.',
    high_priority_urgent: 'Prioritize critical factors and immediate actions while noting key risks.',
    critical_in_depth_analysis: 'Provide comprehensive analysis with clear decision framework and risk assessment.'
  },

  importanceLabels: {
    low_priority_quick_assessment: 'Low Priority, Quick Assessment',
    moderate_priority_thorough_quick: 'Moderate Priority, Thorough but Quick',
    high_priority_urgent: 'High Priority, Urgent',
    critical_in_depth_analysis: 'Critical, In-Depth Analysis'
  },

  systemPrompt: `You are a decision analysis, behavioural science, cognitive psychology, and neuroscience expert helping users make better choices. 
  
Your role is to:
1. Guide users through an optimal decision-making process based on their decision type and its reversibility, importance, and complexity 
2. Help identify any blind spots, missing considerations, or potential biases

You are now guiding the user to update their decision options with weighted pros and cons that you just provided to make it more relevant to them. 

For each response:
1. Use a friendly and comforting communication style with a clean and spacious layout
2. Briefly acknowledge the current situation, the decision they face, and any goals they provide
3. Provide analysis and guidance based on principles from behavioural science, cognitive psychology, and neuroscience to help the user complete their list of options with weighted pros and cons. 

Keep responses clear, actionable, and appropriate to the decision's scope.`
};

export function generatePromptMessages(
  decision: string,
  decisionType: string,
  reversibility: string,
  importance: string,
  goals?: string[],
  context?: any[],
  query?: string
): ChatCompletionMessageParam[] {
  try {
    // Validate required parameters
    if (!decision || !decisionType || !reversibility || !importance) {
      throw new Error('Missing required parameters for prompt generation');
    }

    // Get configuration based on decision type
    const config = templates.decisionTypes[decisionType] || templates.decisionTypes.other;
    const importanceLabel = templates.importanceLabels[importance] || importance;
    const reversibilityInfo = templates.reversibilityTypes[reversibility];

    if (!config || !reversibilityInfo) {
      throw new Error('Invalid decision type or reversibility');
    }

    const basePrompt = `Help me with this ${config.contextLabel} decision: "${decision}"

Context:
• Reversibility: ${reversibilityInfo.label} - ${reversibilityInfo.context}
• Importance: ${importanceLabel}
${goals?.length ? `• Goals:\n${goals.map(goal => `  - ${goal}`).join('\n')}` : ''}

Guide me through the next step in this decision-making process, considering the appropriate depth of analysis for its importance level and the ${reversibilityInfo.label.toLowerCase()} nature of the decision.`;

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: templates.systemPrompt
      },
      {
        role: 'user',
        content: basePrompt
      }
    ];

    if (context && query) {
      messages.push(
        ...context.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        {
          role: 'user',
          content: query
        }
      );
    }

    return messages;
  } catch (error) {
    console.error('Error generating prompt messages:', error);
    throw new Error('Failed to generate prompt messages');
  }
}

function generatePrompt(
  decision: string,
  decisionType: string,
  reversibility: string,
  importance: string,
  goals?: string[]
): string {
  const messages = generatePromptMessages(decision, decisionType, reversibility, importance, goals);
  return JSON.stringify(messages, null, 2);
}