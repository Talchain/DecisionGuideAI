import React, { useState } from 'react';
import { X, Save, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Criterion } from '../../contexts/DecisionContext';

interface SaveCriteriaSetModalProps {
  criteria: Criterion[];
  teamId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function SaveCriteriaSetModal({
  criteria,
  teamId,
  onClose,
  onSaved
}: SaveCriteriaSetModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isTeamShared, setIsTeamShared] = useState(!!teamId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { error: saveError } = await supabase
        .from('criteria_sets')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          criteria,
          team_id: isTeamShared ? teamId : null
        });

      if (saveError) {
        if (saveError.code === '23505') {
          throw new Error('A criteria set with this name already exists');
        }
        throw saveError;
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Error saving criteria set:', err);
      setError(err instanceof Error ? err.message : 'Failed to save criteria set');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.currentTarget === e.target && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Save Criteria Set</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Feature Prioritization Criteria"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add a brief description..."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {teamId && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="teamShared"
                checked={isTeamShared}
                onChange={e => setIsTeamShared(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="teamShared" className="text-sm text-gray-700">
                Share with team
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Save Criteria Set
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}