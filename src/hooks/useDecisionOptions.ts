import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface Option {
  id: string;
  text: string;
  source: 'user' | 'ai';
  user_id: string;
  created_at: string;
  metadata: Record<string, any>;
}

interface UseDecisionOptionsProps {
  decisionId: string;
}

export function useDecisionOptions({ decisionId }: UseDecisionOptionsProps) {
  const { user } = useAuth();
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // Fetch initial options
  const fetchOptions = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('options')
        .select('*')
        .eq('decision_id', decisionId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setOptions(data || []);
    } catch (err) {
      console.error('Error fetching options:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch options');
    } finally {
      setLoading(false);
    }
  }, [decisionId]);

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase.channel(`options:${decisionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'options',
        filter: `decision_id=eq.${decisionId}`
      }, (payload: RealtimePostgresChangesPayload<Option>) => {
        if (!payload.new && !payload.old) return;

        setOptions(currentOptions => {
          switch (payload.eventType) {
            case 'INSERT':
              return [...currentOptions, payload.new as Option];
            
            case 'UPDATE':
              return currentOptions.map(opt => 
                opt.id === payload.new?.id ? payload.new as Option : opt
              );
            
            case 'DELETE':
              return currentOptions.filter(opt => opt.id !== payload.old?.id);
            
            default:
              return currentOptions;
          }
        });
      })
      .subscribe();

    // Fetch initial data
    fetchOptions();

    return () => {
      channel.unsubscribe();
    };
  }, [decisionId, fetchOptions]);

  // Add new option
  const addOption = useCallback(async (text: string, source: 'user' | 'ai' = 'user') => {
    if (!user) return null;
    
    try {
      const { data, error: insertError } = await supabase
        .from('options')
        .insert({
          decision_id: decisionId,
          user_id: user.id,
          text,
          source,
          metadata: {}
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return data;
    } catch (err) {
      console.error('Error adding option:', err);
      throw err;
    }
  }, [decisionId, user]);

  // Update option
  const updateOption = useCallback(async (id: string, updates: Partial<Option>) => {
    try {
      const { error: updateError } = await supabase
        .from('options')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;
    } catch (err) {
      console.error('Error updating option:', err);
      throw err;
    }
  }, []);

  // Delete option
  const deleteOption = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('options')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
    } catch (err) {
      console.error('Error deleting option:', err);
      throw err;
    }
  }, []);

  // Merge options
  const mergeOptions = useCallback(async (optionIds: string[], newText: string) => {
    if (!user || optionIds.length < 2) return;

    try {
      // Start a transaction
      const { error: txError } = await supabase.rpc('merge_options', {
        p_option_ids: optionIds,
        p_new_text: newText,
        p_user_id: user.id,
        p_decision_id: decisionId
      });

      if (txError) throw txError;
    } catch (err) {
      console.error('Error merging options:', err);
      throw err;
    }
  }, [decisionId, user]);

  // Handle typing indicators
  const setUserTyping = useCallback((userId: string, isTyping: boolean) => {
    setTypingUsers(prev => {
      const next = new Set(prev);
      if (isTyping) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
  }, []);

  return {
    options,
    loading,
    error,
    typingUsers,
    addOption,
    updateOption,
    deleteOption,
    mergeOptions,
    setUserTyping,
    refresh: fetchOptions
  };
}