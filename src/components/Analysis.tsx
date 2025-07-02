import React from 'react';
import { useDecision } from '../contexts/DecisionContext';
import ProsConsList from './ProsConsList';

export default function Analysis() {
  const { decision, goals, options, criteria } = useDecision();

  if (!decision) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Decision Found</h2>
          <p className="text-gray-600">Please start a new decision to see the analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Decision Analysis</h1>
        
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Decision Overview</h2>
            <p className="text-gray-600">{decision.title}</p>
            {decision.description && (
              <p className="text-gray-500 mt-2">{decision.description}</p>
            )}
          </div>

          {goals && goals.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Goals</h3>
              <ul className="space-y-2">
                {goals.map((goal, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-indigo-600 rounded-full mt-2 flex-shrink-0"></span>
                    <span className="text-gray-700">{goal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {criteria && criteria.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Evaluation Criteria</h3>
              <ul className="space-y-2">
                {criteria.map((criterion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></span>
                    <div>
                      <span className="text-gray-700 font-medium">{criterion.name}</span>
                      {criterion.description && (
                        <p className="text-gray-500 text-sm mt-1">{criterion.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {options && options.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-lg font-semibold mb-4">Options Analysis</h3>
              <ProsConsList options={options} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}