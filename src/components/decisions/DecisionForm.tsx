import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createDecision } from '../../lib/supabase';
import { 
  Briefcase, Wallet, Heart, Compass, Users, HelpCircle,
  RotateCcw, Shuffle, Ban, AlertTriangle, 
  Zap, Shield, Clock, Scale,
  Plus, Minus, Loader, ArrowRight
} from 'lucide-react';
import Tooltip from '../Tooltip';
import { onSubmitDescribeDecision } from '../../plotLite/submit';

interface FormData {
  type: string;
  title: string;
  reversibility: string;
  importance: string;
  goals: string[];
}

const DECISION_TYPES = [
  { id: 'professional', label: 'Professional', icon: Briefcase, description: 'Work and business decisions' },
  { id: 'financial', label: 'Financial', icon: Wallet, description: 'Money and investment choices' },
  { id: 'health', label: 'Health', icon: Heart, description: 'Health and lifestyle decisions' },
  { id: 'career', label: 'Career', icon: Compass, description: 'Career development choices' },
  { id: 'relationships', label: 'Relationships', icon: Users, description: 'Personal relationship decisions' },
  { id: 'other', label: 'Other', icon: HelpCircle, description: 'Any other important decision' }
];

const REVERSIBILITY_TYPES = [
  { id: 'reversible', label: 'Easily Reversed', icon: RotateCcw, color: 'bg-green-50 text-green-600 hover:bg-green-100', description: 'Can be undone with minimal impact' },
  { id: 'partially', label: 'Partially Reversible', icon: Shuffle, color: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100', description: 'Some aspects can be changed' },
  { id: 'unsure', label: 'Uncertain', icon: HelpCircle, color: 'bg-orange-50 text-orange-600 hover:bg-orange-100', description: 'Unclear reversibility' },
  { id: 'irreversible', label: 'Permanent', icon: Ban, color: 'bg-red-50 text-red-600 hover:bg-red-100', description: 'Cannot be undone' }
];

const IMPORTANCE_LEVELS = [
  { id: 'low_priority_quick_assessment', label: 'Low', icon: Zap, color: 'bg-blue-50 text-blue-600 hover:bg-blue-100', description: 'Quick assessment needed' },
  { id: 'moderate_priority_thorough_quick', label: 'Moderate', icon: Shield, color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100', description: 'Thorough but quick evaluation' },
  { id: 'high_priority_urgent', label: 'High', icon: Clock, color: 'bg-purple-50 text-purple-600 hover:bg-purple-100', description: 'Important and urgent' },
  { id: 'critical_in_depth_analysis', label: 'Critical', icon: Scale, color: 'bg-red-50 text-red-600 hover:bg-red-100', description: 'Requires in-depth analysis' }
];

export default function DecisionForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  
  const [formData, setFormData] = useState<FormData>({
    type: '',
    title: '',
    reversibility: '',
    importance: '',
    goals: ['']
  });

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.type) newErrors.type = 'Please select a decision type';
    if (!formData.title.trim()) newErrors.title = 'Please enter a decision title';
    if (!formData.reversibility) newErrors.reversibility = 'Please select reversibility';
    if (!formData.importance) newErrors.importance = 'Please select importance level';
    if (!formData.goals[0]?.trim()) newErrors.goals = 'Please enter at least one goal';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (!user) {
      setErrors({ title: 'You must be signed in to create a decision' });
      return;
    }

    setLoading(true);

    // Flag-gated PLoT‑lite hook: fire-and-forget, no UI change. Safe when flag OFF.
    void onSubmitDescribeDecision(formData.title);

    try {
      const { data, error } = await createDecision({
        user_id: user.id,
        title: formData.title,
        type: formData.type,
        reversibility: formData.reversibility,
        importance: formData.importance,
        status: 'in_progress'
      });

      if (error) throw error;

      navigate('/decision/analysis', {
        state: {
          decisionId: data?.id,
          decision: formData.title,
          decisionType: formData.type,
          reversibility: formData.reversibility,
          importance: formData.importance,
          goals: formData.goals.filter(goal => goal.trim())
        }
      });
    } catch (err) {
      setErrors({
        title: err instanceof Error ? err.message : 'Failed to create decision'
      });
      setLoading(false);
    }
  };

  const handleAddGoal = () => {
    if (formData.goals.length < 5) {
      setFormData(prev => ({
        ...prev,
        goals: [...prev.goals, '']
      }));
    }
  };

  const handleRemoveGoal = (index: number) => {
    if (formData.goals.length > 1) {
      setFormData(prev => ({
        ...prev,
        goals: prev.goals.filter((_, i) => i !== index)
      }));
    }
  };

  const handleGoalChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.map((goal, i) => i === index ? value : goal)
    }));
  };

  return (
    <div className="max-w-[800px] mx-auto px-4 py-8 bg-white rounded-2xl shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-12">
        {/* Decision Type */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-2xl font-semibold text-gray-900">
              What type of decision are you facing?
            </label>
            <p className="text-gray-600">Select the category that best matches your decision.</p>
          </div>
          {errors.type && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              {errors.type}
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl mx-auto">
            {DECISION_TYPES.map(({ id, label, icon: Icon, description }) => (
              <Tooltip key={id} content={description}>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: id }))}
                  className={`
                    h-32 w-full
                    flex flex-col items-center justify-center gap-3 p-4
                    rounded-xl border-2 transition-all duration-300
                    ${formData.type === id 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                    transform hover:scale-[1.02] hover:shadow-md
                    group
                  `}
                >
                  <Icon className={`h-6 w-6 transition-colors duration-300 ${
                    formData.type === id ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`} />
                  <span className="text-sm font-medium text-center">{label}</span>
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Decision Title */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="title" className="text-2xl font-semibold text-gray-900">
              What decision are you trying to make?
            </label>
            <p className="text-gray-600">Be specific about what you want to decide.</p>
          </div>
          <div className="relative">
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className={`
                w-full h-14 px-4
                text-lg rounded-xl
                border-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200
                transition-all duration-200
                ${errors.title ? 'border-red-300' : 'border-gray-200'}
              `}
              placeholder="Enter a clear, specific title for your decision"
            />
          </div>
          {errors.title && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              {errors.title}
            </p>
          )}
        </div>

        {/* Reversibility */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-2xl font-semibold text-gray-900">
              How reversible is this decision?
            </label>
            <p className="text-gray-600">Consider how easily you can change course after making this decision.</p>
          </div>
          {errors.reversibility && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              {errors.reversibility}
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {REVERSIBILITY_TYPES.map(({ id, label, icon: Icon, color, description }) => (
              <Tooltip key={id} content={description}>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, reversibility: id }))}
                  className={`
                    h-32 w-full
                    flex flex-col items-center justify-center gap-3 p-4
                    rounded-xl border-2 transition-all duration-300
                    ${formData.reversibility === id 
                      ? `${color} border-current` 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium text-center">{label}</span>
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Importance */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-2xl font-semibold text-gray-900">
              How important is this decision?
            </label>
            <p className="text-gray-600">Select the level of analysis needed for this decision.</p>
          </div>
          {errors.importance && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              {errors.importance}
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {IMPORTANCE_LEVELS.map(({ id, label, icon: Icon, color, description }) => (
              <Tooltip key={id} content={description}>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, importance: id }))}
                  className={`
                    h-32 w-full
                    flex flex-col items-center justify-center gap-3 p-4
                    rounded-xl border-2 transition-all duration-300
                    ${formData.importance === id 
                      ? `${color} border-current` 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium text-center">{label}</span>
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Goals */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <label className="text-2xl font-semibold text-gray-900">
                What are your goals for this decision?
              </label>
              <p className="text-gray-600">Define what you want to achieve with this decision.</p>
            </div>
            {formData.goals.length < 5 && (
              <Tooltip content="Add another goal">
                <button
                  type="button"
                  onClick={handleAddGoal}
                  className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </Tooltip>
            )}
          </div>
          {errors.goals && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              {errors.goals}
            </p>
          )}
          <div className="space-y-4">
            {formData.goals.map((goal, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-indigo-50 text-indigo-600 font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={goal}
                    onChange={(e) => handleGoalChange(index, e.target.value)}
                    placeholder="What do you want to achieve with this decision?"
                    className="flex-1 px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200"
                  />
                  {formData.goals.length > 1 && (
                    <Tooltip content="Remove this goal">
                      <button
                        type="button"
                        onClick={() => handleRemoveGoal(index)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Minus className="h-5 w-5" />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-center pt-8">
          <button
            type="submit"
            disabled={loading}
            className="
              w-[200px] h-12
              flex items-center justify-center gap-2
              text-white bg-indigo-600 rounded-xl
              hover:bg-indigo-700 active:bg-indigo-800
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transform hover:-translate-y-0.5
              transition-all duration-200
            "
          >
            {loading ? (
              <>
                <Loader className="animate-spin h-5 w-5" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <span>Analyze Decision</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}