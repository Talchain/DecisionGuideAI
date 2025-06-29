import React from 'react';
import { ListChecks, Map, Rocket, ShoppingCart, FlaskConical, Repeat, AlertTriangle, Users, HandHelping, Briefcase, CreditCard, HeartPulse, Sun, GraduationCap, Users2, CircleEllipsis as Ellipsis, HelpCircle } from 'lucide-react';

// Define the decision type structure
export interface DecisionCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  examples: string[];
  section: string;
  backendType: 'professional' | 'financial' | 'health' | 'career' | 'relationships' | 'other';
}

// Map of icon names to Lucide React components
export const iconMap: Record<string, React.ElementType> = {
  ListChecks,
  Map,
  Rocket,
  ShoppingCart,
  FlaskConical,
  Repeat,
  AlertTriangle,
  Users,
  HandHelping,
  Briefcase,
  CreditCard,
  HeartPulse,
  Sun,
  GraduationCap,
  Users2,
  Ellipsis,
  HelpCircle
};

// Decision categories data
export const decisionCategories: DecisionCategory[] = [
  {
    id: "feature-prioritization",
    name: "Feature Prioritization",
    icon: "ListChecks",
    description: "Rank features or improvements for your next release.",
    examples: [
      "Which feature should we build next?",
      "What goes in our upcoming sprint?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "roadmap-strategy",
    name: "Roadmap/Strategy",
    icon: "Map",
    description: "Plan or prioritize projects and initiatives.",
    examples: [
      "How should we structure our roadmap?",
      "Which initiatives are most strategic?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "go-no-go-launch",
    name: "Go/No-Go Launch",
    icon: "Rocket",
    description: "Decide if a product or feature is ready to launch.",
    examples: [
      "Is our product ready for users?",
      "Should we release this update now?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "vendor-tool-selection",
    name: "Vendor/Tool Selection",
    icon: "ShoppingCart",
    description: "Choose between tools, vendors, or services.",
    examples: [
      "Which analytics tool should we buy?",
      "Who should be our new infrastructure provider?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "experiment-pilot-evaluation",
    name: "Experiment/Pilot Evaluation",
    icon: "FlaskConical",
    description: "Assess the value of experiments and pilots.",
    examples: [
      "Which test should we run next?",
      "Was our experiment a success?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "retrospective-learning",
    name: "Retrospective/Learning",
    icon: "Repeat",
    description: "Reflect on past work to improve future outcomes.",
    examples: [
      "What did we learn from the last release?",
      "How can we improve our process?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "risk-dependency-assessment",
    name: "Risk/Dependency Assessment",
    icon: "AlertTriangle",
    description: "Identify and prioritize risks or blockers.",
    examples: [
      "What could block this project?",
      "How risky is this dependency?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "team-hiring",
    name: "Team/Hiring",
    icon: "Users",
    description: "Make decisions about hiring or team structure.",
    examples: [
      "Who should join our team?",
      "Is it time to hire a new PM?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "stakeholder-alignment",
    name: "Stakeholder/Alignment",
    icon: "HandHelping",
    description: "Align on strategy or priorities with stakeholders.",
    examples: [
      "How do we get consensus on direction?",
      "Who should be involved in this decision?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "career-job-move",
    name: "Career/Job Move",
    icon: "Briefcase",
    description: "Evaluate job offers or career moves.",
    examples: [
      "Should I accept this job?",
      "Is it time to switch roles?"
    ],
    section: "Personal & Life",
    backendType: "career"
  },
  {
    id: "financial-purchasing",
    name: "Financial/Purchasing",
    icon: "CreditCard",
    description: "Make major spending, saving, or investment choices.",
    examples: [
      "Should I invest in this opportunity?",
      "Which laptop should I buy?"
    ],
    section: "Personal & Life",
    backendType: "financial"
  },
  {
    id: "health-wellness",
    name: "Health/Wellness",
    icon: "HeartPulse",
    description: "Choose a health, fitness, or lifestyle path.",
    examples: [
      "Which exercise plan is best for me?",
      "Should I change my diet?"
    ],
    section: "Personal & Life",
    backendType: "health"
  },
  {
    id: "major-life-decision",
    name: "Major Life Decision",
    icon: "Sun",
    description: "Decide on major changes like moving, relationships, or big commitments.",
    examples: [
      "Should we move to a new city?",
      "Is it the right time to start a family?"
    ],
    section: "Personal & Life",
    backendType: "other"
  },
  {
    id: "education-personal-development",
    name: "Education/Personal Development",
    icon: "GraduationCap",
    description: "Select courses, degrees, or growth opportunities.",
    examples: [
      "Which course should I take?",
      "Is this degree the right next step?"
    ],
    section: "Personal & Life",
    backendType: "other"
  },
  {
    id: "relationships-group",
    name: "Relationships/Group",
    icon: "Users2",
    description: "Decide on social, family, or group matters.",
    examples: [
      "How should we resolve this family disagreement?",
      "What's the best way to support my friend?"
    ],
    section: "Personal & Life",
    backendType: "relationships"
  },
  {
    id: "something-else",
    name: "Something else",
    icon: "Ellipsis",
    description: "Any other decision not listed above.",
    examples: [
      "I want to use my own decision process.",
      "My decision doesn't fit any of these."
    ],
    section: "Other",
    backendType: "other"
  }
];

// Get recommended decision types
export const getRecommendedTypes = () => {
  // Get the first 5 from "Product & Work" section 
  const productWorkTypes = decisionCategories
    .filter(category => category.section === "Product & Work")
    .slice(0, 5);
  
  // Always include "Something else"
  const somethingElse = decisionCategories.find(category => category.name === "Something else");
  
  return [...productWorkTypes, somethingElse].filter(Boolean);
};

// Helper function to get the backend type from a category name
export const getBackendTypeFromName = (categoryName: string): string => {
  const category = decisionCategories.find(c => c.name === categoryName);
  if (!category) {
    console.warn(`No category found with name: ${categoryName}. Defaulting to 'other'.`);
    return 'other';
  }
  
  return category.backendType;
};