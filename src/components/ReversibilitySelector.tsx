import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Shuffle, Ban, HelpCircle } from 'lucide-react';
import ChatBox from './ChatBox';
import { useDecision } from '../contexts/DecisionContext';

interface ReversibilityType {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  examples: string;
}

const reversibilityTypes: ReversibilityType[] = [
  {
    id: 'reversible',
    label: 'Reversible',
    icon: RotateCcw,
    description: 'You can easily undo or change your decision',
    examples: 'Trying a new hobby, changing phone plans'
  },
  {
    id: 'partially',
    label: 'Partially Reversible',
    icon: Shuffle,
    description: 'Some aspects can be changed, others cannot',
    examples: 'Career changes, moving to a new city'
  },
  {
    id: 'irreversible',
    label: 'Irreversible',
    icon: Ban,
    description: 'The decision cannot be undone once made',
    examples: 'Permanent medical procedures, certain legal decisions'
  },
  {
    id: 'unsure',
    label: 'Not Sure',
    icon: HelpCircle,
    description: 'You\'re uncertain about the reversibility',
    examples: 'Complex decisions with unknown factors'
  }
];

export default function ReversibilitySelector() {
  const navigate = useNavigate();
  const {
    decisionId,
    decisionType,
    decision,
    importance,
    setReversibility
  } = useDecision();
  const [loading, setLoading] = useState(false);

  // Flow guards
  if (!decisionId) return <Navigate to="/decision/intake" replace />;
  if (!decisionType) return <Navigate to="/decision/intake" replace />;
  if (!decision) return <Navigate to="/decision/intake" replace />;
  if (!importance) return <Navigate to="/decision/intake" replace />;
  if (!importance) return <Navigate to="/decision/intake" replace />;

  const handleSelect = (reversibility: string) => {
    setLoading(true);
    setReversibility(reversibility);
    navigate('/decision/goals');
    setLoading(false);
  };

  const handleBack = () => {
    navigate('/decision/importance');
  };

  return (
    <div className="space-y-8">
      <button
        onClick={handleBack}
         disabled={loading}
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Importance Selection
      </button>

      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Is this decision reversible?</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Understanding the permanence of your decision helps in evaluating risks and considering alternatives more carefully.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reversibilityTypes.map(({ id, label, icon: Icon, description, examples }) => (
          <button
            key={id}
            onClick={() => handleSelect(id)}
            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 text-left group"
            disabled={loading}
          >
            <div className="flex items-start space-x-4">
              <div className="bg-indigo-50 p-3 rounded-lg group-hover:bg-indigo-100 transition-colors">
                <Icon className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{label}</h3>
                <p className="text-sm text-gray-500 mb-2">{description}</p>
                <p className="text-xs text-gray-400 italic">e.g., {examples}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-8 w-full max-w-4xl mx-auto px-4">
        <ChatBox />
      </div>
    </div>
  );
}
