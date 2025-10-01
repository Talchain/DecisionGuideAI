import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  HelpCircle, 
  AlertCircle, 
  X, 
  ArrowLeft, 
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import { useDecision } from '../contexts/DecisionContext';
import { evaluationMethods, getRecommendedMethods, getMethodById } from '../utils/evaluationMethods';
import Tooltip from './Tooltip';
import Button from './shared/Button';
import { AppErrorHandler } from '../lib/errors';

interface HelpModalProps {
  onClose: () => void;
}

function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Choosing an Evaluation Method</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <p className="text-gray-700">
            Different evaluation methods work better for different types of decisions. Here's a quick guide to help you choose:
          </p>
          
          <div className="space-y-4">
            {evaluationMethods.map(method => (
              <div key={method.id} className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">{method.name}</h3>
                <p className="text-gray-600 mb-2">{method.longDescription}</p>
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Best for:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 ml-2">
                    {method.usageExamples.map((example, i) => (
                      <li key={i}>{example}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-end p-6 border-t">
          <Button
            onClick={onClose}
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EvaluationMethodSelector() {
  const navigate = useNavigate();
  const { 
    decisionId, 
    decisionType, 
    decision, 
    importance, 
    reversibility, 
    goals,
    options,
    criteria,
    setEvaluationMethod,
    saveEvaluationMethodToSupabase
  } = useDecision();
  
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Get recommended methods based on decision context
  const hasCriteria = Array.isArray(criteria) && criteria.length > 0;
  const recommendedMethods = getRecommendedMethods(decisionType, importance, reversibility, hasCriteria);
  
  // Flow guards
  useEffect(() => {
    if (!decisionId || !decision) {
      navigate('/decision/intake', { replace: true });
    }
  }, [decisionId, decision, navigate]);
  
  const handleMethodSelect = (methodId: string) => {
    const method = getMethodById(methodId);
    
    // Check if method requires criteria but none are defined
    if (method?.requiresCriteria && !hasCriteria) {
      setError('This method requires criteria to be defined. Please go back and add criteria first.');
      return;
    }
    
    setSelectedMethodId(methodId);
    setError(null);
  };
  
  const handleContinue = async () => {
    if (!selectedMethodId) return;
    
    setSaving(true);
    setError(null);
    
    try {
      // Update context with selected method
      setEvaluationMethod(selectedMethodId);
      
      // Save to Supabase
      await saveEvaluationMethodToSupabase(selectedMethodId);
      
      // Navigate to analysis
      navigate('/decision/analysis', {
        state: {
          decisionId,
          decision,
          decisionType,
          importance,
          reversibility,
          goals,
          options
        }
      });
    } catch (err) {
      const errorMessage = AppErrorHandler.getUserFriendlyMessage(err as any);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };
  
  const handleBack = () => {
    navigate('/decision/criteria');
  };
  
  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Criteria
        </button>
      </div>
      
      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Choose how you'd like to evaluate your options
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Olumi suggests the most effective methods for your decision, but you can pick whichever works best for you.
          </p>
          <button
            onClick={() => setShowHelpModal(true)}
            className="mt-2 inline-flex items-center text-indigo-600 hover:text-indigo-700"
          >
            <HelpCircle className="h-4 w-4 mr-1" />
            Not sure which to choose?
          </button>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 p-4 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <p className="text-red-700">{error}</p>
              <button
                onClick={handleBack}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Go back and add criteria
              </button>
            </div>
          </div>
        )}
        
        {/* Methods Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {evaluationMethods.map(method => {
            const isRecommended = recommendedMethods.some(m => m.id === method.id);
            const isSelected = selectedMethodId === method.id;
            const isDisabled = method.requiresCriteria && !hasCriteria;
            const IconComponent = method.icon;
            
            return (
              <div
                key={method.id}
                className={`
                  relative p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer
                  ${isSelected 
                    ? 'border-indigo-500 bg-indigo-50' 
                    : isDisabled
                      ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
                onClick={() => !isDisabled && handleMethodSelect(method.id)}
                data-testid={`evaluation-method-${method.id}`}
              >
                {/* Recommended Badge */}
                {isRecommended && !isDisabled && (
                  <div className="absolute top-2 right-2">
                    <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Recommended
                    </div>
                  </div>
                )}
                
                {/* Method Content */}
                <div className="flex flex-col h-full">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                      <IconComponent className={`h-5 w-5 ${isSelected ? 'text-indigo-600' : 'text-gray-600'}`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{method.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{method.description}</p>
                    </div>
                  </div>
                  
                  {/* Usage Examples */}
                  <div className="mt-auto">
                    <p className="text-xs text-gray-500 italic">
                      Good for: {method.usageExamples[0]}
                    </p>
                    
                    {/* Criteria Required Warning */}
                    {method.requiresCriteria && (
                      <div className="mt-2 text-xs flex items-center">
                        <span className={`${hasCriteria ? 'text-green-600' : 'text-amber-600'}`}>
                          {hasCriteria 
                            ? '✓ Criteria defined' 
                            : '⚠️ Requires criteria'}
                        </span>
                        
                        <Tooltip content={hasCriteria 
                          ? 'This method will use your defined criteria' 
                          : 'You need to define criteria before using this method'
                        }>
                          <HelpCircle className="h-3 w-3 ml-1 text-gray-400" />
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Continue Button */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleContinue}
            disabled={!selectedMethodId}
            loading={saving}
            icon={ArrowRight}
            size="lg"
          >
            Continue to Analysis
          </Button>
        </div>
      </div>
      
      {/* Help Modal */}
      {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}
    </div>
  );
}