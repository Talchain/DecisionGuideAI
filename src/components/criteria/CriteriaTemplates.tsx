import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, Lightbulb, Users, Target, TrendingUp, Shield, Search, DollarSign, BarChart, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Criterion } from '../../contexts/DecisionContext';

interface CriteriaTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  criteria: Criterion[];
}

interface CriteriaTemplatesProps {
  decisionType: string;
  onSelect: (criteria: Criterion[]) => void;
  onClose: () => void;
}

// Template icons mapping
const getTemplateIcon = (templateName: string) => {
  const name = templateName.toLowerCase();
  if (name.includes('feature') || name.includes('prioritization')) return Target;
  if (name.includes('roadmap') || name.includes('planning')) return TrendingUp;
  if (name.includes('launch') || name.includes('go/no-go')) return BarChart;
  if (name.includes('vendor') || name.includes('tool')) return Search;
  if (name.includes('hiring') || name.includes('team')) return Users;
  if (name.includes('experiment') || name.includes('initiative')) return Lightbulb;
  if (name.includes('investment') || name.includes('budget')) return DollarSign;
  if (name.includes('customer') || name.includes('problem')) return Target;
  if (name.includes('risk') || name.includes('mitigation')) return Shield;
  if (name.includes('retrospective') || name.includes('post-mortem')) return BarChart;
  return Target; // Default icon
};

export default function CriteriaTemplates({
  decisionType,
  onSelect,
  onClose
}: CriteriaTemplatesProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<CriteriaTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        // Fetch templates for the specific decision type and general templates
        const { data, error } = await supabase
          .from('criteria_templates')
          .select('*')
          .in('type', [decisionType, 'other']);

        if (error) throw error;
        setTemplates(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [decisionType]);

  const handleTemplateSelect = (template: CriteriaTemplate) => {
    setSelectedTemplate(template.id);
    // Add unique IDs to criteria if they don't have them
    const criteriaWithIds = template.criteria.map(criterion => ({
      ...criterion,
      id: criterion.id || crypto.randomUUID()
    }));
    onSelect(criteriaWithIds);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-xl flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 text-red-500 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-medium text-red-800 mb-1">Error loading templates</h3>
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-red-600 hover:text-red-700 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12">
        <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No templates available</h3>
        <p className="text-gray-600 mb-6">
          No criteria templates found for {decisionType} decisions.
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Continue without template
        </button>
      </div>
    );
  }

  // Show first 6 templates initially, then all if showAll is true
  const visibleTemplates = showAll ? templates : templates.slice(0, 6);
  const hasMoreTemplates = templates.length > 6;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Choose a Template
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Select a pre-built template to quickly set up criteria optimized for your decision type. 
          You can customize any criteria after applying the template.
        </p>
      </div>

      {/* Templates Grid Container */}
      <div className="space-y-6">
        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleTemplates.map(template => {
            const IconComponent = getTemplateIcon(template.name);
            const isSelected = selectedTemplate === template.id;
            
            return (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className={`p-6 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-lg transform hover:-translate-y-1 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-indigo-300'
                }`}
              >
                {/* Template Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 rounded-lg ${
                    isSelected ? 'bg-indigo-100' : 'bg-gray-100'
                  }`}>
                    <IconComponent className={`h-6 w-6 ${
                      isSelected ? 'text-indigo-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1 leading-tight">
                      {template.name}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {template.description}
                    </p>
                  </div>
                </div>

                {/* Criteria Preview */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                    Included Criteria ({template.criteria.length})
                  </h4>
                  <div className="grid grid-cols-1 gap-1.5">
                    {template.criteria.slice(0, 4).map((criterion, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700 truncate">{criterion.name}</span>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${
                                i < criterion.weight ? 'bg-indigo-400' : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    {template.criteria.length > 4 && (
                      <div className="text-xs text-gray-500 italic">
                        +{template.criteria.length - 4} more criteria
                      </div>
                    )}
                  </div>
                </div>

                {/* Selection Indicator */}
                {isSelected && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-indigo-600">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                    Template applied! You can now customize the criteria.
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Show More Button */}
        {hasMoreTemplates && !showAll && (
          <div className="flex justify-center">
            <button
              onClick={() => setShowAll(true)}
              className="flex items-center gap-2 px-6 py-3 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors font-medium"
            >
              <span>Show {templates.length - 6} More Templates</span>
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Show Less Button */}
        {showAll && hasMoreTemplates && (
          <div className="flex justify-center">
            <button
              onClick={() => setShowAll(false)}
              className="flex items-center gap-2 px-6 py-3 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium"
            >
              <span>Show Less</span>
              <ChevronDown className="h-5 w-5 rotate-180" />
            </button>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          💡 All criteria can be edited, reordered, or removed after applying a template
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              onClose();
              window.location.href = '/templates';
            }}
            className="px-4 py-2 text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Browse All Templates
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Skip Templates
          </button>
        </div>
      </div>
    </div>
  );
}