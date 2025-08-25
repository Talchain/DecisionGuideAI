import React from 'react';
import { Outlet } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useDecision } from '../../contexts/DecisionContext';
import DecisionJourneyMap from './DecisionJourneyMap';
import CollaborationPanel from './CollaborationPanel';
import { useLocation } from 'react-router-dom';

export default function DecisionFlowLayout() {
  const { decisionId, collaborators } = useDecision();
  const location = useLocation();
  const [showCollaborationPanel, setShowCollaborationPanel] = React.useState(false);
  
  // Only show collaboration panel toggle if we have collaborators or are in a decision flow
  const showCollaborationToggle = collaborators.length > 0 || decisionId;
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Main Content with Collaboration Panel */}
      <div className="flex flex-1 min-h-0 gap-4">
        <div className="flex-1 min-h-0">
          <Outlet />
        </div>
        
        {/* Collaboration Panel */}
        {showCollaborationPanel && decisionId && (
          <CollaborationPanel 
            onClose={() => setShowCollaborationPanel(false)} 
          />
        )}
      </div>
      
      {/* Collaboration Panel Toggle */}
      {showCollaborationToggle && (
        <div className="fixed bottom-6 right-6">
          <button
            onClick={() => setShowCollaborationPanel(!showCollaborationPanel)}
            className="flex items-center justify-center w-12 h-12 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
          >
            <Users className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  );
}