import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { CriteriaTemplate } from '../types/templates';

export function useTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CriteriaTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async (tab: string = 'my') => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let query;
      
      switch (tab) {
        case 'my':
          query = supabase
            .from('criteria_templates')
            .select('*')
            .eq('owner_id', user.id)
            .order('updated_at', { ascending: false });
          break;
        case 'team':
          query = supabase
            .from('criteria_templates')
            .select('*')
            .eq('sharing', 'team')
            .order('updated_at', { ascending: false });
          break;
        case 'organization':
          query = supabase
            .from('criteria_templates')
            .select('*')
            .eq('sharing', 'organization')
            .order('updated_at', { ascending: false });
          break;
        case 'featured':
          query = supabase
            .from('criteria_templates')
            .select('*')
            .eq('featured', true)
            .order('updated_at', { ascending: false });
          break;
        default:
          query = supabase
            .from('criteria_templates')
            .select('*')
            .eq('owner_id', user.id)
            .order('updated_at', { ascending: false });
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      // Add owner information
      const templatesWithOwner = data?.map(template => ({
        ...template,
        owner_name: template.owner_id === user.id ? 'You' : 'Other User',
        sharing: template.sharing || 'private',
        owner_id: template.owner_id,
        tags: template.tags || [],
        featured: template.featured || false
      })) || [];
      
      setTemplates(templatesWithOwner);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createTemplate = useCallback(async (templateData: Partial<CriteriaTemplate>) => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: createError } = await supabase
        .from('criteria_templates')
        .insert({
          name: templateData.name || 'Untitled Template',
          description: templateData.description || null,
          type: templateData.type || 'other',
          criteria: templateData.criteria || [],
          sharing: templateData.sharing || 'private',
          owner_id: user.id,
          tags: templateData.tags || [],
          featured: templateData.featured || false
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      // Add the new template to the state
      setTemplates(prev => [
        {
          ...data,
          owner_name: 'You',
          owner_id: user.id
        },
        ...prev
      ]);
      
      return data;
    } catch (err) {
      console.error('Error creating template:', err);
      setError(err instanceof Error ? err.message : 'Failed to create template');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateTemplate = useCallback(async (id: string, updates: Partial<CriteriaTemplate>) => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: updateError } = await supabase
        .from('criteria_templates')
        .update({
          name: updates.name,
          description: updates.description,
          type: updates.type,
          criteria: updates.criteria,
          sharing: updates.sharing,
          tags: updates.tags,
          featured: updates.featured,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      // Update the template in the state
      setTemplates(prev => 
        prev.map(template => 
          template.id === id 
            ? { ...template, ...data, owner_name: 'You', owner_id: user.id } 
            : template
        )
      );
      
      return data;
    } catch (err) {
      console.error('Error updating template:', err);
      setError(err instanceof Error ? err.message : 'Failed to update template');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const deleteTemplate = useCallback(async (id: string) => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const { error: deleteError } = await supabase
        .from('criteria_templates')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
      
      // Remove the template from the state
      setTemplates(prev => prev.filter(template => template.id !== id));
    } catch (err) {
      console.error('Error deleting template:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete template');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const shareTemplate = useCallback(async (id: string, sharing: string) => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: shareError } = await supabase
        .from('criteria_templates')
        .update({ sharing, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (shareError) throw shareError;
      
      // Update the template in the state
      setTemplates(prev => 
        prev.map(template => 
          template.id === id 
            ? { ...template, sharing: data.sharing } 
            : template
        )
      );
      
      return data;
    } catch (err) {
      console.error('Error sharing template:', err);
      setError(err instanceof Error ? err.message : 'Failed to share template');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const forkTemplate = useCallback(async (id: string) => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      // First get the template to fork
      const { data: templateToFork, error: fetchError } = await supabase
        .from('criteria_templates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Create a new template based on the original
      const { data: newTemplate, error: createError } = await supabase
        .from('criteria_templates')
        .insert({
          name: `${templateToFork.name} (Copy)`,
          description: templateToFork.description,
          type: templateToFork.type,
          criteria: templateToFork.criteria,
          sharing: 'private', // Default to private for the fork
          owner_id: user.id,
          tags: templateToFork.tags || []
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      // Add the new template to the state
      setTemplates(prev => [
        {
          ...newTemplate,
          owner_name: 'You',
          owner_id: user.id
        },
        ...prev
      ]);
      
      return newTemplate;
    } catch (err) {
      console.error('Error forking template:', err);
      setError(err instanceof Error ? err.message : 'Failed to fork template');
      throw err;
    } finally {
      setLoading(false);
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