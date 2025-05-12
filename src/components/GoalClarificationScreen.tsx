import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, AlertTriangle } from 'lucide-react';
import { useDecision } from '../contexts/DecisionContext';

export default function GoalClarificationScreen() {
  const navigate = useNavigate();
  const {
    decisionType,
    decision,
    importance,
    reversibility,
    decisionId,
    goals,
    setGoals,
  } = useDecision();

  // Guards
  if (!decisionType)    return <Navigate to="/decision" replace />;
  if (!decision)        return <Navigate to="/decision/details" replace />;
  if (!importance)      return <Navigate to="/decision/importance" replace />;
  if (!reversibility)   return <Navigate to="/decision/reversibility" replace />;
  if (!decisionId)      return <Navigate to="/decision" replace />;

  const [newGoal, setNewGoal] = useState('');
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const shouldSkip = importance === 'low_priority_quick_assessment' && reversibility === 'Low';

  // Auto-skip
  useEffect(() => {
    if (shouldSkip) navigate('/decision/analysis', { replace: true });
  }, [shouldSkip, navigate]);

  const handleBack = () => navigate('/decision/reversibility');
  const handleContinue = () => navigate('/decision/options');
  const handleAdd = () => {
    if (!newGoal.trim()) return;
    setGoals([...goals, newGoal.trim()]);
    setNewGoal('');
  };
  const handleRemove = (i: number) => {
    const upd = [...goals];
    upd.splice(i, 1);
    setGoals(upd);
  };
  const handleSkip = () => {
    if (!showSkipConfirm) return setShowSkipConfirm(true);
    setGoals([]);
    navigate(`/decision/${decisionId}/analysis`, { replace: true });
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto p-4">
      <button
        onClick={handleBack}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Reversibility
      </button>

      {/* Title + Generate Goals */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-center flex-1">
          <h2 className="text-3xl font-bold mb-2">What are your goals?</h2>
          <p className="text-gray-600">
            Defining goals helps focus the analysis on what matters most.
          </p>
        </div>
        <button
          onClick={() => alert('Coming soon')}
          className="ml-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          Generate Goals
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        {goals.length > 0 && (
          <ul className="space-y-2 mb-4">
            {goals.map((g, idx) => (
              <li key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span>{g}</span>
                <button
                  onClick={() => handleRemove(idx)}
                  aria-label="Remove goal"
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newGoal}
            onChange={e => setNewGoal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            placeholder="Enter a goal…"
            className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleAdd}
            disabled={!newGoal.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {showSkipConfirm && (
          <div className="bg-yellow-50 p-4 rounded mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">
                  Are you sure you want to skip setting goals?
                </p>
                <p className="text-yellow-700">
                  Goals help ensure the analysis stays on track.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2 bg-yellow-100 text-yellow-900 rounded"
                  >
                    Yes, skip goals
                  </button>
                  <button
                    onClick={() => setShowSkipConfirm(false)}
                    className="px-4 py-2 bg-white border rounded"
                  >
                    No, add goals
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={handleContinue}
            disabled={goals.length === 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
          >
            Continue
          </button>
          <button
            onClick={handleSkip}
            className="px-6 py-2 border text-gray-700 rounded"
          >
            Skip Goals
          </button>
        </div>
      </div>
    </div>
  );
}