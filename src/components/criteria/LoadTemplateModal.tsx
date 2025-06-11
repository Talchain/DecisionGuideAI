import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertTriangle, Search, Star, Users, Building, Globe, Lock, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import type { Criterion } from '../../contexts/DecisionContext';

interface Template {
  id: string;
  name: string;
  description: string | null;
  criteria: Criterion[];
  type: string;
  sharing: string;
  owner_id: string;
  owner_name?: string;
  created_at: string;
  updated_at: string;
  featured?: boolean;
  tags?: string[];
}

interface LoadTemplateModalProps {
  onClose: () => void;
  onLoad: (criteria: Criterion[]) => void;
}

export default function LoadTemplateModal({
  onClose,
  onLoad
}: LoadTemplateModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch templates from criteria_templates table
        const { data, error: fetchError } = await supabase
          .from('criteria_templates')
          .select('*')
          .order('updated_at', { ascending: false });

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
  }, []);

  const handleLoad = () => {
    if (!selectedTemplate) return;
    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) return;
    
    // Add unique IDs to criteria if they don't have them
    const criteriaWithIds = template.criteria.map(criterion => ({
      ...criterion,
      id: criterion.id || crypto.randomUUID()
    }));
    
    onLoad(criteriaWithIds);
    onClose();
  };

  const filteredTemplates = searchQuery
    ? templates.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : templates;

  const getSharingIcon = (sharing: string) => {
    switch (sharing) {
      case 'private':
        return <Lock className="h-4 w-4 text-gray-500" />;
      case 'team':
        return <Users className="h-4 w-4 text-blue-500" />;
      case 'organization':
        return <Building className="h-4 w-4 text-purple-500" />;
      case 'public':
        return <Globe className="h-4 w-4 text-green-500" />;
      default:
        return <Lock className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.currentTarget === e.target && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Load Template</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          )}

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Templates List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery ? 'No templates found matching your search' : 'No templates found'}
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredTemplates.map(template => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedTemplate === template.id
                      ? 'bg-indigo-50 border-indigo-200'
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{template.name}</h3>
                        {template.featured && (
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-gray-500">
                          {format(new Date(template.updated_at), 'MMM d, yyyy')}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          {getSharingIcon(template.sharing)}
                          <span className="capitalize">{template.sharing}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {template.criteria.length} criteria
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleLoad}
              disabled={!selectedTemplate}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Load Selected Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}