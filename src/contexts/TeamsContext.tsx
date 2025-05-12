// src/contexts/TeamsContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode
} from 'react'
import { supabase } from '../lib/supabase'

// —————————————————————————————————————————————————————————————————————————————
// Types
// —————————————————————————————————————————————————————————————————————————————

export interface Team {
  id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: string
  joined_at: string
}

interface TeamsContextType {
  teams: Team[]
  loading: boolean
  error: string | null
  fetchTeams: () => Promise<void>
  createTeam: (name: string, description?: string) => Promise<Team | null>
  updateTeam: (id: string, updates: Partial<Team>) => Promise<Team | null>
  deleteTeam: (id: string) => Promise<void>
  getTeamMembers: (teamId: string) => Promise<TeamMember[]>
}

const TeamsContext = createContext<TeamsContextType | undefined>(undefined)

// —————————————————————————————————————————————————————————————————————————————
// Provider
// —————————————————————————————————————————————————————————————————————————————

export function TeamsProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams]     = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false })
      if (fetchError) throw fetchError
      setTeams(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch teams')
      console.error('Error fetching teams:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // auto‐fetch on mount
  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const createTeam = useCallback(
    async (name: string, description?: string): Promise<Team | null> => {
      try {
        const { data, error: createError } = await supabase
          .from('teams')
          .insert([{ name, description }])
          .select()
          .single()
        if (createError) throw createError
        if (!data) throw new Error('No data returned from create')
        setTeams(prev => [data, ...prev])
        return data
      } catch (err) {
        console.error('Error creating team:', err)
        return null
      }
    },
    []
  )

  const updateTeam = useCallback(
    async (id: string, updates: Partial<Team>): Promise<Team | null> => {
      try {
        const { data, error: updateError } = await supabase
          .from('teams')
          .update(updates)
          .eq('id', id)
          .select()
          .single()
        if (updateError) throw updateError
        if (!data) throw new Error('No data returned from update')
        setTeams(prev => prev.map(team => (team.id === id ? data : team)))
        return data
      } catch (err) {
        console.error('Error updating team:', err)
        return null
      }
    },
    []
  )

  const deleteTeam = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', id)
      if (deleteError) throw deleteError
      setTeams(prev => prev.filter(team => team.id !== id))
    } catch (err) {
      console.error('Error deleting team:', err)
    }
  }, [])

  const getTeamMembers = useCallback(
    async (teamId: string): Promise<TeamMember[]> => {
      try {
        const { data, error: membersError } = await supabase
          .from('team_members')
          .select('*')
          .eq('team_id', teamId)
        if (membersError) throw membersError
        return data || []
      } catch (err) {
        console.error('Error fetching team members:', err)
        return []
      }
    },
    []
  )

  return (
    <TeamsContext.Provider
      value={{
        teams,
        loading,
        error,
        fetchTeams,
        createTeam,
        updateTeam,
        deleteTeam,
        getTeamMembers
      }}
    >
      {children}
    </TeamsContext.Provider>
  )
}

// —————————————————————————————————————————————————————————————————————————————
// Hook
// —————————————————————————————————————————————————————————————————————————————

export function useTeams() {
  const context = useContext(TeamsContext)
  if (context === undefined) {
    throw new Error('useTeams must be used within a TeamsProvider')
  }
  return context
}