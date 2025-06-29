import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  HelpCircle, 
  Briefcase, 
  Wallet, 
  Heart, 
  Compass, 
  Users, 
  RotateCcw, 
  Shuffle, 
  Ban, 
  Zap, 
  Shield, 
  Clock, 
  Scale,
  CheckCircle,
  ChevronRight
} from 'lucide-react';
import { useDecision } from '../contexts/DecisionContext';
import { getUserId, createDecision } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Tooltip from './Tooltip';
import ChatBox from './ChatBox';

// Decision Type Options
const DECISION_TYPES = [
  { id: 'professional', label: 'Professional', icon: Briefcase, description: 'Work and business decisions' },
  { id: 'financial', label: 'Financial', icon: Wallet, description: 'Money and investment choices' },
  { id: 'health', label: 'Health', icon: Heart, description: 'Health and lifestyle decisions' },
  { id: 'career', label: 'Career', icon: Compass, description: 'Career development choices' },
  { id: 'relationships', label: 'Relationships', icon: Users, description: 'Personal relationship decisions' },
  { id: 'other', label: 'Other', icon: HelpCircle, description: 'Any other important decision' }
];

// Reversibility Options
const REVERSIBILITY_TYPES = [
  { id: 'reversible', label: 'Easily Reversed', icon: RotateCcw, color: 'bg-green-50 text-green-600 hover:bg-green-100', description: 'Can be undone with minimal impact' },
  { id: 'partially', label: 'Partially Reversible', icon: Shuffle, color: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100', description: 'Some aspects can be changed' },
  { id: 'unsure', label: 'Uncertain', icon: HelpCircle, color: 'bg-orange-50 text-orange-600 hover:bg-orange-100', description: 'Unclear reversibility' },
  { id: 'irreversible', label: 'Permanent', icon: Ban, color: 'bg-red-50 text-red-600 hover:bg-red-100', description: 'Cannot be undone' }
];

// Importance Levels
const IMPORTANCE_LEVELS = [
  { id: 'low_priority_quick_assessment', label: 'Low', icon: Zap, color: 'bg-blue-50 text-blue-600 hover:bg-blue-100', description: 'Quick assessment needed' },
  { id: 'moderate_priority_thorough_quick', label: 'Moderate', icon: Shield, color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100', description: 'Thorough but quick evaluation' },
  { id: 'high_priority_urgent', label: 'High', icon: Clock, color: 'bg-purple-50 text-purple-600 hover:bg-purple-100', description: 'Important and urgent' },
  { id: 'critical_in_depth_analysis', label: 'Critical', icon: Scale, color: 'bg-red-50 text-red-600 hover:bg-red-100', description: 'Requires in-depth analysis' }
];

// Decision placeholders based on type
const PLACEHOLDERS: Record<string, string> = {
  professional: 'e.g., Should we implement a new project management system?',
  financial: 'e.g., Should I invest in index funds or real estate?',
  health: 'e.g., Which fitness program should I follow?',
  career: 'e.g., Should I pursue an MBA or specialization?',
  relationships: 'e.g., Should I move in with my partner?',
  other: 'e.g., What decision are you trying to make?'
};

export default function DecisionIntakeScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    resetDecisionContext,
    setDecisionId,
    setDecisionType,
    setDecision,
    setImportance,
    setReversibility
  } = useDecision();

  // Form state
  const [formData, setFormData] = useState({
    decision: '',
    decisionType: '',
    importance: '',
    reversibility: ''
  });

  // UI state
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTypeOptions, setShowTypeOptions] = useState(false);
  const [showImportanceOptions, setShowImportanceOptions] = useState(false);
  const [showReversibilityOptions, setShowReversibilityOptions] = useState(false);

  // Reset context on mount
  useEffect(() => {
    resetDecisionContext();
  }, [resetDecisionContext]);

  // Advance to next step when current step is completed
  useEffect(() => {
    if (formData.decision && currentStep === 1) {
      setShowTypeOptions(true);
    }
    if (formData.decisionType && currentStep === 2) {
      setShowImportanceOptions(true);
    }
    if (formData.importance && currentStep === 3) {
      setShowReversibilityOptions(true);
    }
  }, [formData, currentStep]);

  // Handle decision input change
  const handleDecisionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, decision: e.target.value }));
    setError(null);
  };

  // Handle decision type selection
  const handleTypeSelect = (type: string) => {
    setFormData(prev => ({ ...prev, decisionType: type }));
    setCurrentStep(2);
    setError(null);
  };

  // Handle importance selection
  const handleImportanceSelect = (importance: string) => {
    setFormData(prev => ({ ...prev, importance }));
    setCurrentStep(3);
    setError(null);
  };

  // Handle reversibility selection
  const handleReversibilitySelect = (reversibility: string) => {
    setFormData(prev => ({ ...prev, reversibility }));
    setCurrentStep(4);
    setError(null);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.decision || !formData.decisionType || !formData.importance || !formData.reversibility) {
      setError('Please complete all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userId = await getUserId();
      if (!userId) {
        setError('Unable to get user session. Please log in again.');
        return;
      }

      const { data, error: supaErr } = await createDecision({
        user_id: userId,
        type: formData.decisionType,
        title: formData.decision.trim(),
        reversibility: formData.reversibility,
        importance: formData.importance,
        status: 'draft'
      });

      if (supaErr) {
        setError(supaErr.message);
        return;
      }

      if (!data?.id) {
        setError('Unexpected error: no ID returned.');
        return;
      }

      // Update context
      setDecision(formData.decision.trim());
      setDecisionType(formData.decisionType);
      setImportance(formData.importance);
      setReversibility(formData.reversibility);
      setDecisionId(data.id);

      // Navigate to goals screen
      navigate('/decision/goals');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate progress percentage
  const calculateProgress = () => {
    const steps = [
      !!formData.decision,
      !!formData.decisionType,
      !!formData.importance,
      !!formData.reversibility
    ];
    
    const completedSteps = steps.filter(Boolean).length;
    return (completedSteps / steps.length) * 100;
  };

  // Get placeholder based on selected type
  const getPlaceholder = () => {
    return formData.decisionType ? PLACEHOLDERS[formData.decisionType] : 'e.g., What decision are you trying to make?';
  };

  // Check if all fields are completed
  const isComplete = formData.decision && formData.decisionType && formData.importance && formData.reversibility;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
            style={{ width: `${calculateProgress()}%` }}
          ></div>
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>Decision</span>
          <span>Type</span>
          <span>Importance</span>
          <span>Reversibility</span>
        </div>
      </div>

      {/* Summary Panel (Desktop) */}
      {(formData.decisionType || formData.importance || formData.reversibility) && (
        <div className="hidden md:block mb-8 bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Your Decision Summary</h3>
          <div className="space-y-2">
            {formData.decision && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">Decision: <span className="font-medium">{formData.decision}</span></span>
              </div>
            )}
            {formData.decisionType && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">Type: <span className="font-medium">{
                  DECISION_TYPES.find(t => t.id === formData.decisionType)?.label || formData.decisionType
                }</span></span>
              </div>
            )}
            {formData.importance && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">Importance: <span className="font-medium">{
                  IMPORTANCE_LEVELS.find(i => i.id === formData.importance)?.label || formData.importance
                }</span></span>
              </div>
            )}
            {formData.reversibility && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">Reversibility: <span className="font-medium">{
                  REVERSIBILITY_TYPES.find(r => r.id === formData.reversibility)?.label || formData.reversibility
                }</span></span>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Decision Description */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <label htmlFor="decision" className="block text-lg font-medium text-gray-800 mb-2">
            What decision are you trying to make?
          </label>
          <input
            id="decision"
            type="text"
            value={formData.decision}
            onChange={handleDecisionChange}
            placeholder={getPlaceholder()}
            className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            autoFocus
          />
          {formData.decision && (
            <div className="mt-2 flex items-center text-sm text-green-600">
              <CheckCircle className="h-4 w-4 mr-1" />
              <span>Great! Now let's identify the type of decision.</span>
            </div>
          )}
        </div>

        {/* Decision Type */}
        {showTypeOptions && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 transition-all duration-300 animate-fade-in">
            <label className="block text-lg font-medium text-gray-800 mb-4">
              What type of decision is this?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {DECISION_TYPES.map(({ id, label, icon: Icon, description }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleTypeSelect(id)}
                  className={`
                    flex flex-col items-start p-4 rounded-lg border-2 transition-all duration-200
                    ${formData.decisionType === id 
                      ? 'border-indigo-500 bg-indigo-50' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                  `}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${formData.decisionType === id ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                      <Icon className={`h-5 w-5 ${formData.decisionType === id ? 'text-indigo-600' : 'text-gray-600'}`} />
                    </div>
                    <span className="font-medium">{label}</span>
                  </div>
                  <p className="text-sm text-gray-500">{description}</p>
                </button>
              ))}
            </div>
            {formData.decisionType && (
              <div className="mt-4 flex items-center text-sm text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                <span>Now, let's determine how important this decision is.</span>
              </div>
            )}
          </div>
        )}

        {/* Importance */}
        {showImportanceOptions && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 transition-all duration-300 animate-fade-in">
            <label className="block text-lg font-medium text-gray-800 mb-4">
              How important is this decision?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {IMPORTANCE_LEVELS.map(({ id, label, icon: Icon, color, description }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleImportanceSelect(id)}
                  className={`
                    flex items-center gap-4 p-4 rounded-lg border-2 transition-all duration-200
                    ${formData.importance === id 
                      ? `${color.replace('hover:', '')} border-current` 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                  `}
                >
                  <Icon className="h-6 w-6" />
                  <div className="text-left">
                    <div className="font-medium">{label}</div>
                    <div className="text-sm text-gray-500">{description}</div>
                  </div>
                </button>
              ))}
            </div>
            {formData.importance && (
              <div className="mt-4 flex items-center text-sm text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                <span>Finally, let's consider how reversible this decision is.</span>
              </div>
            )}
          </div>
        )}

        {/* Reversibility */}
        {showReversibilityOptions && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 transition-all duration-300 animate-fade-in">
            <label className="block text-lg font-medium text-gray-800 mb-4">
              How reversible is this decision?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {REVERSIBILITY_TYPES.map(({ id, label, icon: Icon, color, description }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleReversibilitySelect(id)}
                  className={`
                    flex items-center gap-4 p-4 rounded-lg border-2 transition-all duration-200
                    ${formData.reversibility === id 
                      ? `${color.replace('hover:', '')} border-current` 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                  `}
                >
                  <Icon className="h-6 w-6" />
                  <div className="text-left">
                    <div className="font-medium">{label}</div>
                    <div className="text-sm text-gray-500">{description}</div>
                  </div>
                </button>
              ))}
            </div>
            {formData.reversibility && (
              <div className="mt-4 flex items-center text-sm text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                <span>Great! You've completed all the required information.</span>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Continue Button */}
        {isComplete && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !isComplete}
              className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Processing...' : 'Continue to Goals'}
              <ChevronRight className="ml-2 h-5 w-5" />
            </button>
          </div>
        )}
      </form>

      {/* Summary Panel (Mobile) */}
      {(formData.decisionType || formData.importance || formData.reversibility) && (
        <div className="md:hidden mt-8 bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Your Decision Summary</h3>
          <div className="space-y-2">
            {formData.decision && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">Decision: <span className="font-medium">{formData.decision}</span></span>
              </div>
            )}
            {formData.decisionType && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">Type: <span className="font-medium">{
                  DECISION_TYPES.find(t => t.id === formData.decisionType)?.label || formData.decisionType
                }</span></span>
              </div>
            )}
            {formData.importance && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">Importance: <span className="font-medium">{
                  IMPORTANCE_LEVELS.find(i => i.id === formData.importance)?.label || formData.importance
                }</span></span>
              </div>
            )}
            {formData.reversibility && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">Reversibility: <span className="font-medium">{
                  REVERSIBILITY_TYPES.find(r => r.id === formData.reversibility)?.label || formData.reversibility
                }</span></span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8">
        <ChatBox />
      </div>
    </div>
  );
}