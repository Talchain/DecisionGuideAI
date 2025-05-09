// src/contexts/DecisionContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'

export interface Option {
  label: string
  description: string
}

export interface DecisionContextType {
  decisionId: string | null
  decisionType: string | null
  decision: string | null
  importance: string | null
  reversibility: string | null
  goals: string[]
  options: Option[]
  setDecisionId: (id: string | null) => void
  setDecisionType: (type: string | null) => void
  setDecision: (text: string | null) => void
  setImportance: (importance: string | null) => void
  setReversibility: (reversibility: string | null) => void
  setGoals: (goals: string[]) => void
  setOptions: (options: Option[]) => void
  resetDecisionContext: () => void
}

const DecisionContext = createContext<DecisionContextType | undefined>(undefined)

const LOCAL_STORAGE_KEY = 'decisionContext'

// Synchronously load from localStorage to avoid any race on first render
function loadInitialState(): Partial<Record<keyof Omit<DecisionContextType, 'resetDecisionContext'>, any>> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (import.meta.env.DEV) {
        console.debug('[Context] 💾 Loaded initial state from localStorage:', parsed)
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

  const [decisionId, setDecisionId] = useState<string | null>(initial.decisionId ?? null)
  const [decisionType, setDecisionType] = useState<string | null>(initial.decisionType ?? null)
  const [decision, setDecision] = useState<string | null>(initial.decision ?? null)
  const [importance, setImportance] = useState<string | null>(initial.importance ?? null)
  const [reversibility, setReversibility] = useState<string | null>(initial.reversibility ?? null)
  const [goals, setGoals] = useState<string[]>(initial.goals ?? [])
  const [options, setOptions] = useState<Option[]>(initial.options ?? [])

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
        setDecisionId,
        setDecisionType,
        setDecision,
        setImportance,
        setReversibility,
        setGoals,
        setOptions,
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