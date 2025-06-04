import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Criterion } from '../../contexts/DecisionContext';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const { data, error } = await supabase
          .from('criteria_templates')
          .select('*')
          .eq('type', decisionType);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
        <div>
          <h3 className="font-medium text-red-800">Error loading templates</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Choose a Template
        </h2>
        <p className="text-gray-600">
          Select a template to quickly set up common criteria for your decision type
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(template => (
          <button
            key={template.id}
            onClick={() => onSelect(template.criteria)}
            className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow text-left"
          >
            <h3 className="font-medium text-gray-900 mb-2">{template.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{template.description}</p>
            <div className="space-y-2">
              {template.criteria.map((criterion: Criterion, index: number) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-700">{criterion.name}</span>
                  <span className="text-gray-500">Weight: {criterion.weight}</span>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-700 hover:text-gray-900"
        >
          Skip Templates
        </button>
      </div>
    </div>
  );
}