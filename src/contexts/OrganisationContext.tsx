import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Organisation } from '../types/organisations';

interface OrganisationContextType {
  organisations: Organisation[];
  currentOrganisation: Organisation | null;
  loading: boolean;
  error: string | null;
  fetchOrganisations: () => Promise<void>;
  setCurrentOrganisation: (org: Organisation | null) => void;
  createOrganisation: (name: string, slug: string, description?: string) => Promise<Organisation | null>;
  updateOrganisation: (id: string, updates: Partial<Organisation>) => Promise<void>;
  deleteOrganisation: (id: string) => Promise<void>;
}

const OrganisationContext = createContext<OrganisationContextType | undefined>(undefined);

export function OrganisationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [currentOrganisation, setCurrentOrganisation] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganisations = useCallback(async () => {
    if (!user) {
      setOrganisations([]);
      setCurrentOrganisation(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.rpc('get_user_organisations');
      
      if (error) throw error;
      
      const orgs = data || [];
      setOrganisations(orgs);
      
      // If no current organisation is set, set the first one
      if (!currentOrganisation && orgs.length > 0) {
        setCurrentOrganisation(orgs[0]);
      } else if (currentOrganisation) {
        // If current organisation is set, make sure it's still in the list
        const stillExists = orgs.some(org => org.id === currentOrganisation.id);
        if (!stillExists && orgs.length > 0) {
          setCurrentOrganisation(orgs[0]);
        } else if (!stillExists) {
          setCurrentOrganisation(null);
        } else {
          // Update the current organisation with fresh data
          const updatedOrg = orgs.find(org => org.id === currentOrganisation.id);
          if (updatedOrg) {
            setCurrentOrganisation(updatedOrg);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching organisations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load organisations');
    } finally {
      setLoading(false);
    }
  }, [user, currentOrganisation]);

  // Fetch organisations on mount and when user changes
  useEffect(() => {
    fetchOrganisations();
  }, [user, fetchOrganisations]);

  const createOrganisation = async (name: string, slug: string, description?: string) => {
    if (!user) return null;
    
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('organisations')
        .insert({
          name,
          slug,
          description: description || null,
          owner_id: user.id,
          settings: {}
        })
        .select()
        .single();
        
      if (error) throw error;
      
      await fetchOrganisations();
      return data;
    } catch (err) {
      console.error('Error creating organisation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create organisation');
      return null;
    }
  };

  const updateOrganisation = async (id: string, updates: Partial<Organisation>) => {
    if (!user) return;
    
    setError(null);
    
    try {
      const { error } = await supabase
        .from('organisations')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
        
      if (error) throw error;
      
      await fetchOrganisations();
    } catch (err) {
      console.error('Error updating organisation:', err);
      setError(err instanceof Error ? err.message : 'Failed to update organisation');
      throw err;
    }
  };

  const deleteOrganisation = async (id: string) => {
    if (!user) return;
    
    setError(null);
    
    try {
      const { error } = await supabase
        .from('organisations')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      // If the deleted organisation was the current one, set current to null
      if (currentOrganisation?.id === id) {
        setCurrentOrganisation(null);
      }
      
      await fetchOrganisations();
    } catch (err) {
      console.error('Error deleting organisation:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete organisation');
      throw err;
    }
  };

  return (
    <OrganisationContext.Provider value={{
      organisations,
      currentOrganisation,
      loading,
      error,
      fetchOrganisations,
      setCurrentOrganisation,
      createOrganisation,
      updateOrganisation,
      deleteOrganisation
    }}>
      {children}
    </OrganisationContext.Provider>
  );
}

export function useOrganisation() {
  const context = useContext(OrganisationContext);
  if (!context) {
    throw new Error('useOrganisation must be used within an OrganisationProvider');
  }
  return context;
}