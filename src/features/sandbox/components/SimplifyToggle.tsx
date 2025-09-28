import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface SimplifyToggleProps {
  onToggle: (simplified: boolean) => void;
  isSimplified: boolean;
}

const SIMPLIFY_THRESHOLD = 0.3;

export default function SimplifyToggle({ onToggle, isSimplified }: SimplifyToggleProps) {
  const handleToggle = () => {
    const newState = !isSimplified;
    onToggle(newState);

    // Accessibility announcement
    if (newState) {
      const announcement = 'Reduced visual complexity';
      const liveRegion = document.getElementById('live-announcements');
      if (liveRegion) {
        liveRegion.textContent = announcement;
      }
    }
  };

  return (
    <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200">
      <div className="flex items-center space-x-2">
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isSimplified ? 'bg-blue-600' : 'bg-gray-200'
          }`}
          role="switch"
          aria-checked={isSimplified}
          aria-label={`Simplify view toggle. Currently ${isSimplified ? 'simplified' : 'detailed'}`}
          style={{ minHeight: '44px', minWidth: '44px' }} // Mobile tap target
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isSimplified ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>

        <div className="flex items-center space-x-1">
          {isSimplified ? (
            <EyeOff className="h-4 w-4 text-blue-600" />
          ) : (
            <Eye className="h-4 w-4 text-gray-500" />
          )}
          <span className="text-sm font-medium text-gray-700">
            Simplify View
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2 text-xs text-gray-500">
        <span>Threshold:</span>
        <span className="font-mono bg-gray-100 px-2 py-1 rounded">
          {SIMPLIFY_THRESHOLD}
        </span>
      </div>

      {isSimplified && (
        <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
          Simplified
        </div>
      )}
    </div>
  );
}