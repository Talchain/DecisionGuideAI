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
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // grab your user ID
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')
      const userId = session.user.id

      // only select the columns we need
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('id,name,description,created_by,created_at,updated_at')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setTeams(data ?? [])
    } catch (err) {
      console.error('[TeamsContext] fetchTeams raw error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch teams')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const createTeam = useCallback(
    async (name: string, description?: string): Promise<Team> => {
      try {
        setError(null)
        setLoading(true)

        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session?.user) throw new Error('Not authenticated')
        const userId = session.user.id

        // insert into teams with created_by
        const { data, error: createError } = await supabase
          .from('teams')
          .insert([{ name, description, created_by: userId }])
          .select('id,name,description,created_by,created_at,updated_at')
          .single()

        if (createError) throw createError
        if (!data) throw new Error('No team returned')

        // add locally
        setTeams(prev => [data, ...prev])
        return data
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const deleteTeam = useCallback(async (id: string) => {
    try {
      setError(null)
      // delete by ID (our policies only allow your own)
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
  }, [])

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
  if (!ctx) {
    throw new Error('useTeams must be used within a TeamsProvider')
  }
  return ctx
}