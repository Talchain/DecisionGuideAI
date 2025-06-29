import { 
  Scale, 
  BarChart2, 
  Grid, 
  Calculator, 
  AlertOctagon, 
  ListChecks, 
  DollarSign,
  Brain
} from 'lucide-react';

export interface EvaluationMethod {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  longDescription: string;
  usageExamples: string[];
  recommendedFor: {
    decisionTypes: string[];
    importance: string[];
    reversibility: string[];
  };
  setupInstructions?: string;
  requiresCriteria: boolean;
}

export const evaluationMethods: EvaluationMethod[] = [
  {
    id: 'weighted-criteria-matrix',
    name: 'Weighted Criteria Matrix',
    description: 'Score each option against key criteria, with criteria weighted by importance.',
    icon: Scale,
    longDescription: 'A weighted criteria matrix helps you evaluate options by scoring them against multiple criteria, with each criterion weighted by importance. This method is ideal for complex decisions with multiple factors to consider.',
    usageExamples: [
      'Choosing between multiple job offers based on salary, location, growth potential, etc.',
      'Selecting a vendor based on price, quality, support, and reliability',
      'Deciding between product features based on development cost, user impact, and strategic alignment'
    ],
    recommendedFor: {
      decisionTypes: ['professional', 'financial', 'career', 'other'],
      importance: ['high_priority_urgent', 'critical_in_depth_analysis', 'moderate_priority_thorough_quick'],
      reversibility: ['partially', 'irreversible', 'unsure']
    },
    requiresCriteria: true
  },
  {
    id: 'weighted-pros-cons',
    name: 'Weighted Pros & Cons Analysis',
    description: 'Compare options by listing and weighting their advantages and disadvantages.',
    icon: BarChart2,
    longDescription: 'This method enhances the traditional pros and cons list by assigning weights to each factor. It helps you see which option has the strongest advantages and most manageable disadvantages.',
    usageExamples: [
      'Deciding whether to accept a job offer',
      'Evaluating whether to move to a new city',
      'Choosing between two competing strategies'
    ],
    recommendedFor: {
      decisionTypes: ['professional', 'financial', 'health', 'career', 'relationships', 'other'],
      importance: ['low_priority_quick_assessment', 'moderate_priority_thorough_quick', 'high_priority_urgent'],
      reversibility: ['reversible', 'partially', 'unsure']
    },
    requiresCriteria: false
  },
  {
    id: 'effort-impact-matrix',
    name: 'Effort-Impact Matrix',
    description: 'Visualize options by plotting effort required versus impact/benefit.',
    icon: Grid,
    longDescription: 'The Effort-Impact Matrix plots options on a 2x2 grid based on the effort required to implement them and their potential impact. This visual approach helps prioritize high-impact, low-effort options.',
    usageExamples: [
      'Prioritizing product features for development',
      'Selecting process improvement initiatives',
      'Choosing between marketing campaigns'
    ],
    recommendedFor: {
      decisionTypes: ['professional', 'financial'],
      importance: ['moderate_priority_thorough_quick', 'high_priority_urgent'],
      reversibility: ['reversible', 'partially']
    },
    requiresCriteria: false
  },
  {
    id: 'rice-scoring',
    name: 'RICE Scoring',
    description: 'Prioritize initiatives by Reach, Impact, Confidence, and Effort.',
    icon: Calculator,
    longDescription: 'RICE scoring evaluates options based on four factors: Reach (how many people will it affect), Impact (how much it will affect each person), Confidence (how sure you are about the estimates), and Effort (how much time it will take). The formula is (Reach × Impact × Confidence) ÷ Effort.',
    usageExamples: [
      'Prioritizing product roadmap items',
      'Selecting marketing initiatives',
      'Choosing between business opportunities'
    ],
    recommendedFor: {
      decisionTypes: ['professional', 'financial'],
      importance: ['moderate_priority_thorough_quick', 'high_priority_urgent', 'critical_in_depth_analysis'],
      reversibility: ['partially', 'unsure']
    },
    requiresCriteria: false
  },
  {
    id: 'premortem-analysis',
    name: 'Pre-mortem Analysis',
    description: 'Identify potential points of failure and mitigation strategies before committing.',
    icon: AlertOctagon,
    longDescription: 'A pre-mortem analysis asks you to imagine that your decision has failed, then work backward to determine what potentially could lead to the failure. This helps identify risks and develop mitigation strategies before they occur.',
    usageExamples: [
      'Launching a new product or feature',
      'Implementing a major organizational change',
      'Making a significant investment'
    ],
    recommendedFor: {
      decisionTypes: ['professional', 'financial', 'career'],
      importance: ['high_priority_urgent', 'critical_in_depth_analysis'],
      reversibility: ['irreversible', 'unsure']
    },
    requiresCriteria: false
  },
  {
    id: 'moscow-prioritization',
    name: 'MoSCoW Prioritization',
    description: 'Categorize options into Must have, Should have, Could have, Won\'t have.',
    icon: ListChecks,
    longDescription: 'MoSCoW prioritization helps you categorize options based on their importance: Must have (essential), Should have (important but not critical), Could have (desirable but not necessary), and Won\'t have (not needed now but maybe later).',
    usageExamples: [
      'Defining project requirements',
      'Planning feature releases',
      'Allocating resources across initiatives'
    ],
    recommendedFor: {
      decisionTypes: ['professional', 'financial'],
      importance: ['moderate_priority_thorough_quick', 'high_priority_urgent'],
      reversibility: ['reversible', 'partially']
    },
    requiresCriteria: false
  },
  {
    id: 'cost-benefit-analysis',
    name: 'Cost-Benefit Analysis',
    description: 'Quantify and compare the costs and benefits of each option.',
    icon: DollarSign,
    longDescription: 'Cost-benefit analysis involves identifying, quantifying, and comparing the costs and benefits of each option. This method is particularly useful for financial decisions or when tangible outcomes can be measured.',
    usageExamples: [
      'Evaluating a potential investment',
      'Deciding whether to hire additional staff',
      'Assessing whether to build or buy a solution'
    ],
    recommendedFor: {
      decisionTypes: ['professional', 'financial'],
      importance: ['moderate_priority_thorough_quick', 'high_priority_urgent', 'critical_in_depth_analysis'],
      reversibility: ['partially', 'irreversible']
    },
    requiresCriteria: false
  },
  {
    id: 'decision-tree',
    name: 'Decision Tree Analysis',
    description: 'Map out possible outcomes and their probabilities for each option.',
    icon: Brain,
    longDescription: 'Decision tree analysis creates a flowchart-like diagram that shows the possible outcomes of each option, along with their probabilities and consequences. This helps visualize complex decisions with multiple possible outcomes.',
    usageExamples: [
      'Making decisions under uncertainty',
      'Planning for different scenarios',
      'Evaluating options with multiple possible outcomes'
    ],
    recommendedFor: {
      decisionTypes: ['professional', 'financial', 'career', 'health'],
      importance: ['high_priority_urgent', 'critical_in_depth_analysis'],
      reversibility: ['partially', 'irreversible', 'unsure']
    },
    requiresCriteria: false
  }
];

/**
 * Get recommended evaluation methods based on decision context
 */
export function getRecommendedMethods(
  decisionType: string | null,
  importance: string | null,
  reversibility: string | null,
  hasCriteria: boolean
): EvaluationMethod[] {
  if (!decisionType || !importance || !reversibility) {
    // If missing context, return all methods
    return evaluationMethods;
  }

  // Filter methods based on decision context
  const recommendedMethods = evaluationMethods.filter(method => {
    // Skip methods that require criteria if none are defined
    if (method.requiresCriteria && !hasCriteria) {
      return false;
    }

    // Check if method is recommended for this decision type
    const matchesType = method.recommendedFor.decisionTypes.includes(decisionType) || 
                        method.recommendedFor.decisionTypes.includes('other');
    
    // Check if method is recommended for this importance level
    const matchesImportance = method.recommendedFor.importance.includes(importance);
    
    // Check if method is recommended for this reversibility level
    const matchesReversibility = method.recommendedFor.reversibility.includes(reversibility);
    
    // Method is recommended if it matches at least 2 of the 3 criteria
    const matchCount = [matchesType, matchesImportance, matchesReversibility].filter(Boolean).length;
    return matchCount >= 2;
  });

  // If no methods are recommended, return all methods
  return recommendedMethods.length > 0 ? recommendedMethods : evaluationMethods;
}

/**
 * Get an evaluation method by ID
 */
export function getMethodById(id: string): EvaluationMethod | undefined {
  return evaluationMethods.find(method => method.id === id);
}