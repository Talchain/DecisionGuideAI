import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Option } from '../../hooks/useDecisionOptions';

interface MergeOptionsModalProps {
  options: Option[];
  onMerge: (mergedText: string) => Promise<void>;
  onClose: () => void;
}

export default function MergeOptionsModal({
  options,
  onMerge,
  onClose
}: MergeOptionsModalProps) {
  const [mergedText, setMergedText] = useState(() => 
    options.map(opt => opt.text).join('\n\n')
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergedText.trim()) return;
    await onMerge(mergedText.trim());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Merge Options</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Selected Options
            </label>
            <div className="space-y-2">
              {options.map(option => (
                <div
                  key={option.id}
                  className="p-2 bg-gray-50 rounded text-sm text-gray-600"
                >
                  {option.text}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="mergedText"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Merged Text
            </label>
            <textarea
              id="mergedText"
              value={mergedText}
              onChange={(e) => setMergedText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={6}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!mergedText.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Merge Options
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}