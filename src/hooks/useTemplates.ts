import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { CriteriaTemplate, TemplateFilter, TabId } from '../types/templates';

export function useTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CriteriaTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async (tab: TabId = 'my') => {
    if (!user && tab === 'my') return;
    
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('criteria_templates')
      let query = supabase
        .from('criteria_templates')
        .select('*');
      
      // Apply filters based on tab
      switch (tab) {
        case 'my':
          // For "My Templates" tab, get templates owned by the user
          if (user?.id) {
            query = query.eq('owner_id', user.id);
          } else {
            // If no user, return empty array
            setTemplates([]);
            setLoading(false);
            return;
          }
          break;
        case 'team':
          // For "Team" tab, get templates shared with teams
          query = query.eq('sharing', 'team');
          break;
        case 'organization':
          // For "Organization" tab, get templates shared with organization
          query = query.eq('sharing', 'organization');
          break;
        case 'featured':
          // For "Featured" tab, get featured templates
          query = query.eq('featured', true);
          break;
        case 'marketplace':
          query = query.eq('sharing', 'public');
          break;
        default:
          // Default to public templates
          query = query.eq('sharing', 'public');
      }
      
      // Order by updated_at
      query = query.order('updated_at', { ascending: false });
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
        console.error('Fetch error:', fetchError);
        // If the error is about missing columns, try fetching without filters
        if (fetchError.message?.includes('column') && fetchError.message?.includes('does not exist')) {
          const { data: fallbackData } = await supabase
            .from('criteria_templates')
            .select('*');
          
          setTemplates(fallbackData || []);
          setError('Some filters could not be applied due to missing columns');
        } else {
          throw fetchError;
        }
      } else {
        setTemplates(data || []);
      // Process templates to add owner name if available
      const processedTemplates = data?.map(template => ({
        ...template,
        owner_name: template.owner_id === user?.id ? 'You' : 'Other User'
      })) || [];
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createTemplate = useCallback(async (templateData: Partial<CriteriaTemplate>) => {
    if (!user?.id) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: createError } = await supabase
        .from('criteria_templates')
        .insert({
          ...templateData,
          owner_id: user.id,
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      setTemplates(prev => [data, ...prev]);
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
    if (!user?.id) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: updateError } = await supabase
        .from('criteria_templates')
        .update({
          ...updates,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      setTemplates(prev => prev.map(t => t.id === id ? data : t));
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
    if (!user?.id) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const { error: deleteError } = await supabase
        .from('criteria_templates')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
      
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Error deleting template:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete template');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const shareTemplate = useCallback(async (id: string, sharing: string) => {
    if (!user?.id) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: updateError } = await supabase
        .from('criteria_templates')
        .update({
          sharing,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      setTemplates(prev => prev.map(t => t.id === id ? data : t));
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
    if (!user?.id) throw new Error('User not authenticated');
    
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
      
      // Create a new template based on the forked one
      const { data: newTemplate, error: createError } = await supabase
        .rpc('fork_criteria_template', {
          template_id: id,
          new_owner_id: user.id,
          new_name: `${template.name} (Copy)`
        });
      
      if (createError) throw createError;
      
      setTemplates(prev => [newTemplate, ...prev]);
      return newTemplate;
    } catch (err) {
      console.error('Error forking template:', err);
      setError(err instanceof Error ? err.message : 'Failed to fork template');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initialize with public templates on mount
  useEffect(() => {
    fetchTemplates('featured');
  }, [fetchTemplates]);

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