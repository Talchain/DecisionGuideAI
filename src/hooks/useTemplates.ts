import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { CriteriaTemplate, TemplateFilter } from '../types/templates';

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
      let query = supabase
        .from('criteria_templates')
        .select('*');
      
      // Filter based on tab
      if (tab === 'my' && user) {
        query = query.eq('owner_id', user.id).order('updated_at', { ascending: false });
      } else if (tab === 'team') {
        query = query.eq('sharing', 'team').order('updated_at', { ascending: false });
      } else if (tab === 'organization') {
        query = query.eq('sharing', 'organization').order('updated_at', { ascending: false });
      } else if (tab === 'featured') {
        query = query.eq('featured', true).order('updated_at', { ascending: false });
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
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
    
    // Ensure owner_id is set
    const template = {
      ...templateData,
      owner_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: createError } = await supabase
        .from('criteria_templates')
        .insert([template])
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
    
    // Add updated timestamp
    const updatedTemplate = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: updateError } = await supabase
        .from('criteria_templates')
        .update(updatedTemplate)
        .eq('id', id)
        .eq('owner_id', user.id)
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
    
    if (!['private', 'team', 'organization', 'public'].includes(sharing)) {
      throw new Error('Invalid sharing level');
    }
    
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
      // Get the template to fork
      const { data: templateData, error: templateError } = await supabase
        .from('criteria_templates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (templateError) throw templateError;
      if (!templateData) throw new Error('Template not found');

      // Create a new template based on the original
      const newTemplate = {
        ...templateData,
        id: undefined,
        name: `Copy of ${templateData.name}`,
        owner_id: user.id,
        sharing: 'private',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('criteria_templates')
        .insert([newTemplate])
        .select()
        .single();
      
      if (error) throw error;
      
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