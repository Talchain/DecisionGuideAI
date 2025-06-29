// Move existing CriteriaStage.tsx content here and rename the component
import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, AlertTriangle, ArrowRight, GripVertical, Save, FolderOpen, Star } from 'lucide-react';
import { useDecision } from '../contexts/DecisionContext';
import CriteriaTemplates from './criteria/CriteriaTemplates';

interface Criterion {
  id: string;
  name: string;
  weight: number;
}

export default function IndividualCriteriaStage() {
  const navigate = useNavigate();
  const {
    decisionId,
    decision,
    decisionType,
    importance,
    reversibility,
    options,
    criteria,
    setCriteria
  } = useDecision();

  // Flow guards
  if (!decisionId) return <Navigate to="/decision/intake" replace />;
  if (!decision) return <Navigate to="/decision/intake" replace />;
  if (!importance) return <Navigate to="/decision/intake" replace />;
  if (!reversibility) return <Navigate to="/decision/intake" replace />;
  if (!options?.length) return <Navigate to="/decision/options" replace />;

  const [newCriterion, setNewCriterion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [localCriteria, setLocalCriteria] = useState<Criterion[]>(
    criteria?.length ? criteria : [{ id: crypto.randomUUID(), name: '', weight: 3 }]
  );
  const [showTemplates, setShowTemplates] = useState<boolean>(false);
  const [hasAppliedTemplate, setHasAppliedTemplate] = useState(false);

  // Validation state
  const isValid = localCriteria.length >= 2 && 
                 localCriteria.every(c => c.name.trim() && c.weight >= 1 && c.weight <= 5);

  const handleAdd = () => {
    if (localCriteria.length >= 5) {
      setError('Maximum 5 criteria allowed');
      return;
    }
    setLocalCriteria([
      ...localCriteria,
      { id: crypto.randomUUID(), name: '', weight: 3 }
    ]);
    setError(null);
  };

  const handleRemove = (id: string) => {
    if (localCriteria.length <= 2) {
      setError('Minimum 2 criteria required');
      return;
    }
    setLocalCriteria(localCriteria.filter(c => c.id !== id));
    setError(null);
  };

  const handleNameChange = (id: string, name: string) => {
    setLocalCriteria(localCriteria.map(c => 
      c.id === id ? { ...c, name: name.trim() } : c
    ));
    setError(null);
  };

  const handleWeightChange = (id: string, weight: number) => {
    setLocalCriteria(localCriteria.map(c => 
      c.id === id ? { ...c, weight } : c
    ));
    setError(null);
  };

  const handleSubmit = () => {
    if (!isValid) {
      setError('Please complete all criteria and weights');
      return;
    }
    setCriteria(localCriteria);
    navigate('/decision/evaluate');
  };

  const handleTemplateSelect = (templateCriteria: Criterion[]) => {
    setLocalCriteria(templateCriteria);
    setShowTemplates(false);
    setHasAppliedTemplate(true);
    setError(null);
  };

  const total = localCriteria.reduce((sum, c) => sum + c.weight, 0);
  const overweight = total > 15;

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/decision/options')}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Options
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            <Star className="h-4 w-4 mr-1.5" />
            Load Template
          </button>
          <button
            onClick={() => navigate('/templates', { state: { createFromCriteria: localCriteria } })}
            disabled={!isValid}
            className="flex items-center px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-1.5" />
            Save as Template
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        {/* Templates Modal */}
        {showTemplates && (
          <div className="mb-8 border-b border-gray-200 pb-8">
            <CriteriaTemplates
              decisionType={decisionType}
              onSelect={handleTemplateSelect}
              onClose={() => setShowTemplates(false)}
            />
          </div>
        )}

        {!showTemplates && (
          <>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Define Your Decision Criteria
              </h2>
              <p className="text-gray-600">
                Add 2-5 criteria that matter most for this decision and rate their importance
              </p>
              {hasAppliedTemplate && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Template applied - customize as needed
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 p-4 rounded-lg flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {/* Criteria List */}
            <div className="space-y-4">
              {localCriteria.map((criterion, index) => (
                <div
                  key={criterion.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg group"
                >
                  <GripVertical className="h-5 w-5 text-gray-400 cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex-1">
                    <input
                      type="text"
                      value={criterion.name}
                      onChange={(e) => handleNameChange(criterion.id, e.target.value)}
                      placeholder={`Criterion ${index + 1} (e.g., cost, impact, ease)`}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((weight) => (
                      <button
                        key={weight}
                        onClick={() => handleWeightChange(criterion.id, weight)}
                        className={`w-8 h-8 rounded-full font-medium transition-colors ${
                          criterion.weight === weight
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {weight}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleRemove(criterion.id)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-full"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Button */}
            <div className="flex justify-center">
              <button
                onClick={handleAdd}
                disabled={localCriteria.length >= 5}
                className="flex items-center px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-50"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Criterion
              </button>
            </div>

            {/* Submit Button */}
            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setShowTemplates(true)}
                className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
              >
                Browse Templates
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isValid}
                className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue to Analysis
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}