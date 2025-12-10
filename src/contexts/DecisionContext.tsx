// src/contexts/DecisionContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'

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
  decisionType: string | null
  decision: string | null
  importance: string | null
  reversibility: string | null
  goals: string[]
  options: Option[]
  collaborators: Collaborator[]
  collaboratorsError: string | null
  teamIds: string[]
  setDecisionId: (id: string | null) => void
  setDecisionType: (type: string | null) => void
  setDecision: (text: string | null) => void
  setImportance: (importance: string | null) => void
  setReversibility: (reversibility: string | null) => void
  setGoals: (goals: string[]) => void
  setOptions: (options: Option[]) => void
  setCollaborators: (collaborators: Collaborator[]) => void
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
  const [collaboratorsError, setCollaboratorsError] = useState<string | null>(null)
  const [teamIds, setTeamIds] = useState<string[]>(initial.teamIds ?? [])

  // Subscribe to collaborator changes when decisionId changes
  useEffect(() => {
    if (!decisionId) return

    // Initial fetch
    const fetchCollaborators = async () => {
      setCollaboratorsError(null)
      try {
        
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
    let subscription
    try {
      subscription = supabase
        .channel(`decision_collaborators:${decisionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'decision_collaborators',
            filter: `decision_id=eq.${decisionId}`,
          },
          () => {
            fetchCollaborators()
          }
        )
        .subscribe()
    } catch (subError) {
      console.error('Failed to create realtime subscription:', subError)
    }

    return () => {
      if (subscription) {
        try {
          subscription.unsubscribe()
        } catch (e) {
          console.warn('Error unsubscribing from channel:', e)
        }
      }
    }
  }, [decisionId])

  // Persist on *every* change to keep LS in sync
  useEffect(() => {
    const state = {
      decisionId,
      decisionType,
      decision,
      importance,
      reversibility,
      goals,
      options,
      collaborators,
      collaboratorsError,
      teamIds
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state))
  }, [
    decisionId,
    decisionType,
    decision,
    importance,
    reversibility,
    goals,
    options,
    collaborators,
    collaboratorsError,
    teamIds
  ])

  // Clears everything for a brand-new decision
  const resetDecisionContext = () => {
    setDecisionId(null)
    setDecisionType(null)
    setDecision(null)
    setImportance(null)
    setReversibility(null)
    setGoals([])
    setOptions([])
    setCollaborators([])
    setCollaboratorsError(null)
    setTeamIds([])
    localStorage.removeItem(LOCAL_STORAGE_KEY)
  }

  // React #185 FIX: Memoize context value to prevent re-renders when values haven't changed
  // Without this, a new object is created on every render, causing all consumers to re-render
  const contextValue = useMemo(() => ({
    decisionId,
    decisionType,
    decision,
    importance,
    reversibility,
    goals,
    options,
    collaborators,
    collaboratorsError,
    teamIds,
    setTeamIds,
    setDecisionId,
    setDecisionType,
    setDecision,
    setImportance,
    setReversibility,
    setGoals,
    setOptions,
    setCollaborators,
    resetDecisionContext,
  }), [
    decisionId,
    decisionType,
    decision,
    importance,
    reversibility,
    goals,
    options,
    collaborators,
    collaboratorsError,
    teamIds,
    // Note: setters are stable (useState returns stable setters), but resetDecisionContext
    // references them so we include it for completeness
  ])

  return (
    <DecisionContext.Provider value={contextValue}>
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