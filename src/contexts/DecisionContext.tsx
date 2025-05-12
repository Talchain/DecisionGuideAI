// src/contexts/DecisionContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
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
  const [teamIds, setTeamIds] = useState<string[]>(initial.teamIds ?? [])

  // Subscribe to collaborator changes when decisionId changes
  useEffect(() => {
    if (!decisionId) return

    // Initial fetch
    const fetchCollaborators = async () => {
      try {
        const { data, error } = await supabase.rpc(
          'get_decision_collaborators',
          {
            decision_id_param: decisionId,
          }
        )
        if (error) throw error
        setCollaborators(data || [])
      } catch (err) {
        console.error('Error fetching collaborators:', err)
      }
    }

    fetchCollaborators()

    // Subscribe to changes
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
          console.log('Collaborator change:', payload)
          fetchCollaborators()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
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
    setTeamIds([])
    localStorage.removeItem(LOCAL_STORAGE_KEY)
  }

  return (
    <DecisionContext.Provider
      value={{
        decisionId,
        decisionType,
        decision,
        importance,
        reversibility,
        goals,
        options,
        collaborators,
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