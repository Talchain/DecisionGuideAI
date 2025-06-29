import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks, Map, Rocket, ShoppingCart, FlaskConical, Repeat, AlertTriangle, Users, HandHelping, Briefcase, CreditCard, HeartPulse, Sun, GraduationCap, Users2, CircleEllipsis as Ellipsis, ArrowRight, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useDecision } from '../contexts/DecisionContext';
import ChatBox from './ChatBox';
import Tooltip from './Tooltip';

// Define the decision type structure
interface DecisionCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  examples: string[];
  section: string;
  backendType: 'professional' | 'financial' | 'health' | 'career' | 'relationships' | 'other';
}

// Map of icon names to Lucide React components
export const iconMap: Record<string, React.ElementType> = {
  ListChecks,
  Map,
  Rocket,
  ShoppingCart,
  FlaskConical,
  Repeat,
  AlertTriangle,
  Users,
  HandHelping,
  Briefcase,
  CreditCard,
  HeartPulse,
  Sun,
  GraduationCap,
  Users2,
  Ellipsis,
  HelpCircle
};

// Decision categories data
export const decisionCategories: DecisionCategory[] = [
  {
    id: "feature-prioritization",
    name: "Feature Prioritization",
    icon: "ListChecks",
    description: "Rank features or improvements for your next release.",
    examples: [
      "Which feature should we build next?",
      "What goes in our upcoming sprint?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "roadmap-strategy",
    name: "Roadmap/Strategy",
    icon: "Map",
    description: "Plan or prioritize projects and initiatives.",
    examples: [
      "How should we structure our roadmap?",
      "Which initiatives are most strategic?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "go-no-go-launch",
    name: "Go/No-Go Launch",
    icon: "Rocket",
    description: "Decide if a product or feature is ready to launch.",
    examples: [
      "Is our product ready for users?",
      "Should we release this update now?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "vendor-tool-selection",
    name: "Vendor/Tool Selection",
    icon: "ShoppingCart",
    description: "Choose between tools, vendors, or services.",
    examples: [
      "Which analytics tool should we buy?",
      "Who should be our new infrastructure provider?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "experiment-pilot-evaluation",
    name: "Experiment/Pilot Evaluation",
    icon: "FlaskConical",
    description: "Assess the value of experiments and pilots.",
    examples: [
      "Which test should we run next?",
      "Was our experiment a success?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "retrospective-learning",
    name: "Retrospective/Learning",
    icon: "Repeat",
    description: "Reflect on past work to improve future outcomes.",
    examples: [
      "What did we learn from the last release?",
      "How can we improve our process?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "risk-dependency-assessment",
    name: "Risk/Dependency Assessment",
    icon: "AlertTriangle",
    description: "Identify and prioritize risks or blockers.",
    examples: [
      "What could block this project?",
      "How risky is this dependency?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "team-hiring",
    name: "Team/Hiring",
    icon: "Users",
    description: "Make decisions about hiring or team structure.",
    examples: [
      "Who should join our team?",
      "Is it time to hire a new PM?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "stakeholder-alignment",
    name: "Stakeholder/Alignment",
    icon: "HandHelping",
    description: "Align on strategy or priorities with stakeholders.",
    examples: [
      "How do we get consensus on direction?",
      "Who should be involved in this decision?"
    ],
    section: "Product & Work",
    backendType: "professional"
  },
  {
    id: "career-job-move",
    name: "Career/Job Move",
    icon: "Briefcase",
    description: "Evaluate job offers or career moves.",
    examples: [
      "Should I accept this job?",
      "Is it time to switch roles?"
    ],
    section: "Personal & Life",
    backendType: "career"
  },
  {
    id: "financial-purchasing",
    name: "Financial/Purchasing",
    icon: "CreditCard",
    description: "Make major spending, saving, or investment choices.",
    examples: [
      "Should I invest in this opportunity?",
      "Which laptop should I buy?"
    ],
    section: "Personal & Life",
    backendType: "financial"
  },
  {
    id: "health-wellness",
    name: "Health/Wellness",
    icon: "HeartPulse",
    description: "Choose a health, fitness, or lifestyle path.",
    examples: [
      "Which exercise plan is best for me?",
      "Should I change my diet?"
    ],
    section: "Personal & Life",
    backendType: "health"
  },
  {
    id: "major-life-decision",
    name: "Major Life Decision",
    icon: "Sun",
    description: "Decide on major changes like moving, relationships, or big commitments.",
    examples: [
      "Should we move to a new city?",
      "Is it the right time to start a family?"
    ],
    section: "Personal & Life",
    backendType: "other"
  },
  {
    id: "education-personal-development",
    name: "Education/Personal Development",
    icon: "GraduationCap",
    description: "Select courses, degrees, or growth opportunities.",
    examples: [
      "Which course should I take?",
      "Is this degree the right next step?"
    ],
    section: "Personal & Life",
    backendType: "other"
  },
  {
    id: "relationships-group",
    name: "Relationships/Group",
    icon: "Users2",
    description: "Decide on social, family, or group matters.",
    examples: [
      "How should we resolve this family disagreement?",
      "What's the best way to support my friend?"
    ],
    section: "Personal & Life",
    backendType: "relationships"
  },
  {
    id: "something-else",
    name: "Something else",
    icon: "Ellipsis",
    description: "Any other decision not listed above.",
    examples: [
      "I want to use my own decision process.",
      "My decision doesn't fit any of these."
    ],
    section: "Other",
    backendType: "other"
  }
];

export default function DecisionTypeSelector() {
  const navigate = useNavigate();
  const { resetDecisionContext, setDecisionType, setDecision } = useDecision();
  const [showPersonalLife, setShowPersonalLife] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Group decision categories by section
  const groupedCategories = decisionCategories.reduce((acc, category) => {
    if (!acc[category.section]) {
      acc[category.section] = [];
    }
    acc[category.section].push(category);
    return acc;
  }, {} as Record<string, DecisionCategory[]>);

  // Order of sections
  const sectionOrder = ["Product & Work", "Personal & Life", "Other"];

  const handleSelect = (type: string) => {
    setSelectedType(type);
  };
  
  // Find the selected category to get its backendType
  const getBackendType = (categoryName: string): string => {
    const category = decisionCategories.find(c => c.name === categoryName);
    if (!category) {
      console.warn(`No category found with name: ${categoryName}. Defaulting to 'other'.`);
      return 'other';
    }
    return category.backendType;
  };

  const handleContinue = () => {
    if (!selectedType) return;
    
    // Clear all previous decision state when starting a new flow
    resetDecisionContext();

    // Initialize this decision
    const backendType = getBackendType(selectedType);
    
    // Log for debugging
    console.log(`Selected type: ${selectedType}, mapped to backend type: ${backendType}`);
    setDecisionType(backendType);
    setDecision(''); // clear any previous decision text
    localStorage.setItem('decisionType', selectedType);

    // Move on to the details step
    navigate('/decision/details');
  };

  const handleBrowseTemplates = () => {
    resetDecisionContext();
    navigate('/templates');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-start py-6 px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-4xl mx-auto space-y-4 mb-6">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
            What type of decision are you facing?
          </span>
        </h2>
        <div className="flex items-center justify-center gap-2">
          <p className="text-lg text-gray-600">
            Olumi uses your decision type to recommend the best tools and templates.
          </p>
          <Tooltip content="Selecting a type helps Olumi recommend the most relevant tools and methods.">
            <HelpCircle className="h-5 w-5 text-gray-400 cursor-help" />
          </Tooltip>
        </div>
      </div>

      <div className="w-full max-w-7xl space-y-8">
        {sectionOrder.map((section) => (
          <div key={section} className="space-y-4">
            {section !== "Other" ? (
              <div className="flex items-center justify-between px-4">
                <h3 className="text-xl font-semibold text-gray-800">{section}</h3>
                {section === "Personal & Life" && (
                  <button 
                    onClick={() => setShowPersonalLife(!showPersonalLife)}
                    className="flex items-center text-gray-600 hover:text-indigo-600 transition-colors"
                    aria-expanded={showPersonalLife}
                    aria-controls="personal-life-section"
                  >
                    <span className="text-sm mr-1">{showPersonalLife ? 'Hide' : 'Show'}</span>
                    {showPersonalLife ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </button>
                )}
              </div>
            ) : (
              null
            )}
            <div 
              id={section === "Personal & Life" ? "personal-life-section" : undefined}
              className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-4 ${
                section === "Personal & Life" && !showPersonalLife ? "hidden" : ""
              }`}
            >
              {(section === "Personal & Life" && !showPersonalLife ? [] : groupedCategories[section])?.map((category) => {
                const isSelected = selectedType === category.name;
                const IconComponent = iconMap[category.icon] || HelpCircle;
                
                return (
                  <button
                    key={category.name}
                    onClick={() => handleSelect(category.name)}
                    className={`
                      bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 
                      text-left relative overflow-hidden h-full flex flex-col justify-between
                      focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                      ${isSelected ? 'border-2 border-indigo-500 ring-2 ring-indigo-500' : 'border border-gray-200'}
                    `}
                    aria-pressed={isSelected}
                  >
                    <div className="relative z-10">
                      <div className="flex items-start gap-4 mb-4">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-100' : 'bg-gray-50'} transition-colors duration-300`}>
                          <IconComponent className={`h-5 w-5 ${isSelected ? 'text-indigo-600' : 'text-gray-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-lg font-semibold mb-1 ${isSelected ? 'text-indigo-700' : 'text-gray-900'}`}>
                            {category.name}
                          </h4>
                          <p className="text-sm text-gray-500 mb-2">{category.description}</p>
                          <p className="text-xs text-gray-400 italic">e.g., {category.examples[0]}</p>
                        </div>
                      </div>
                    </div>
                    <div className={`absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-transparent to-purple-50/50 opacity-0 ${isSelected ? 'opacity-100' : 'group-hover:opacity-100'} transition-opacity duration-300`} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Continue Button */}
      {selectedType && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleContinue}
            className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Continue with {selectedType}
            <ArrowRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      )}

      {/* Browse Templates Link */}
      <div className="mt-8 text-center">
        <button
          onClick={handleBrowseTemplates}
          className="text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Browse all templates
        </button>
      </div>
      
      <div className="mt-8 w-full max-w-4xl mx-auto px-4">
        <ChatBox />
      </div>
    </div>
  );
}