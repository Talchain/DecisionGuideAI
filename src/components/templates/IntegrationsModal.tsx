import React from 'react';
import { X, Settings, ExternalLink } from 'lucide-react';

interface IntegrationsModalProps {
  onClose: () => void;
}

export default function IntegrationsModal({ onClose }: IntegrationsModalProps) {
  const integrations = [
    {
      name: 'Notion',
      description: 'Sync templates with your Notion workspace',
      logo: '📝',
      status: 'coming-soon'
    },
    {
      name: 'Jira',
      description: 'Import criteria from Jira project templates',
      logo: '🔷',
      status: 'coming-soon'
    },
    {
      name: 'Slack',
      description: 'Share templates and get notifications in Slack',
      logo: '💬',
      status: 'coming-soon'
    },
    {
      name: 'Microsoft Teams',
      description: 'Collaborate on templates within Teams',
      logo: '👥',
      status: 'coming-soon'
    },
    {
      name: 'Airtable',
      description: 'Export templates to Airtable bases',
      logo: '📊',
      status: 'coming-soon'
    },
    {
      name: 'Google Sheets',
      description: 'Export criteria templates to Google Sheets',
      logo: '📈',
      status: 'coming-soon'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">Integrations</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Connect Your Favorite Tools
            </h3>
            <p className="text-gray-600">
              We're building integrations to help you use templates across your existing workflow. 
              These integrations will allow you to sync, import, and export templates seamlessly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{integration.logo}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-gray-900">{integration.name}</h4>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Coming Soon
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{integration.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-blue-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <ExternalLink className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Request an Integration</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Don't see the tool you need? Let us know what integrations would be most valuable 
                  for your workflow and we'll prioritize them in our development roadmap.
                </p>
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Submit Integration Request →
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}