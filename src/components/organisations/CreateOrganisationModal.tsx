import React, { useState } from 'react';
import { X, Building, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CreateOrganisationModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateOrganisationModal({ onClose, onCreated }: CreateOrganisationModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  const generateSlug = (input: string) => {
    return input
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    
    // Auto-generate slug if user hasn't manually edited it
    if (!slug || slug === generateSlug(name)) {
      const newSlug = generateSlug(newName);
      setSlug(newSlug);
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSlug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(newSlug);
    setSlugError(null);
  };

  const validateSlug = async () => {
    if (!slug) {
      setSlugError('Slug is required');
      return false;
    }
    
    try {
      const { data, error } = await supabase.rpc('check_organisation_slug_exists', { 
        p_slug: slug 
      });
        
      if (error) throw error;
      
      if (data) {
        setSlugError('This slug is already taken');
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Error validating slug:', err);
      setSlugError('Error checking slug availability');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to create an organisation');
      return;
    }
    
    if (!name.trim()) {
      setError('Organisation name is required');
      return;
    }
    
    const isSlugValid = await validateSlug();
    if (!isSlugValid) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('organisations')
        .insert({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          owner_id: user.id,
          settings: {}
        })
        .select()
        .single();
        
      if (error) throw error;
      
      onCreated();
    } catch (err) {
      console.error('Error creating organisation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create organisation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">Create Organisation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              olumi.ai/org/
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={handleNameChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter organisation name"
              required
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
              URL Slug *
            </label>
            <div className="flex items-center">
              <span className="text-gray-500 bg-gray-100 px-3 py-2 rounded-l-lg border border-r-0 border-gray-300">
                decisionguide.ai/org/
              </span>
              <input
                type="text"
                id="slug"
                value={slug}
                onChange={handleSlugChange}
                className={`flex-1 px-3 py-2 border rounded-r-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  slugError ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="your-org-name"
                required
              />
            </div>
            {slugError && (
              <p className="mt-1 text-sm text-red-600">{slugError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              This will be used in URLs and cannot be changed later.
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter organisation description"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !slug.trim()}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Creating...
                </>
              ) : (
                'Create Organisation'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}