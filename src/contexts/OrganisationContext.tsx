import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, testSupabaseConnection } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Organisation } from '../types/organisations';
import { runSupabaseDiagnostics, displayDiagnostics } from '../lib/supabase-diagnostics';

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
      // Test Supabase connection first
      console.log('[OrganisationContext] Testing Supabase connection...');
      const connectionTest = await testSupabaseConnection();
        
      if (connectionTest.error) {
        console.error('[OrganisationContext] Connection test failed:', connectionTest.error);
        
        // Run diagnostics to help debug the issue
        console.log('[OrganisationContext] Running connection diagnostics...');
        try {
          const diagnostics = await runSupabaseDiagnostics();
          displayDiagnostics(diagnostics);
          
          // Show user-friendly error with specific CORS guidance
          if (!diagnostics.corsTest.corsAllowed) {
            throw new Error(`CORS Configuration Required
            
Your Supabase project needs to allow requests from this development server.

🔧 To fix this:
1. Open your Supabase Dashboard
2. Go to Project Settings → API
3. Under "CORS", add: ${window.location.origin}
4. Save changes and refresh this page

💡 For development, you can temporarily use "*" as the CORS origin.`);
          }
        } catch (diagError) {
          console.error('[OrganisationContext] Diagnostics failed:', diagError);
        }
        
        throw connectionTest.error;
      }
      
      console.log('[OrganisationContext] Connection test successful, fetching organisations...');
      
      // Use Promise.allSettled to handle partial failures gracefully
      const [ownedResult, memberResult] = await Promise.allSettled([
        supabase
          .from('organisations')
          .select('*')
          .eq('owner_id', user.id),
        supabase
          .from('organisation_members')
          .select(`
            role,
            organisations!inner (
              id,
              name,
              slug,
              description,
              owner_id,
              settings,
              created_at,
              updated_at
            )
          `)
          .eq('user_id', user.id)
      ]);
      
      let ownedOrgs: any[] = [];
      let memberOrgs: any[] = [];
      
      if (ownedResult.status === 'fulfilled' && !ownedResult.value.error) {
        ownedOrgs = ownedResult.value.data || [];
      } else {
        console.warn('Failed to fetch owned organisations:', 
          ownedResult.status === 'fulfilled' ? ownedResult.value.error : ownedResult.reason);
      }
      
      if (memberResult.status === 'fulfilled' && !memberResult.value.error) {
        memberOrgs = memberResult.value.data || [];
      } else {
        console.warn('Failed to fetch member organisations:', 
          memberResult.status === 'fulfilled' ? memberResult.value.error : memberResult.reason);
      }
      
      // Combine and format the results
      const formattedOwned = ownedOrgs.map(org => ({
        ...org,
        role: 'owner' as const,
        is_owner: true
      }));
      
      const formattedMember = memberOrgs.map(item => ({
        ...item.organisations,
        role: item.role,
        is_owner: false
      }));
      
      const allOrgs = [...formattedOwned, ...formattedMember];
      setOrganisations(allOrgs);
      
      // If no current organisation is set, set the first one
      if (!currentOrganisation && allOrgs.length > 0) {
        setCurrentOrganisation(allOrgs[0]);
      } else if (currentOrganisation) {
        // If current organisation is set, make sure it's still in the list
        const stillExists = allOrgs.some(org => org.id === currentOrganisation.id);
        if (!stillExists && allOrgs.length > 0) {
          setCurrentOrganisation(allOrgs[0]);
        } else if (!stillExists) {
          setCurrentOrganisation(null);
        } else {
          // Update the current organisation with fresh data
          const updatedOrg = allOrgs.find(org => org.id === currentOrganisation.id);
          if (updatedOrg) {
            setCurrentOrganisation(updatedOrg);
          }
        }
      }
      
      console.log('[OrganisationContext] Successfully fetched organisations:', allOrgs.length);
    } catch (err) {
      console.error('Error fetching organisations:', err);
      
      let errorMessage = 'Failed to load organisations.';
      
      if (err instanceof Error) {
        if (err.message.includes('CORS Configuration Required')) {
          // This is our formatted CORS error message
          errorMessage = err.message;
        } else if (err.message.includes('Connection test:')) {
          // This is already a formatted network error from our helper
          errorMessage = err.message;
        } else if (err.message.includes('Failed to fetch')) {
          errorMessage = `Connection Error: Unable to reach Supabase
          
This is likely a CORS (Cross-Origin Resource Sharing) issue.

🔧 To fix this:
1. Go to your Supabase Dashboard
2. Navigate to Project Settings → API  
3. Under "CORS", add: ${window.location.origin}
4. Save and refresh this page

💡 For development, you can temporarily use "*" as the CORS origin.`;
        } else {
          errorMessage = `${errorMessage} ${err.message}`;
        }
      }
      
      setError(errorMessage);
      
      // Set empty state gracefully on any error
      setOrganisations([]);
      setCurrentOrganisation(null);
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
        
      if (error) throw new Error(`Failed to create organisation: ${error.message}`);
      
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
        
      if (error) throw new Error(`Failed to update organisation: ${error.message}`);
      
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
        
      if (error) throw new Error(`Failed to delete organisation: ${error.message}`);
      
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