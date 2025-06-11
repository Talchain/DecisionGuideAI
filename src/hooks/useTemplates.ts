import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { CriteriaTemplate } from '../types/templates';

export function useTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CriteriaTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async (scope: string = 'my') => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('criteria_templates')
        .select(`
          *,
          users:owner_id(email)
        `)
        .order('updated_at', { ascending: false });

      // Apply scope filters
      switch (scope) {
        case 'my':
          query = query.eq('owner_id', user.id);
          break;
        case 'team':
          query = query.eq('sharing', 'team');
          break;
        case 'organization':
          query = query.eq('sharing', 'organization');
          break;
        case 'featured':
          query = query.eq('featured', true);
          break;
        case 'marketplace':
          query = query.eq('sharing', 'public');
          break;
      }

      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      const processedTemplates = (data || []).map(template => ({
        ...template,
        owner_name: template.users?.email || 'Unknown'
      }));
      
      setTemplates(processedTemplates);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createTemplate = useCallback(async (templateData: Partial<CriteriaTemplate>) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      const { data, error } = await supabase
        .from('criteria_templates')
        .insert({
          ...templateData,
          owner_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Add to local state
      setTemplates(prev => [data, ...prev]);
      
      return data;
    } catch (err) {
      console.error('Error creating template:', err);
      throw err;
    }
  }, [user]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<CriteriaTemplate>) => {
    try {
      const { data, error } = await supabase
        .from('criteria_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update local state
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
      
      return data;
    } catch (err) {
      console.error('Error updating template:', err);
      throw err;
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('criteria_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Remove from local state
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Error deleting template:', err);
      throw err;
    }
  }, []);

  const shareTemplate = useCallback(async (id: string, sharing: string) => {
    try {
      const { data, error } = await supabase
        .from('criteria_templates')
        .update({
          sharing,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update local state
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, sharing } : t));
      
      return data;
    } catch (err) {
      console.error('Error sharing template:', err);
      throw err;
    }
  }, []);

  const forkTemplate = useCallback(async (id: string) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      // Get the original template
      const { data: original, error: fetchError } = await supabase
        .from('criteria_templates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Create a copy
      const { data, error } = await supabase
        .from('criteria_templates')
        .insert({
          name: `${original.name} (Copy)`,
          description: original.description,
          type: original.type,
          criteria: original.criteria,
          tags: original.tags,
          owner_id: user.id,
          sharing: 'private',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Add to local state
      setTemplates(prev => [data, ...prev]);
      
      return data;
    } catch (err) {
      console.error('Error forking template:', err);
      throw err;
    }
  }, [user]);

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    shareTemplate,
    forkTemplate
  };
}