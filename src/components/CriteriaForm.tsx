// src/components/CriteriaForm.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Trash2, Plus, AlertTriangle, ArrowRight } from 'lucide-react';
import { useDecision, Criterion as CtxCriterion } from '../contexts/DecisionContext';
import { supabase } from '../lib/supabase';

export default function CriteriaForm() {
  const navigate = useNavigate();
  const {
    decisionId,
    importance,
    reversibility,
    goals,
    criteria,
    setCriteria
  } = useDecision();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards
  if (!decisionId) return <Navigate to="/decision" replace />;
  if (!importance) return <Navigate to={`/decision/${decisionId}/importance`} replace />;
  if (!reversibility) return <Navigate to={`/decision/${decisionId}/reversibility`} replace />;
  if (!goals) return <Navigate to={`/decision/${decisionId}/goals`} replace />;

  // Load existing criteria or initialize default
  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('decision_analysis')
          .select('criteria')
          .eq('decision_id', decisionId)
          .single();
        if (error) throw error;
        if (Array.isArray(data?.criteria) && data.criteria.length > 0) {
          setCriteria(data.criteria);
        } else {
          const def = [{ id: crypto.randomUUID(), name: 'Overall impact', weight: 5 }];
          setCriteria(def);
          await supabase
            .from('decision_analysis')
            .upsert({ decision_id: decisionId, criteria: def }, { onConflict: 'decision_id' });
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load criteria');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [decisionId, setCriteria]);

  const save = async (next: CtxCriterion[]) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('decision_analysis')
        .upsert({ decision_id: decisionId, criteria: next }, { onConflict: 'decision_id' });
      if (error) throw error;
      setCriteria(next);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    const next = [...criteria, { id: crypto.randomUUID(), name: '', weight: 3 }];
    save(next);
  };
  const update = (id: string, upd: Partial<CtxCriterion>) => {
    const next = criteria.map(c => (c.id === id ? { ...c, ...upd } : c));
    save(next);
  };
  const remove = (id: string) => {
    const next = criteria.filter(c => c.id !== id);
    save(next);
  };

  const total = criteria.reduce((sum, c) => sum + c.weight, 0);
  const overweight = total > 15;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold">Define criteria and weights</h2>
      {error && (
        <div className="bg-red-50 p-3 rounded">
          <AlertTriangle className="inline-block mr-2 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}
      <div className="text-right mb-2">
        <span className={`px-2 py-1 rounded ${
          overweight ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
        }`}>
          Total: {total} / 15
        </span>
      </div>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th className="text-left">Criterion</th>
            <th className="text-left">Weight</th>
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody>
          {criteria.map(c => (
            <tr key={c.id}>
              <td className="py-1">
                <input
                  className="w-full px-2 py-1 border rounded"
                  value={c.name}
                  onChange={e => update(c.id, { name: e.target.value })}
                />
              </td>
              <td className="py-1">
                {[1,2,3,4,5].map(w => (
                  <button
                    key={w}
                    onClick={() => update(c.id, { weight: w })}
                    className={`px-2 py-1 mr-1 rounded ${
                      c.weight === w ? 'bg-indigo-200' : 'bg-gray-100'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </td>
              <td className="text-center">
                <button onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-600">
                  <Trash2 />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={add}
        disabled={criteria.length >= 10}
        className="mt-2 px-4 py-2 bg-white border rounded disabled:opacity-50"
      >
        <Plus className="inline-block mr-1" /> Add Criterion
      </button>

      <div className="flex justify-end mt-6">
        <button
          onClick={() => navigate('/decision/options')}
          disabled={saving || overweight || criteria.some(c => !c.name.trim())}
          className="px-6 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
        >
          {saving
            ? 'Saving…'
            : (
              <>
                Continue <ArrowRight className="inline-block ml-1" />
              </>
            )}
        </button>
      </div>
    </div>
  );
}