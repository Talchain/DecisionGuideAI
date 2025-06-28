// src/components/DecisionTypeSelector.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Users,
  Wallet,
  Heart as Health,
  Compass,
  HelpCircle
} from 'lucide-react';
import { useDecision } from '../contexts/DecisionContext';
import ChatBox from './ChatBox';

interface DecisionType {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  examples: string;
}

const decisionTypes: DecisionType[] = [
  {
    id: 'professional',
    label: 'Professional',
    icon: Briefcase,
    description: 'Strategic, tactical, and operational decisions',
    examples: 'Business strategy, team decisions, project planning'
  },
  {
    id: 'financial',
    label: 'Financial and Purchasing',
    icon: Wallet,
    description: 'Money management and buying decisions',
    examples: 'Savings plans, investments, product comparisons'
  },
  {
    id: 'health',
    label: 'Health and Lifestyle',
    icon: Health,
    description: 'Personal well-being and life choices',
    examples: 'Fitness programs, relocating, personal growth'
  },
  {
    id: 'career',
    label: 'Career and Education',
    icon: Compass,
    description: 'Professional development and learning paths',
    examples: 'Job transitions, learning paths, skill development'
  },
  {
    id: 'relationships',
    label: 'Relationships and Social',
    icon: Users,
    description: 'Personal and social connections',
    examples: 'Dating choices, family matters, friendship decisions'
  },
  {
    id: 'other',
    label: 'Something else',
    icon: HelpCircle,
    description: 'Other important decisions',
    examples: 'Any other decision you need help with'
  }
];

export default function DecisionTypeSelector() {
  const navigate = useNavigate();
  const { resetDecisionContext, setDecisionType, setDecision } = useDecision();

  const handleSelect = (type: string) => {
    // Clear all previous decision state when starting a new flow
    resetDecisionContext();

    // Initialize this decision
    setDecisionType(type);
    setDecision(''); // clear any previous decision text
    localStorage.setItem('decisionType', type);

    // Move on to the details step
    navigate('/decision/details');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-start py-6 px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-4xl mx-auto space-y-6 mb-6">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
            What type of decision are you facing?
          </span>
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Select the category that best matches your decision for more relevant guidance and insights.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl w-full items-start">
        {decisionTypes.map(({ id, label, icon: Icon, description, examples }) => (
          <button
            key={id}
            onClick={() => handleSelect(id)}
            className="bg-white p-4 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 text-left group relative overflow-hidden h-full flex flex-col justify-between"
          >
            <div className="relative z-10">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors duration-300">
                  <Icon className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                    {label}
                  </h3>
                  <p className="text-sm text-gray-500 mb-2">{description}</p>
                  <p className="text-xs text-gray-400">{examples}</p>
                </div>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-transparent to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>
        ))}
      </div>
      
      <div className="mt-8 w-full max-w-4xl mx-auto px-4">
        <ChatBox />
      </div>
    </div>
  );
}