import React from 'react';
import { useDecision } from '../contexts/DecisionContext';
import CollaborativeCriteriaStage from './CollaborativeCriteriaStage';
import IndividualCriteriaStage from './IndividualCriteriaStage';

export default function CriteriaStage() {
  const { collaborators } = useDecision();
  const isCollaborative = collaborators.length > 0;

  return isCollaborative ? <CollaborativeCriteriaStage /> : <IndividualCriteriaStage />;
}