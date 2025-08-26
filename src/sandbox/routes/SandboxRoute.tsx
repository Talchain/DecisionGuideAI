import * as React from 'react';
import { SandboxCanvas } from '../components/SandboxCanvas';
import { DraftToggle } from '../../components/ui/DraftToggle';

interface SandboxRouteProps {
  boardId?: string;
}

export const SandboxRoute: React.FC<SandboxRouteProps> = ({ boardId }) => {
  // Check if the feature is enabled
  const isSandboxEnabled = import.meta.env.VITE_FEATURE_SCENARIO_SANDBOX === 'true';
  const isVotingEnabled = import.meta.env.VITE_FEATURE_COLLAB_VOTING === 'true';

  if (!isSandboxEnabled) {
    return (
      <div className="container mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Feature Not Available</h1>
        <p className="text-gray-600">
          The Scenario Sandbox feature is currently disabled. Please enable it in your environment variables.
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              DecisionGuide.AI - Scenario Sandbox
            </h1>
            <div className="flex items-center space-x-4">
              {isVotingEnabled && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  Collaborative Voting
                </span>
              )}
              <DraftToggle className="ml-2" />
              <button className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">
                Save Draft
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-hidden">
        <SandboxCanvas boardId={boardId} />
      </main>
      
      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>DecisionGuide.AI - Scenario Sandbox</span>
            <span>v0.1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
