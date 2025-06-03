import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
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

export default function CriteriaTemplates({
  decisionType,
  onSelect,
  onClose
}: CriteriaTemplatesProps) {
  const [templates, setTemplates] = useState<CriteriaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('criteria_templates')
          .select('*')
          .eq('type', decisionType);

        if (fetchError) throw fetchError;
        setTemplates(data || []);
      } catch (err) {
        console.error('Error fetching templates:', err);
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [decisionType]);

  const handleApply = async () => {
    if (!selectedTemplate) return;
    
    setApplying(true);
    try {
      const template = templates.find(t => t.id === selectedTemplate);
      if (!template) throw new Error('Template not found');
      
      // Add unique IDs to criteria if they don't have them
      const criteriaWithIds = template.criteria.map(c => ({
        ...c,
        id: c.id || crypto.randomUUID()
      }));
      
      onSelect(criteriaWithIds);
      onClose();
    } catch (err) {
      console.error('Error applying template:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply template');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 p-4 rounded-lg flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(template => (
          <div
            key={template.id}
            onClick={() => setSelectedTemplate(template.id)}
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              selectedTemplate === template.id
                ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500'
                : 'hover:bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium text-gray-900">{template.name}</h3>
              {selectedTemplate === template.id && (
                <CheckCircle className="h-5 w-5 text-indigo-600" />
              )}
            </div>
            <p className="text-sm text-gray-600 mb-4">{template.description}</p>
            
            <div className="space-y-2">
              {template.criteria.map((criterion, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{criterion.name}</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                    Weight: {criterion.weight}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 hover:text-gray-900"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={!selectedTemplate || applying}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {applying ? (
            <>
              <Loader2 className="animate-spin h-5 w-5 mr-2" />
              Applying...
            </>
          ) : (
            'Apply Template'
          )}
        </button>
      </div>
    </div>
  );
}