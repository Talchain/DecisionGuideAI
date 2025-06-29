import React from 'react';
import { useDecision } from '../contexts/DecisionContext';
import CollaborativeCriteriaStage from './CollaborativeCriteriaStage';
import IndividualCriteriaStage from './IndividualCriteriaStage';

export default function CriteriaStage() {
  const { collaborators } = useDecision();
  const isCollaborative = collaborators.length > 0;

  // Ensure we're in the right flow
  const navigate = useNavigate();
  const { decisionId, decision, importance, reversibility } = useDecision();
  
  // Flow guards
  if (!decisionId || !decision || !importance || !reversibility) {
    return <Navigate to="/decision/intake" replace />;
  }
  
  return isCollaborative ? 
    <CollaborativeCriteriaStage /> : 
    <IndividualCriteriaStage />;
}