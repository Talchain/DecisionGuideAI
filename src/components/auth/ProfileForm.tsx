import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getUserId, updateProfile } from '../../lib/supabase';
import { Save, User, Loader } from 'lucide-react';
import { authLogger } from '../../lib/auth/authLogger';

const AGE_BRACKETS = [
  '18-24',
  '25-34',
  '35-44',
  '45-54',
  '55-64',
  '65+'
];

const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Non-binary',
  'Prefer not to say'
];

export default function ProfileForm() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [updateAttempted, setUpdateAttempted] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    address: '',
    age_bracket: '',
    gender: '',
    contact_consent: false
  });

  // Add mounted ref to prevent state updates after unmount
  const mounted = useRef(true);

  useEffect(() => {
    const initializeProfile = async () => {
      const id = await getUserId();
      if (id && mounted.current) {
        setUserId(id);
      }
    };
    initializeProfile();
  }, []);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear any existing states first
    setError(null);
    setSuccess(false);

    if (loading) {
      console.debug('Submit blocked - already loading');
      return;
    }

    if (!userId) {
      setLoading(false);
      setError('No authenticated user found');
      authLogger.error('ERROR', 'Profile update failed - no user', null);
      return;
    }

    setLoading(true);
    setUpdateAttempted(true);

    try {
      authLogger.debug('PROFILE', 'Profile update started', {
        userId,
        updatedFields: Object.keys(formData),
        timestamp: new Date().toISOString()
      });
      
      const { data, error: updateError } = await updateProfile(userId, {
        ...formData,
        updated_at: new Date().toISOString()
      });

      if (updateError) {
        setLoading(false);
        authLogger.error('ERROR', 'Profile update failed', updateError);
        if (updateError.message?.includes('JWT')) {
          setError('Your session has expired. Please sign in again.');
          return;
        }
        throw updateError;
      }

      // Only set success if we get here (no errors)
      setSuccess(true);
      
      if (mounted.current) {
        setLoading(false);
      }
      
      const successTimer = setTimeout(() => {
        if (mounted.current) {
          setSuccess(false);
        }
      }, 3000);
      
      authLogger.info('PROFILE', 'Profile updated successfully', {
        userId,
        updatedFields: Object.keys(formData),
        timestamp: new Date().toISOString()
      });

      // Clear success timer on unmount
      return () => clearTimeout(successTimer);
    } catch (err) {
      let errorMessage = 'Failed to update profile';
      
      if (err instanceof Error) {
        if (err.message.includes('network')) {
          errorMessage = 'Unable to connect. Please check your internet connection.';
        } else if (err.message.includes('timeout')) {
          errorMessage = 'The request timed out. Please try again.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      authLogger.error('ERROR', 'Profile update failed', err);
    } finally {
      // Only update states if component is still mounted
      if (mounted.current) { 
        setLoading(false);
        setUpdateAttempted(true);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    authLogger.debug('PROFILE', 'Form field changed', { 
      field: name, 
      type 
    });

    // Reset states when form is modified 
    setError(null);
    setSuccess(false);
    
    // Reset update attempted only if we're not currently loading
    if (updateAttempted && !loading) {
      setUpdateAttempted(false);
    }

    // Update form data
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  if (!userId) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-600">
            Your session has expired. Please <Link to="/login" className="text-indigo-600 hover:text-indigo-500">sign in</Link> to continue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <User className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900">Profile Information</h2>
            <p className="text-sm text-gray-500">Update your personal information</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative">
            Profile updated successfully!
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
              First Name
            </label>
            <input
              type="text"
              name="first_name"
              id="first_name"
              value={formData.first_name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
              Last Name
            </label>
            <input
              type="text"
              name="last_name"
              id="last_name"
              value={formData.last_name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone_number"
              id="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="age_bracket" className="block text-sm font-medium text-gray-700">
              Age Bracket
            </label>
            <select
              name="age_bracket"
              id="age_bracket"
              value={formData.age_bracket}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select age bracket</option>
              {AGE_BRACKETS.map(bracket => (
                <option key={bracket} value={bracket}>{bracket}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
              Gender
            </label>
            <select
              name="gender"
              id="gender"
              value={formData.gender}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select gender</option>
              {GENDER_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Address
            </label>
            <input
              type="text"
              name="address"
              id="address"
              value={formData.address}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <div className="relative flex items-start">
              <div className="flex h-5 items-center">
                <input
                  type="checkbox"
                  name="contact_consent"
                  id="contact_consent"
                  checked={formData.contact_consent}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="contact_consent" className="font-medium text-gray-700">
                  Contact Consent
                </label>
                <p className="text-gray-500">
                  I agree to receive updates and notifications about my decisions and account.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? (
              <>
                <Loader className="animate-spin h-4 w-4 mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}