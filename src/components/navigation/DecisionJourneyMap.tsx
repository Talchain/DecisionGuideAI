import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDecision } from '../../contexts/DecisionContext';
import { 
  Target, 
  Lightbulb, 
  ListChecks, 
  BarChart2, 
  CheckCircle,
  ArrowRight,
  Users,
  Lock
} from 'lucide-react';
import Tooltip from '../Tooltip';

interface JourneyStep {
  id: string;
  path: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

export default function DecisionJourneyMap() {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    decisionId, 
    decision, 
    goals, 
    options, 
    criteria,
    collaborators
  } = useDecision();

  // Define the journey steps
  const journeySteps: JourneyStep[] = [
    {
      id: 'frame',
      path: '/decision/intake',
      label: 'Frame',
      icon: Target,
      description: 'Define your decision'
    },
    {
      id: 'goals',
      path: '/decision/goals',
      label: 'Goals',
      icon: Lightbulb,
      description: 'Clarify your objectives'
    },
    {
      id: 'options',
      path: '/decision/options',
      label: 'Options',
      icon: ListChecks,
      description: 'Generate alternatives'
    },
    {
      id: 'criteria',
      path: '/decision/criteria',
      label: 'Criteria',
      icon: BarChart2,
      description: 'Define evaluation criteria'
    },
    {
      id: 'analysis',
      path: '/decision/analysis',
      label: 'Analysis',
      icon: CheckCircle,
      description: 'Review and finalize'
    }
  ];

  // Determine current step
  const currentStepIndex = journeySteps.findIndex(step => 
    location.pathname === step.path
  );

  // Determine which steps are available based on decision state
  const isStepAvailable = (index: number): boolean => {
    if (index === 0) return true; // Frame is always available
    if (!decisionId || !decision) return false;
    
    switch(index) {
      case 1: // Goals
        return true;
      case 2: // Options
        return !!goals?.length || location.pathname === '/decision/options';
      case 3: // Criteria
        return (!!options?.length && options.length > 0) || location.pathname === '/decision/criteria';
      case 4: // Analysis
        return (!!criteria?.length && criteria.length > 0) || location.pathname === '/decision/analysis';
      default:
        return false;
    }
  };

  // Navigate to a step if it's available
  const goToStep = (path: string, index: number) => {
    if (isStepAvailable(index)) {
      navigate(path, { 
        state: { 
          decisionId,
          decision,
          goals
        } 
      });
    }
  };

  // If no decision in progress, don't show the journey map
  if (!decisionId && !location.pathname.startsWith('/decision/')) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">Decision Journey</h3>
        {collaborators.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            <span className="text-xs text-gray-600">{collaborators.length} collaborator{collaborators.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between">
        {journeySteps.map((step, index) => {
          const isActive = location.pathname === step.path;
          const isAvailable = isStepAvailable(index);
          const isPast = index < currentStepIndex;
          const isFuture = index > currentStepIndex;
          
          const StepIcon = step.icon;
          
          return (
            <React.Fragment key={step.id}>
              <Tooltip content={isAvailable ? step.description : 'Complete previous steps first'}>
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => goToStep(step.path, index)}
                    disabled={!isAvailable}
                    className={`
                      relative w-10 h-10 rounded-full flex items-center justify-center
                      ${isActive 
                        ? 'bg-indigo-600 text-white' 
                        : isAvailable 
                          ? 'bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50' 
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-gray-200'
                      }
                      transition-all duration-200
                    `}
                  >
                    {!isAvailable && (
                      <Lock className="absolute h-3 w-3 top-0 right-0 text-gray-400" />
                    )}
                    <StepIcon className="h-5 w-5" />
                  </button>
                  <span className={`
                    text-xs mt-1
                    ${isActive 
                      ? 'font-medium text-indigo-600' 
                      : isAvailable 
                        ? 'text-gray-700' 
                        : 'text-gray-400'
                    }
                  `}>
                    {step.label}
                  </span>
                </div>
              </Tooltip>
              
              {index < journeySteps.length - 1 && (
                <div className={`
                  w-12 h-0.5 
                  ${isPast ? 'bg-indigo-600' : 'bg-gray-200'}
                `}>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}