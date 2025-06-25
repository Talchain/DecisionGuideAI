import { useState, useEffect, useCallback } from 'react';
import { fetchUserDirectory } from '../lib/supabase';
import type { DirectoryUser } from '../types/directory';

export function useDirectory() {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await fetchUserDirectory(search);
      if (fetchError) throw fetchError;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching user directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers(searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, fetchUsers]);

  return { users, loading, error, searchTerm, setSearchTerm };
}