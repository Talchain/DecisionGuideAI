// Move existing CriteriaStage.tsx content here and rename the component
import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, AlertTriangle, ArrowRight, GripVertical, Save, FolderOpen } from 'lucide-react';
import { useDecision } from '../contexts/DecisionContext';
import SaveCriteriaSetModal from './criteria/SaveCriteriaSetModal';
import LoadCriteriaSetModal from './criteria/LoadCriteriaSetModal';

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
  if (!decisionId) return <Navigate to="/decision" replace />;
  if (!decision) return <Navigate to="/decision/details" replace />;
  if (!importance) return <Navigate to="/decision/importance" replace />;
  if (!reversibility) return <Navigate to="/decision/reversibility" replace />;
  if (!options?.length) return <Navigate to="/decision/options" replace />;

  const [newCriterion, setNewCriterion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [localCriteria, setLocalCriteria] = useState<Criterion[]>(
    criteria?.length ? criteria : [{ id: crypto.randomUUID(), name: '', weight: 3 }]
  );
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);

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
    navigate('/decision/analysis');
  };

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
            onClick={() => setShowLoadModal(true)}
            className="flex items-center px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          >
            <FolderOpen className="h-4 w-4 mr-1.5" />
            Load Set
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            disabled={!isValid}
            className="flex items-center px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-1.5" />
            Save Set
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        {/* Templates Modal */}
        {showTemplates && (
          <div className="mb-8">
            <CriteriaTemplates
              decisionType={decisionType}
              onSelect={(criteria) => {
                setLocalCriteria(criteria);
                setShowTemplates(false);
              }}
              onClose={() => setShowTemplates(false)}
            />
          </div>
        )}

        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Define Your Decision Criteria
          </h2>
          <p className="text-gray-600">
            {showTemplates
              ? 'Choose a template or customize your own criteria'
              : 'Add 2-5 criteria that matter most for this decision and rate their importance'
            }
          </p>
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

        {/* Future AI Integration Placeholder */}
        {!showTemplates && (
          <div className="bg-gray-50 p-4 rounded-lg opacity-50 cursor-not-allowed">
            <p className="text-sm text-gray-600 text-center">
              AI-powered criteria suggestions coming soon
            </p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          {!showTemplates && (
            <button
              onClick={() => setShowTemplates(true)}
              className="mr-auto px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
            >
              Show Templates
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to Analysis
            <ArrowRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Modals */}
      {showSaveModal && (
        <SaveCriteriaSetModal
          criteria={localCriteria}
          onClose={() => setShowSaveModal(false)}
          onSaved={() => {
            setShowSaveModal(false);
            // Optional: Show success toast
          }}
        />
      )}

      {showLoadModal && (
        <LoadCriteriaSetModal
          onClose={() => setShowLoadModal(false)}
          onLoad={(loadedCriteria) => {
            setLocalCriteria(loadedCriteria);
            setShowLoadModal(false);
            // Optional: Show success toast
          }}
        />
      )}
    </div>
  );
}