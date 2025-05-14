import React, { useState, useCallback } from 'react';
import { useDecisionOptions } from '../../hooks/useDecisionOptions';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Loader2, Users, AlertTriangle } from 'lucide-react';
import OptionCard from './OptionCard';
import CollaboratorAvatar from './CollaboratorAvatar';
import MergeOptionsModal from './MergeOptionsModal';
import { Option } from '../../hooks/useDecisionOptions';

interface CollaborativeOptionsProps {
  decisionId: string;
  onGenerateAI?: () => Promise<void>;
}

export default function CollaborativeOptions({ decisionId, onGenerateAI }: CollaborativeOptionsProps) {
  const { user } = useAuth();
  const {
    options,
    loading,
    error,
    typingUsers,
    addOption,
    updateOption,
    deleteOption,
    mergeOptions
  } = useDecisionOptions({ decisionId });

  const [newOptionText, setNewOptionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptionText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addOption(newOptionText.trim());
      setNewOptionText('');
    } catch (err) {
      console.error('Failed to add option:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMerge = async (mergedText: string) => {
    try {
      await mergeOptions(selectedOptions, mergedText);
      setSelectedOptions([]);
      setShowMergeModal(false);
    } catch (err) {
      console.error('Failed to merge options:', err);
    }
  };

  const toggleOptionSelection = (optionId: string) => {
    setSelectedOptions(prev => 
      prev.includes(optionId)
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  };

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
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
        <div>
          <h3 className="font-medium text-red-800">Error loading options</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Collaborators Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600">Collaborators</span>
          <div className="flex -space-x-2">
            {Array.from(typingUsers).map(userId => (
              <CollaboratorAvatar key={userId} userId={userId} isTyping />
            ))}
          </div>
        </div>
        
        {onGenerateAI && (
          <button
            onClick={onGenerateAI}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Generate AI Suggestions
          </button>
        )}
      </div>

      {/* Add Option Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newOptionText}
            onChange={(e) => setNewOptionText(e.target.value)}
            placeholder="Add a new option..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!newOptionText.trim() || isSubmitting}
            className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
            Add Option
          </button>
        </div>
      </form>

      {/* Options List */}
      <div className="space-y-4">
        {options.map(option => (
          <OptionCard
            key={option.id}
            option={option}
            isSelected={selectedOptions.includes(option.id)}
            onSelect={() => toggleOptionSelection(option.id)}
            onUpdate={updateOption}
            onDelete={deleteOption}
            currentUserId={user?.id}
          />
        ))}
      </div>

      {/* Merge Options Button */}
      {selectedOptions.length > 1 && (
        <div className="fixed bottom-4 right-4">
          <button
            onClick={() => setShowMergeModal(true)}
            className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-lg"
          >
            Merge {selectedOptions.length} Options
          </button>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <MergeOptionsModal
          options={options.filter(opt => selectedOptions.includes(opt.id))}
          onMerge={handleMerge}
          onClose={() => setShowMergeModal(false)}
        />
      )}
    </div>
  );
}