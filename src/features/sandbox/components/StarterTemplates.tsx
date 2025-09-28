import React, { useState, useEffect } from 'react';
import { PlayCircle, FileText, Building, Code } from 'lucide-react';
import templatesData from '../fixtures/templates.json';

interface Template {
  id: string;
  name: string;
  description: string;
  seed: number;
  nodes: Array<{
    id: string;
    type: string;
    title: string;
    score: number;
    pros: string[];
    cons: string[];
  }>;
  drivers: string[];
}

interface StarterTemplatesProps {
  onTemplateSelect: (template: Template) => void;
  selectedTemplateId?: string;
}

const STORAGE_KEY = 'windsurf.lastTemplate';

export default function StarterTemplates({ onTemplateSelect, selectedTemplateId }: StarterTemplatesProps) {
  const [lastUsedTemplate, setLastUsedTemplate] = useState<string | null>(null);

  // Load last used template from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setLastUsedTemplate(saved);
        // Auto-load the last used template if none is currently selected
        if (!selectedTemplateId) {
          const template = templatesData.templates.find(t => t.id === saved);
          if (template) {
            onTemplateSelect(template);
          }
        }
      } else if (!selectedTemplateId && templatesData.templates.length > 0) {
        // Default to first template if nothing saved and nothing selected
        onTemplateSelect(templatesData.templates[0]);
      }
    } catch (error) {
      console.warn('Failed to load last template from localStorage:', error);
    }
  }, [onTemplateSelect, selectedTemplateId]);

  const handleTemplateSelect = (template: Template) => {
    try {
      localStorage.setItem(STORAGE_KEY, template.id);
      setLastUsedTemplate(template.id);
    } catch (error) {
      console.warn('Failed to save template choice to localStorage:', error);
    }

    onTemplateSelect(template);

    // Accessibility announcement
    const announcement = `Template loaded. Seed ${template.seed}.`;
    const liveRegion = document.getElementById('live-announcements');
    if (liveRegion) {
      liveRegion.textContent = announcement;
    } else {
      // Create live region if it doesn't exist
      const region = document.createElement('div');
      region.id = 'live-announcements';
      region.className = 'sr-only';
      region.setAttribute('aria-live', 'polite');
      region.textContent = announcement;
      document.body.appendChild(region);
    }
  };

  const getTemplateIcon = (templateId: string) => {
    switch (templateId) {
      case 'pricing-change':
        return <Building className="h-5 w-5" />;
      case 'feature-launch':
        return <PlayCircle className="h-5 w-5" />;
      case 'build-vs-buy':
        return <Code className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-3">Starter Templates</h3>
      <div className="space-y-2">
        {templatesData.templates.map((template) => (
          <button
            key={template.id}
            onClick={() => handleTemplateSelect(template)}
            className={`w-full text-left p-3 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              selectedTemplateId === template.id
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            aria-pressed={selectedTemplateId === template.id}
            style={{ minHeight: '44px' }} // Mobile tap target
          >
            <div className="flex items-start space-x-3">
              <div className={`mt-0.5 ${selectedTemplateId === template.id ? 'text-blue-600' : 'text-gray-400'}`}>
                {getTemplateIcon(template.id)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium truncate">{template.name}</h4>
                  {lastUsedTemplate === template.id && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      Last used
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {template.nodes.length} options • Seed {template.seed}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Screen reader only styles
const srOnlyStyles = `
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`;

// Inject styles if not already present
if (typeof document !== 'undefined' && !document.getElementById('sr-only-styles')) {
  const style = document.createElement('style');
  style.id = 'sr-only-styles';
  style.textContent = srOnlyStyles;
  document.head.appendChild(style);
}