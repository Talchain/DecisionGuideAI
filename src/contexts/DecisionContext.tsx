// src/contexts/DecisionContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
  useCallback
} from 'react'
import { 
  supabase, 
  saveDecisionGoals, 
  getDecisionGoals,
  saveDecisionOptions,
  getDecisionOptions,
  saveEvaluationMethod,
  getEvaluationMethod
} from '../lib/supabase'
import { withErrorHandling } from '../lib/errors'

export interface Criterion {
  id: string
  name: string
  weight: number
}

export interface Option {
  label: string
  description: string
}

export interface Collaborator {
  id: string
  user_id: string
  decision_id: string
  role: 'owner' | 'contributor' | 'viewer'
  status: 'invited' | 'active' | 'removed'
  email?: string
  invited_at: string
  joined_at?: string
}

export interface DecisionContextType {
  decisionId: string | null
  activeDecisionId: string | null
  decisionType: string | null
  decision: string | null
  importance: string | null
  reversibility: string | null
  goals: string[]
  options: Option[]
  collaborators: Collaborator[]
  evaluationMethod: string | null
  criteria: Criterion[]
  collaboratorsError: string | null
  teamIds: string[]
  // New methods for Supabase persistence
  saveGoalsToSupabase: (goals: string[]) => Promise<void>
  saveOptionsToSupabase: (options: Option[]) => Promise<void>
  saveEvaluationMethodToSupabase: (method: string) => Promise<void>
  loadDecisionData: (decisionId: string) => Promise<void>
  setDecisionId: (id: string | null) => void
  setActiveDecisionId: (id: string | null) => void
  setDecisionType: (type: string | null) => void
  setDecision: (text: string | null) => void
  setImportance: (importance: string | null) => void
  setReversibility: (reversibility: string | null) => void
  setGoals: (goals: string[]) => void
  setOptions: (options: Option[]) => void
  setCollaborators: (collaborators: Collaborator[]) => void
  setEvaluationMethod: (method: string | null) => void
  setCriteria: (criteria: Criterion[]) => void
  setTeamIds: (teamIds: string[]) => void
  resetDecisionContext: () => void
}

const DecisionContext = createContext<DecisionContextType | undefined>(
  undefined
)

const LOCAL_STORAGE_KEY = 'decisionContext'

// Synchronously load from localStorage to avoid any race on first render
function loadInitialState(): Partial<
  Record<keyof Omit<DecisionContextType, 'resetDecisionContext'>, any>
> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (import.meta.env.DEV) {
        console.debug(
          '[Context] 💾 Loaded initial state from localStorage:',
          parsed
        )
      }
      return parsed
    }
  } catch (err) {
    console.warn('[Context] ⚠️ Failed to parse localStorage state', err)
  }
  return {}
}

export const DecisionProvider = ({ children }: { children: ReactNode }) => {
  const initial = loadInitialState()

  const [decisionId, setDecisionId] = useState<string | null>(
    initial.decisionId ?? null
  )
  const [activeDecisionId, setActiveDecisionId] = useState<string | null>(
    initial.activeDecisionId ?? null
  )
  const [decisionType, setDecisionType] = useState<string | null>(
    initial.decisionType ?? null
  )
  const [decision, setDecision] = useState<string | null>(
    initial.decision ?? null
  )
  const [importance, setImportance] = useState<string | null>(
    initial.importance ?? null
  )
  const [reversibility, setReversibility] = useState<string | null>(
    initial.reversibility ?? null
  )
  const [goals, setGoals] = useState<string[]>(initial.goals ?? [])
  const [options, setOptions] = useState<Option[]>(initial.options ?? [])
  const [collaborators, setCollaborators] = useState<Collaborator[]>(
    initial.collaborators ?? []
  )
  const [evaluationMethod, setEvaluationMethod] = useState<string | null>(
    initial.evaluationMethod ?? null
  )
  const [criteria, setCriteria] = useState<Criterion[]>(initial.criteria ?? [])
  const [collaboratorsError, setCollaboratorsError] = useState<string | null>(null)
  const [teamIds, setTeamIds] = useState<string[]>(initial.teamIds ?? [])

  // Track subscriptions to clean up properly
  const subscriptionsRef = useRef<{[key: string]: any}>({})

  // New methods for Supabase persistence
  const saveGoalsToSupabase = useCallback(async (goalsToSave: string[]) => {
    if (!decisionId) {
      console.warn('[DecisionContext] Cannot save goals: no decision ID');
      return;
    }
    
    const { error } = await withErrorHandling(
      () => saveDecisionGoals(decisionId, goalsToSave),
      { decisionId, goalsCount: goalsToSave.length }
    );
    
    if (error) {
      console.error('[DecisionContext] Failed to save goals:', error);
      throw error;
    }
    
    console.log('[DecisionContext] Goals saved to Supabase successfully');
  }, [decisionId]);

  const saveOptionsToSupabase = useCallback(async (optionsToSave: Option[]) => {
    if (!decisionId) {
      console.warn('[DecisionContext] Cannot save options: no decision ID');
      return;
    }
    
    const { error } = await withErrorHandling(
      () => saveDecisionOptions(decisionId, optionsToSave),
      { decisionId, optionsCount: optionsToSave.length }
    );
    
    if (error) {
      console.error('[DecisionContext] Failed to save options:', error);
      throw error;
    }
    
    console.log('[DecisionContext] Options saved to Supabase successfully');
  }, [decisionId]);

  const saveEvaluationMethodToSupabase = useCallback(async (method: string) => {
    if (!decisionId) {
      console.warn('[DecisionContext] Cannot save evaluation method: no decision ID');
      return;
    }
    
    const { error } = await withErrorHandling(
      () => saveEvaluationMethod(decisionId, method),
      { decisionId, evaluationMethod: method }
    );
    
    if (error) {
      console.error('[DecisionContext] Failed to save evaluation method:', error);
      throw error;
    }
    
    console.log('[DecisionContext] Evaluation method saved to Supabase successfully');
  }, [decisionId]);

  const loadDecisionData = useCallback(async (loadDecisionId: string) => {
    console.log('[DecisionContext] Loading decision data from Supabase:', loadDecisionId);
    
    try {
      // Load goals
      const { data: goalsData, error: goalsError } = await withErrorHandling(
        () => getDecisionGoals(loadDecisionId),
        { decisionId: loadDecisionId }
      );
      
      if (goalsError) {
        console.warn('[DecisionContext] Failed to load goals:', goalsError);
      } else if (goalsData) {
        setGoals(goalsData);
      }
      
      // Load options
      const { data: optionsData, error: optionsError } = await withErrorHandling(
        () => getDecisionOptions(loadDecisionId),
        { decisionId: loadDecisionId }
      );
      
      if (optionsError) {
        console.warn('[DecisionContext] Failed to load options:', optionsError);
      } else if (optionsData) {
        setOptions(optionsData);
      }
      
      // Load evaluation method
      const { data: methodData, error: methodError } = await withErrorHandling(
        () => getEvaluationMethod(loadDecisionId),
        { decisionId: loadDecisionId }
      );
      
      if (methodError) {
        console.warn('[DecisionContext] Failed to load evaluation method:', methodError);
      } else if (methodData) {
        setEvaluationMethod(methodData);
      }
      
      console.log('[DecisionContext] Decision data loaded successfully');
    } catch (err) {
      console.error('[DecisionContext] Error loading decision data:', err);
    }
  }, []);
  // Subscribe to collaborator changes when decisionId changes
  useEffect(() => {
    if (!decisionId) return

    // Load decision data from Supabase when decisionId changes
    loadDecisionData(decisionId);
    // Initial fetch
    const fetchCollaborators = async () => {
      setCollaboratorsError(null)
      try {
        console.log(`Fetching collaborators for decision: ${decisionId}`)
        
        // First try the RPC function
        try {
          const { data, error } = await supabase.rpc(
            'get_decision_collaborators',
            {
              decision_id_param: decisionId,
            }
          )
          
          if (error) {
            console.warn(`RPC error fetching collaborators: ${error.message}`)
            throw error
          }
          
          console.log(`Collaborators fetched successfully: ${data?.length || 0} found`)
          setCollaborators(data || [])
          return
        } catch (rpcError) {
          console.error('RPC method failed, falling back to direct query:', rpcError)
        }
        
        // Fallback to direct query if RPC fails
        const { data: directData, error: directError } = await supabase
          .from('decision_collaborators')
          .select('*')
          .eq('decision_id', decisionId)
        
        if (directError) throw directError
        
        console.log(`Collaborators fetched via fallback: ${directData?.length || 0} found`)
        setCollaborators(directData || [])
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error(`Error fetching collaborators: ${errorMessage}`, err)
        setCollaboratorsError(errorMessage)
        // Keep existing collaborators if any
      }
    }

    fetchCollaborators()

    // Subscribe to changes
    let collaboratorsSubscription
    try {
      const subscription = supabase
        .channel(`decision_collaborators:${decisionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'decision_collaborators',
            filter: `decision_id=eq.${decisionId}`,
          },
          (payload) => {
            console.log('Collaborator change detected:', payload)
            fetchCollaborators()
          }
        )
        .subscribe((status) => {
          console.log(`Realtime subscription status: ${status}`)
        })
        
      // Store subscription reference for cleanup
      subscriptionsRef.current.collaborators = collaboratorsSubscription
    } catch (subError) {
      console.error('Failed to create realtime subscription:', subError)
    }

    // Subscribe to options changes
    try {
      const optionsSubscription = supabase
        .channel(`options:${decisionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'options',
            filter: `decision_id=eq.${decisionId}`,
          },
          (payload) => {
            console.log('Options change detected:', payload)
            // Update options in state when changes occur
            fetchOptions(decisionId)
          }
        )
        .subscribe()
        
      // Store subscription reference for cleanup
      subscriptionsRef.current.options = optionsSubscription
    } catch (subError) {
      console.error('Failed to create options subscription:', subError)
    }
    
    // Subscribe to criteria suggestions changes
    try {
      const suggestionsSubscription = supabase
        .channel(`criteria_suggestions:${decisionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'criteria_suggestions',
            filter: `decision_id=eq.${decisionId}`,
          },
          (payload) => {
            console.log('Criteria suggestion change detected:', payload)
            // Update criteria in state when changes occur
            fetchCriteria(decisionId)
          }
        )
        .subscribe()
        
      // Store subscription reference for cleanup
      subscriptionsRef.current.suggestions = suggestionsSubscription
    } catch (subError) {
      console.error('Failed to create criteria suggestions subscription:', subError)
    }

    return () => {
      // Clean up all subscriptions
      Object.entries(subscriptionsRef.current).forEach(([key, subscription]) => {
        try {
          if (subscription) {
            console.log(`Unsubscribing from ${key} channel`)
            subscription.unsubscribe()
            delete subscriptionsRef.current[key]
          }
        } catch (e) {
          console.warn(`Error unsubscribing from ${key} channel:`, e)
        }
      })
      
      // Reset subscriptions object
      subscriptionsRef.current = {}
    }
  }, [decisionId, loadDecisionData])

  // Helper function to fetch options
  const fetchOptions = useCallback(async (decisionId: string) => {
    try {
      const { data, error } = await withErrorHandling(
        () => getDecisionOptions(decisionId),
        { decisionId }
      );
      
      if (error) {
        console.error('Error fetching options:', error);
      } else if (data) {
        setOptions(data);
      }
    } catch (err) {
      console.error('Error fetching options:', err)
    }
  }, [])

  // Helper function to fetch criteria
  const fetchCriteria = useCallback(async (decisionId: string) => {
    try {
      const { data, error } = await supabase
        .from('decision_analysis')
        .select('criteria')
        .eq('decision_id', decisionId)
        .single()
        
      if (error && error.code !== 'PGRST116') throw error // PGRST116 is "no rows returned"
      
      if (data?.criteria) {
        setCriteria(data.criteria)
      }
    } catch (err) {
      console.error('Error fetching criteria:', err)
    }
  }, [])

  // Debounced localStorage persistence to avoid excessive writes
  const persistToLocalStorage = useCallback(() => {
    const state = {
      decisionId,
      activeDecisionId,
      decisionType,
      decision,
      importance,
      reversibility,
      goals,
      options,
      collaborators,
      evaluationMethod,
      criteria,
      collaboratorsError,
      teamIds
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state))
  }, [
    decisionId,
    activeDecisionId,
    decisionType,
    decision,
    importance,
    reversibility,
    goals,
    options,
    collaborators,
    evaluationMethod,
    criteria,
    collaboratorsError,
    teamIds
  ]);

  // Debounce localStorage updates
  useEffect(() => {
    const timeoutId = setTimeout(persistToLocalStorage, 500);
    return () => clearTimeout(timeoutId);
  }, [persistToLocalStorage]);

  // Clears everything for a brand-new decision
  const resetDecisionContext = () => {
    setDecisionId(null)
    setActiveDecisionId(null)
    setDecisionType(null)
    setDecision(null)
    setImportance(null)
    setReversibility(null)
    setGoals([])
    setOptions([])
    setEvaluationMethod(null)
    setCollaborators([])
    setCriteria([])
    setCollaboratorsError(null)
    setTeamIds([])
    
    // Clean up any active subscriptions
    Object.entries(subscriptionsRef.current).forEach(([key, subscription]) => {
      try {
        if (subscription) {
          console.log(`Unsubscribing from ${key} channel during reset`)
          subscription.unsubscribe()
        }
      } catch (e) {
        console.warn(`Error unsubscribing from ${key} channel during reset:`, e)
      }
    })
    
    // Reset subscriptions object
    subscriptionsRef.current = {}
    
    localStorage.removeItem(LOCAL_STORAGE_KEY)
  }

  return (
    <DecisionContext.Provider
      value={{
        decisionId,
        activeDecisionId,
        decisionType,
        decision,
        importance,
        reversibility,
        goals,
        options,
        evaluationMethod,
        collaborators,
        criteria,
        collaboratorsError,
        teamIds,
        saveGoalsToSupabase,
        saveOptionsToSupabase,
        saveEvaluationMethodToSupabase,
        loadDecisionData,
        setTeamIds,
        setDecisionId,
        setActiveDecisionId,
        setDecisionType,
        setDecision,
        setImportance,
        setReversibility,
        setGoals,
        setOptions,
        setEvaluationMethod,
        setCollaborators,
        setCriteria,
        resetDecisionContext,
      }}
    >
      {children}
    </DecisionContext.Provider>
  )
}

export const useDecision = (): DecisionContextType => {
  const ctx = useContext(DecisionContext)
  if (!ctx) {
    throw new Error('useDecision must be used within a DecisionProvider')
  }
  return ctx
}