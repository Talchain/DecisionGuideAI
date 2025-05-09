import React from 'react';
import { Settings, Plus } from 'lucide-react';
import Tooltip from '../../Tooltip';

interface EmptyStateProps {
  onAddOption: () => void;
}

export default function EmptyState({ onAddOption }: EmptyStateProps) {
  return (
    <div className="text-center py-12 bg-gray-50 rounded-lg">
      <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <h4 className="text-lg font-medium text-gray-900 mb-2">No Options Added Yet</h4>
      <p className="text-gray-600 mb-4">Add different options to compare their pros and cons</p>
      <Tooltip content="Start by adding your first option">
        <button
          onClick={onAddOption}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Your First Option
        </button>
      </Tooltip>
    </div>
  );
}