import { 
  Scale, 
  BarChart2, 
  ListChecks, 
  Layers, 
  AlertOctagon, 
  DollarSign, 
  BarChart 
} from 'lucide-react';

export interface EvaluationMethod {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  icon: React.ElementType;
  usageExamples: string[];
  requiresCriteria: boolean;
  suitableFor: {
    decisionTypes: string[];
    importance: string[];
    reversibility: string[];
  };
}

export const evaluationMethods: EvaluationMethod[] = [
  {
    id: 'weighted-criteria',
    name: 'Weighted Criteria Matrix',
    description: 'Score each option against key criteria, with criteria weighted by importance.',
    longDescription: 'A systematic approach that evaluates options against multiple criteria, with each criterion weighted by importance. This provides a quantitative score for each option, making it easier to compare them objectively.',
    icon: Scale,
    usageExamples: [
      'Complex decisions with multiple factors to consider',
      'When you need to balance competing priorities',
      'For transparent, defensible decision-making'
    ],
    requiresCriteria: true,
    suitableFor: {
      decisionTypes: ['professional', 'financial', 'career', 'other'],
      importance: ['high_priority_urgent', 'critical_in_depth_analysis'],
      reversibility: ['partially', 'irreversible']
    }
  },
  {
    id: 'weighted-pros-cons',
    name: 'Weighted Pros & Cons',
    description: 'Compare options by listing and weighting their advantages and disadvantages.',
    longDescription: 'An enhanced version of the classic pros and cons list where each pro and con is assigned a weight based on its importance. This helps account for the fact that not all advantages and disadvantages are equally significant.',
    icon: BarChart2,
    usageExamples: [
      'When you have a few well-defined options',
      'For decisions with clear trade-offs',
      'When you want a simple but effective approach'
    ],
    requiresCriteria: false,
    suitableFor: {
      decisionTypes: ['professional', 'financial', 'health', 'career', 'relationships', 'other'],
      importance: ['low_priority_quick_assessment', 'moderate_priority_thorough_quick'],
      reversibility: ['reversible', 'partially', 'unsure']
    }
  },
  {
    id: 'effort-impact',
    name: 'Effort-Impact Matrix',
    description: 'Visualize options by plotting effort required versus impact/benefit.',
    longDescription: 'A visual decision-making tool that plots options on a 2x2 grid based on the effort required to implement them and their potential impact. This helps identify "quick wins" (high impact, low effort) and avoid "thankless tasks" (low impact, high effort).',
    icon: BarChart,
    usageExamples: [
      'Prioritizing tasks or initiatives',
      'When resources are limited',
      'For visual thinkers'
    ],
    requiresCriteria: false,
    suitableFor: {
      decisionTypes: ['professional', 'financial'],
      importance: ['low_priority_quick_assessment', 'moderate_priority_thorough_quick'],
      reversibility: ['reversible', 'partially']
    }
  },
  {
    id: 'rice-scoring',
    name: 'RICE Scoring',
    description: 'Prioritize initiatives by Reach, Impact, Confidence, and Effort.',
    longDescription: 'A prioritization framework that scores options based on four factors: Reach (how many people will it affect), Impact (how much it will affect them), Confidence (how sure you are about the estimates), and Effort (how much time it will take). The formula is (Reach × Impact × Confidence) ÷ Effort.',
    icon: ListChecks,
    usageExamples: [
      'Product feature prioritization',
      'Project portfolio management',
      'Resource allocation decisions'
    ],
    requiresCriteria: false,
    suitableFor: {
      decisionTypes: ['professional'],
      importance: ['moderate_priority_thorough_quick', 'high_priority_urgent'],
      reversibility: ['reversible', 'partially']
    }
  },
  {
    id: 'pre-mortem',
    name: 'Pre-mortem Analysis',
    description: 'Identify potential points of failure and mitigation strategies before committing.',
    longDescription: 'A risk analysis technique where you imagine that your decision has failed, then work backward to determine what potentially could lead to the failure. This helps identify risks and develop preventive measures before making the decision.',
    icon: AlertOctagon,
    usageExamples: [
      'High-risk decisions',
      'When failure would be costly',
      'For decisions with many unknowns'
    ],
    requiresCriteria: false,
    suitableFor: {
      decisionTypes: ['professional', 'financial', 'career'],
      importance: ['high_priority_urgent', 'critical_in_depth_analysis'],
      reversibility: ['irreversible', 'partially']
    }
  },
  {
    id: 'moscow',
    name: 'MoSCoW Prioritization',
    description: 'Categorize options into Must have, Should have, Could have, Won\'t have.',
    longDescription: 'A prioritization technique that categorizes options into four groups: Must have (essential), Should have (important but not critical), Could have (desirable but not necessary), and Won\'t have (not a priority now but maybe later). This helps focus on what\'s truly essential.',
    icon: Layers,
    usageExamples: [
      'Feature prioritization',
      'Project scope definition',
      'When facing time constraints'
    ],
    requiresCriteria: false,
    suitableFor: {
      decisionTypes: ['professional'],
      importance: ['moderate_priority_thorough_quick', 'high_priority_urgent'],
      reversibility: ['reversible', 'partially']
    }
  },
  {
    id: 'cost-benefit',
    name: 'Cost-Benefit Analysis',
    description: 'Quantify and compare the costs and benefits of each option.',
    longDescription: 'A systematic approach to estimating the strengths and weaknesses of alternatives by determining the benefits and costs of each option. This helps determine which option provides the best approach to achieve benefits while preserving savings.',
    icon: DollarSign,
    usageExamples: [
      'Financial decisions',
      'Business investments',
      'Policy evaluations'
    ],
    requiresCriteria: false,
    suitableFor: {
      decisionTypes: ['financial', 'professional'],
      importance: ['high_priority_urgent', 'critical_in_depth_analysis'],
      reversibility: ['partially', 'irreversible']
    }
  }
];

/**
 * Get a method by its ID
 */
export function getMethodById(id: string): EvaluationMethod | undefined {
  return evaluationMethods.find(method => method.id === id);
}

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
    // If missing context, recommend methods that don't require criteria if no criteria defined
    return hasCriteria 
      ? evaluationMethods
      : evaluationMethods.filter(method => !method.requiresCriteria);
  }
  
  // Score each method based on suitability
  const scoredMethods = evaluationMethods.map(method => {
    let score = 0;
    
    // Check decision type match
    if (method.suitableFor.decisionTypes.includes(decisionType)) {
      score += 2;
    }
    
    // Check importance match
    if (method.suitableFor.importance.includes(importance)) {
      score += 2;
    }
    
    // Check reversibility match
    if (method.suitableFor.reversibility.includes(reversibility)) {
      score += 1;
    }
    
    // Penalize methods that require criteria if none defined
    if (method.requiresCriteria && !hasCriteria) {
      score -= 10; // Large penalty to ensure these appear last
    }
    
    return { method, score };
  });
  
  // Sort by score (descending) and return top methods
  return scoredMethods
    .sort((a, b) => b.score - a.score)
    .map(item => item.method)
    .filter(method => !method.requiresCriteria || hasCriteria);
}