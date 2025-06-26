import { useState, useEffect, useCallback } from 'react';
import { fetchUserDirectory } from '../lib/supabase';
import type { DirectoryUser } from '../types/directory';

interface UseDirectoryOptions {
  initialSearchTerm?: string;
  organisationId?: string | null;
}

export function useDirectory({ initialSearchTerm = '', organisationId = null }: UseDirectoryOptions = {}) {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);

  const fetchUsers = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await fetchUserDirectory(term, organisationId);
      
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching user directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user directory');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [organisationId]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers(searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, fetchUsers]);

  return { users, loading, error, searchTerm, setSearchTerm };
}