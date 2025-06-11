import React, { useState } from 'react';
import { X, Users, Building, Globe, Lock, Share2, Loader2 } from 'lucide-react';
import type { CriteriaTemplate } from '../../types/templates';

interface ShareTemplateModalProps {
  template: CriteriaTemplate;
  onClose: () => void;
  onSave: (sharing: string) => Promise<void>;
}

export default function ShareTemplateModal({ template, onClose, onSave }: ShareTemplateModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedSharing, setSelectedSharing] = useState(template.sharing);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(selectedSharing);
    } finally {
      setLoading(false);
    }
  };

  const sharingOptions = [
    {
      value: 'private',
      label: 'Private',
      description: 'Only you can see and use this template',
      icon: Lock,
      color: 'text-gray-500'
    },
    {
      value: 'team',
      label: 'Team',
      description: 'Members of your teams can see and use this template',
      icon: Users,
      color: 'text-blue-500'
    },
    {
      value: 'organization',
      label: 'Organization',
      description: 'Everyone in your organization can see and use this template',
      icon: Building,
      color: 'text-purple-500'
    },
    {
      value: 'public',
      label: 'Public',
      description: 'Anyone can discover and use this template',
      icon: Globe,
      color: 'text-green-500'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">Share Template</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="mb-4">
              <h3 className="font-medium text-gray-900 mb-1">{template.name}</h3>
              <p className="text-sm text-gray-500">Choose who can access this template</p>
            </div>

            <div className="space-y-3">
              {sharingOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedSharing === option.value;
                
                return (
                  <label
                    key={option.value}
                    className={`
                      flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${isSelected 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="sharing"
                      value={option.value}
                      checked={isSelected}
                      onChange={(e) => setSelectedSharing(e.target.value)}
                      className="sr-only"
                    />
                    
                    <Icon className={`h-5 w-5 mt-0.5 ${option.color}`} />
                    
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{option.label}</div>
                      <div className="text-sm text-gray-500">{option.description}</div>
                    </div>
                    
                    {isSelected && (
                      <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                  </label>
                );
              })}
            </div>

            {selectedSharing === 'public' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <div className="text-sm text-yellow-800">
                    <strong>Public templates</strong> will be visible to all users and may be featured in our template marketplace. Make sure your template follows our community guidelines.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              Update Sharing
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}