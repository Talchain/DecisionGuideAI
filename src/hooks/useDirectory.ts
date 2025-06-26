import { useState, useEffect, useCallback } from 'react';
import { fetchUserDirectory } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { DirectoryUser } from '../types/directory';

interface UseDirectoryOptions {
  organisationId?: string | null;
}

export function useDirectory(options: UseDirectoryOptions = {}) {
  const { user } = useAuth();
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { organisationId } = options;

  const fetchUsers = useCallback(async (search: string) => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await fetchUserDirectory(search, organisationId);
      
      if (fetchError) throw fetchError;
      
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching user directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [user, organisationId]);

  // Fetch users when search term changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(searchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm, fetchUsers]);

  return {
    users,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    refetch: fetchUsers
  };
}