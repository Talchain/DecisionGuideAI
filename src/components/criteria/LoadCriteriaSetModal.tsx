import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertTriangle, Search, Users, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Criterion } from '../../contexts/DecisionContext';

interface CriteriaSet {
  id: string;
  name: string;
  description: string | null;
  criteria: Criterion[];
  team_id: string | null;
  created_at: string;
}

interface LoadCriteriaSetModalProps {
  teamId?: string | null;
  onClose: () => void;
  onLoad: (criteria: Criterion[]) => void;
}

export default function LoadCriteriaSetModal({
  teamId,
  onClose,
  onLoad
}: LoadCriteriaSetModalProps) {
  const [sets, setSets] = useState<CriteriaSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const fetchSets = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('criteria_sets')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setSets(data || []);
      } catch (err) {
        console.error('Error fetching criteria sets:', err);
        setError(err instanceof Error ? err.message : 'Failed to load criteria sets');
      } finally {
        setLoading(false);
      }
    };

    fetchSets();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this criteria set?')) return;

    setDeleting(id);
    try {
      const { error: deleteError } = await supabase
        .from('criteria_sets')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setSets(sets.filter(s => s.id !== id));
    } catch (err) {
      console.error('Error deleting criteria set:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete criteria set');
    } finally {
      setDeleting(null);
    }
  };

  const handleLoad = () => {
    if (!selectedSet) return;
    const set = sets.find(s => s.id === selectedSet);
    if (!set) return;
    onLoad(set.criteria);
    onClose();
  };

  const filteredSets = searchQuery
    ? sets.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sets;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={e => e.currentTarget === e.target && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Load Criteria Set</h2>
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
                placeholder="Search criteria sets..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Sets List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : filteredSets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No criteria sets found
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredSets.map(set => (
                <div
                  key={set.id}
                  onClick={() => setSelectedSet(set.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedSet === set.id
                      ? 'bg-indigo-50 border-indigo-200'
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{set.name}</h3>
                      {set.description && (
                        <p className="text-sm text-gray-500 mt-1">{set.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-gray-500">
                          {new Date(set.created_at).toLocaleDateString()}
                        </span>
                        {set.team_id && (
                          <span className="flex items-center gap-1 text-xs text-indigo-600">
                            <Users className="h-3 w-3" />
                            Team
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={e => handleDelete(set.id, e)}
                      disabled={deleting === set.id}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-full disabled:opacity-50"
                    >
                      {deleting === set.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </button>
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
              disabled={!selectedSet}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Load Selected Set
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}