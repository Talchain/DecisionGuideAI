// Criteria Templates for Product Teams
// This module contains predefined templates for common product team decisions

import { v4 as uuidv4 } from 'uuid';
import type { Criterion } from '../contexts/DecisionContext';

export interface CriteriaTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  criteria: Criterion[];
}

// Generate unique IDs for criteria
const generateCriterion = (name: string, weight: number = 3, tooltip?: string): Criterion => ({
  id: uuidv4(),
  name,
  weight,
  tooltip
});

export const PRODUCT_TEAM_TEMPLATES: CriteriaTemplate[] = [
  {
    id: 'feature-prioritization',
    name: 'Feature Prioritization',
    description: 'Evaluate and rank new features for your product roadmap.',
    type: 'professional',
    criteria: [
      generateCriterion('User Value / Impact', 5, 'How much value does this feature provide to users?'),
      generateCriterion('Effort / Cost', 4, 'Development time, resources, and complexity required'),
      generateCriterion('Strategic Fit', 4, 'Alignment with company strategy and product vision'),
      generateCriterion('Risk', 3, 'Technical, market, or execution risks involved'),
      generateCriterion('Time to Deliver', 3, 'Speed of implementation and time to market'),
      generateCriterion('Differentiation', 4, 'Competitive advantage and uniqueness'),
      generateCriterion('Technical Feasibility', 3, 'Technical complexity and implementation challenges')
    ]
  },
  {
    id: 'roadmap-planning',
    name: 'Roadmap Planning / Quarterly Planning',
    description: 'Plan and prioritize initiatives for upcoming quarters.',
    type: 'professional',
    criteria: [
      generateCriterion('Strategic Alignment', 5, 'How well does this align with company OKRs?'),
      generateCriterion('Resource Availability', 4, 'Do we have the right people and skills?'),
      generateCriterion('Customer Demand', 5, 'Level of customer need and market pull'),
      generateCriterion('Dependencies', 3, 'External dependencies and blockers'),
      generateCriterion('Business Value', 5, 'Expected revenue or business impact'),
      generateCriterion('Urgency', 4, 'Time sensitivity and market timing'),
      generateCriterion('Confidence in Estimates', 3, 'How confident are we in our planning?')
    ]
  },
  {
    id: 'go-no-go-launch',
    name: 'Go/No-Go Launch Decision',
    description: 'Decide whether to proceed with a product or feature launch.',
    type: 'professional',
    criteria: [
      generateCriterion('Market Readiness', 5, 'Is the market ready for this solution?'),
      generateCriterion('Product Completeness', 4, 'Feature completeness and quality level'),
      generateCriterion('Customer Validation', 5, 'Evidence of customer need and acceptance'),
      generateCriterion('Technical Stability', 4, 'System reliability and performance'),
      generateCriterion('Compliance / Risk', 4, 'Legal, security, and regulatory considerations'),
      generateCriterion('Revenue Potential', 5, 'Expected financial returns'),
      generateCriterion('Team Readiness', 3, 'Support, marketing, and operational readiness')
    ]
  },
  {
    id: 'vendor-tool-selection',
    name: 'Vendor/Tool Selection',
    description: 'Evaluate and select vendors, tools, or third-party services.',
    type: 'professional',
    criteria: [
      generateCriterion('Cost / ROI', 5, 'Total cost of ownership and return on investment'),
      generateCriterion('Reliability', 4, 'Uptime, stability, and track record'),
      generateCriterion('Integration Fit', 4, 'How well does it integrate with existing systems?'),
      generateCriterion('Support / Service', 4, 'Quality of customer support and documentation'),
      generateCriterion('Scalability', 4, 'Ability to grow with our needs'),
      generateCriterion('Security', 5, 'Data protection and security features'),
      generateCriterion('User Experience', 3, 'Ease of use and adoption by team')
    ]
  },
  {
    id: 'hiring-team-expansion',
    name: 'Hiring or Team Expansion',
    description: 'Evaluate candidates or decide on team structure changes.',
    type: 'professional',
    criteria: [
      generateCriterion('Skills Fit', 5, 'Technical and functional skills match'),
      generateCriterion('Cultural Alignment', 4, 'Fit with company values and culture'),
      generateCriterion('Learning Potential', 4, 'Growth mindset and adaptability'),
      generateCriterion('Team Impact', 4, 'Positive influence on team dynamics'),
      generateCriterion('Experience Level', 3, 'Relevant industry and role experience'),
      generateCriterion('Communication / Collaboration', 4, 'Ability to work effectively with others'),
      generateCriterion('Availability', 3, 'Timeline and commitment level')
    ]
  },
  {
    id: 'experiment-initiative',
    name: 'Experiment or Initiative Evaluation',
    description: 'Assess experiments, pilots, or new initiatives before launch.',
    type: 'professional',
    criteria: [
      generateCriterion('Hypothesis Clarity', 4, 'Clear, testable hypothesis defined'),
      generateCriterion('Learning Value', 5, 'Potential insights and knowledge gained'),
      generateCriterion('Cost / Effort', 4, 'Resources required to execute'),
      generateCriterion('Time to Insight', 4, 'How quickly will we get results?'),
      generateCriterion('Risk of Failure', 3, 'Acceptable risk level and failure cost'),
      generateCriterion('Scalability if Successful', 4, 'Potential for broader application'),
      generateCriterion('Alignment with OKRs', 4, 'Connection to current objectives')
    ]
  },
  {
    id: 'strategic-investment',
    name: 'Strategic Investment / Budget Allocation',
    description: 'Decide on major investments or budget allocation across initiatives.',
    type: 'financial',
    criteria: [
      generateCriterion('ROI Potential', 5, 'Expected return on investment'),
      generateCriterion('Strategic Fit', 5, 'Alignment with long-term strategy'),
      generateCriterion('Time to Value', 4, 'How quickly will we see benefits?'),
      generateCriterion('Risk', 4, 'Financial and execution risks'),
      generateCriterion('Opportunity Cost', 4, 'What are we giving up by choosing this?'),
      generateCriterion('Stakeholder Buy-in', 3, 'Support from key stakeholders'),
      generateCriterion('Long-term Impact', 5, 'Sustainable competitive advantage')
    ]
  },
  {
    id: 'customer-problem-assessment',
    name: 'Customer Problem/Opportunity Assessment',
    description: 'Evaluate customer problems or market opportunities to pursue.',
    type: 'professional',
    criteria: [
      generateCriterion('Problem Frequency', 5, 'How often do customers face this issue?'),
      generateCriterion('User Pain Severity', 5, 'Intensity of customer frustration'),
      generateCriterion('Market Size', 4, 'Total addressable market opportunity'),
      generateCriterion('Willingness to Pay', 5, 'Customer willingness to pay for solution'),
      generateCriterion('Current Alternatives', 3, 'Existing solutions and workarounds'),
      generateCriterion('Strategic Importance', 4, 'Importance to overall product strategy'),
      generateCriterion('Ease of Solution', 3, 'Technical feasibility of solving the problem')
    ]
  },
  {
    id: 'risk-assessment',
    name: 'Risk Assessment / Mitigation Planning',
    description: 'Assess and prioritize risks for mitigation planning.',
    type: 'other',
    criteria: [
      generateCriterion('Likelihood', 4, 'Probability of the risk occurring'),
      generateCriterion('Impact / Severity', 5, 'Potential damage if risk materializes'),
      generateCriterion('Detectability', 3, 'How early can we detect this risk?'),
      generateCriterion('Mitigation Difficulty', 4, 'Effort required to prevent or reduce risk'),
      generateCriterion('Recovery Time', 4, 'Time needed to recover if risk occurs'),
      generateCriterion('Business Continuity', 5, 'Impact on ongoing operations'),
      generateCriterion('Stakeholder Concern', 3, 'Level of stakeholder worry about this risk')
    ]
  },
  {
    id: 'retrospective-analysis',
    name: 'Retrospective or Post-Mortem Analysis',
    description: 'Evaluate completed projects or initiatives for learning.',
    type: 'other',
    criteria: [
      generateCriterion('Goal Achievement', 5, 'How well did we meet our objectives?'),
      generateCriterion('Successes', 4, 'What worked well and should be repeated?'),
      generateCriterion('Failures / Obstacles', 4, 'What didn\'t work or blocked progress?'),
      generateCriterion('Root Cause', 4, 'Understanding underlying causes of issues'),
      generateCriterion('Team Dynamics', 3, 'How well did the team collaborate?'),
      generateCriterion('Process Issues', 3, 'Problems with workflows or procedures'),
      generateCriterion('Lessons Learned', 5, 'Key insights for future projects')
    ]
  }
];

// Helper function to get templates by decision type
export const getTemplatesByType = (decisionType: string): CriteriaTemplate[] => {
  return PRODUCT_TEAM_TEMPLATES.filter(template => 
    template.type === decisionType || template.type === 'other'
  );
};

// Helper function to get all templates
export const getAllTemplates = (): CriteriaTemplate[] => {
  return PRODUCT_TEAM_TEMPLATES;
};

// Helper function to get template by ID
export const getTemplateById = (id: string): CriteriaTemplate | undefined => {
  return PRODUCT_TEAM_TEMPLATES.find(template => template.id === id);
};