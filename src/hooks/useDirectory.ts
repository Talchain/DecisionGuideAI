import { useState, useCallback, useEffect } from 'react';
import { fetchUserDirectory } from '../lib/supabase';
import type { DirectoryUser } from '../types/directory';
import { useDebounce } from './useDebounce';

export function useDirectory() {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchDirectory = useCallback(async (search: string = '') => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await fetchUserDirectory(search);

      if (fetchError) throw fetchError;
      
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to fetch directory:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user directory');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch directory when search term changes
  useEffect(() => {
    fetchDirectory(debouncedSearchTerm);
  }, [debouncedSearchTerm, fetchDirectory]);

  return {
    users,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    fetchDirectory
  };
}