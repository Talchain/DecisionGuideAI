import React, { useState, useEffect, useRef } from 'react';
import { X, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { decisionCategories, iconMap } from './DecisionTypeSelector';

interface AllDecisionTypesModalProps {
  onClose: () => void;
  onSelectType: (type: string) => void;
  currentType: string | null;
}

export default function AllDecisionTypesModal({ 
  onClose, 
  onSelectType, 
  currentType 
}: AllDecisionTypesModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Product & Work': true,
    'Personal & Life': true,
    'Other': true
  });
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Group decision categories by section
  const groupedCategories = decisionCategories.reduce((acc, category) => {
    if (!acc[category.section]) {
      acc[category.section] = [];
    }
    acc[category.section].push(category);
    return acc;
  }, {} as Record<string, typeof decisionCategories>);

  // Order of sections
  const sectionOrder = ["Product & Work", "Personal & Life", "Other"];

  // Filter categories based on search term
  const filteredCategories = searchTerm.trim() === '' 
    ? groupedCategories 
    : Object.keys(groupedCategories).reduce((acc, section) => {
        const filtered = groupedCategories[section].filter(
          category => 
            category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            category.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            category.examples.some(ex => ex.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        if (filtered.length > 0) {
          acc[section] = filtered;
        }
        return acc;
      }, {} as Record<string, typeof decisionCategories>);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Focus search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSelectType = (type: string) => {
    onSelectType(type);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 md:p-6"
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        data-testid="all-types-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b">
          <h2 id="modal-title" className="text-xl font-bold text-gray-900">
            All Decision Types
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 md:p-6 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search decision types..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              data-testid="decision-type-search"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {Object.keys(filteredCategories).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No decision types match your search.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sectionOrder.map(section => {
                if (!filteredCategories[section]) return null;
                
                return (
                  <div key={section} className="space-y-3">
                    <button
                      onClick={() => toggleSection(section)}
                      className="flex items-center justify-between w-full text-left"
                      aria-expanded={expandedSections[section]}
                      aria-controls={`section-${section}`}
                    >
                      <h3 className="text-lg font-semibold text-gray-800">{section}</h3>
                      {expandedSections[section] ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                    </button>
                    
                    {expandedSections[section] && (
                      <div 
                        id={`section-${section}`}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                      >
                        {filteredCategories[section].map(category => {
                          // Get the icon component from the iconMap
                          const IconComponent = iconMap[category.icon] || (() => <div>?</div>);
                          const isSelected = currentType === category.name;
                          
                          return (
                            <button
                              key={category.name}
                              onClick={() => handleSelectType(category.name)}
                              className={`
                                flex flex-col items-start p-4 rounded-lg border-2 transition-all duration-200
                                text-left relative overflow-hidden h-full
                                ${isSelected 
                                  ? 'border-indigo-500 bg-indigo-50' 
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                              `}
                              aria-pressed={isSelected}
                              data-testid={`decision-type-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}