import React from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Brain, Check } from 'lucide-react';
import { useDecision } from '../contexts/DecisionContext';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ElementType;
  actionText?: string;
  actionPath?: string;
  tips?: string[];
}

export default function EmptyState({
  title,
  description,
  icon: Icon = Brain,
  actionText = "Create Decision",
  actionPath = "/decision/intake",
  tips = [
    "Create a new decision by clicking the button above",
    "Fill in the details about your decision",
    "Use our AI-powered analysis to help you make better choices"
  ]
}: EmptyStateProps) {
  const { resetDecisionContext } = useDecision();
  
  return (
    <div className="text-center py-12 bg-white rounded-lg shadow-sm">
      <div className="max-w-md mx-auto">
        <Icon className="h-12 w-12 text-indigo-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{description}</p>
        
        <Link
          to={actionPath}
          onClick={() => {
            if (actionPath.includes('decision')) {
              console.log(`[EmptyState] Starting new decision from empty state, resetting context`);
              resetDecisionContext();
            }
          }}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          {actionText}
        </Link>
        
        {tips && tips.length > 0 && (
          <div className="mt-8 border-t border-gray-200 pt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Getting Started Tips</h4>
            <ul className="text-sm text-gray-600 space-y-2">
              {tips.map((tip, index) => (
                <li key={index} className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}