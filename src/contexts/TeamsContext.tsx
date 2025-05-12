// src/contexts/TeamsContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'   // <-- pull in your auth

export interface Team {
  id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface TeamsContextType {
  teams: Team[]
  loading: boolean
  error: string | null
  fetchTeams: () => Promise<void>
  createTeam: (name: string, description?: string) => Promise<Team>
  deleteTeam: (id: string) => Promise<void>
}

const TeamsContext = createContext<TeamsContextType | undefined>(undefined)

export function TeamsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTeams = useCallback(async () => {
    if (!user) return                                      // wait for user
    try {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('id,name,description,created_by,created_at,updated_at')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
      if (fetchError) throw fetchError
      setTeams(data ?? [])
    } catch (err) {
      console.error('[TeamsContext] fetchTeams raw error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch teams')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && user) {
      fetchTeams()
    }
  }, [authLoading, user, fetchTeams])

  const createTeam = useCallback(
    async (name: string, description?: string): Promise<Team> => {
      if (!user) throw new Error('Not authenticated')
      setError(null)
      setLoading(true)
      try {
        const { data, error: createError } = await supabase
          .from('teams')
          .insert([{ name, description, created_by: user.id }])
          .select('id,name,description,created_by,created_at,updated_at')
          .single()
        if (createError) throw createError
        if (!data) throw new Error('No team returned')

        // (Optionally) auto-add the creator to team_members here…

        setTeams(prev => [data, ...prev])
        return data
      } finally {
        setLoading(false)
      }
    },
    [user]
  )

  const deleteTeam = useCallback(
    async (id: string) => {
      if (!user) return
      setError(null)
      try {
        const { error: deleteError } = await supabase
          .from('teams')
          .delete()
          .eq('id', id)
        if (deleteError) throw deleteError
        setTeams(prev => prev.filter(t => t.id !== id))
      } catch (err) {
        console.error('[TeamsContext] deleteTeam error:', err)
        setError(err instanceof Error ? err.message : 'Failed to delete')
      }
    },
    [user]
  )

  return (
    <TeamsContext.Provider
      value={{ teams, loading, error, fetchTeams, createTeam, deleteTeam }}
    >
      {children}
    </TeamsContext.Provider>
  )
}

export function useTeams() {
  const ctx = useContext(TeamsContext)
  if (!ctx) throw new Error('useTeams must be used within a TeamsProvider')
  return ctx
}