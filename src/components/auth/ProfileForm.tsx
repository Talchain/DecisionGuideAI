// src/components/ProfileForm.tsx
import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { updateProfile } from '../../lib/supabase'
import { Save, User, Loader } from 'lucide-react'
import { authLogger } from '../../lib/auth/authLogger'

const AGE_BRACKETS = [ '18-24', '25-34', '35-44', '45-54', '55-64', '65+' ]
const GENDER_OPTIONS = [ 'Male','Female','Non-binary','Prefer not to say' ]

export default function ProfileForm() {
  const { user, profile, loading: authLoading } = useAuth()
  const navigateToLogin = () => {}  // not needed if you link directly

  const [formData, setFormData] = useState({
    first_name:    profile?.first_name    ?? '',
    last_name:     profile?.last_name     ?? '',
    phone_number:  profile?.phone_number  ?? '',
    address:       profile?.address       ?? '',
    age_bracket:   profile?.age_bracket   ?? '',
    gender:        profile?.gender        ?? '',
    contact_consent: profile?.contact_consent ?? false
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string|null>(null)
  const [success, setSuccess] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    return () => { mounted.current = false }
  }, [])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="animate-spin h-8 w-8 text-indigo-600" />
      </div>
    )
  }

  // After authLoading, if no user: truly expired
  if (!user) {
    return (
      <div className="flex items-center justify-center p-8 text-center">
        <p className="text-gray-600">
          Your session has expired. Please{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">
            sign in
          </Link>{' '}
          to continue.
        </p>
      </div>
    )
  }

  const handleChange = (e: React.ChangeEvent<any>) => {
    setError(null)
    setSuccess(false)
    const { name, value, type, checked } = e.target
    setFormData(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      authLogger.debug('PROFILE','Updating profile',{ userId: user.id })
      const { data, error: updateError } = await updateProfile(user.id, {
        ...formData,
        updated_at: new Date().toISOString()
      })
      if (updateError) {
        if (updateError.message.includes('JWT')) {
          setError('Your session has expired. Please sign in again.')
        } else {
          throw updateError
        }
      } else {
        setSuccess(true)
        setTimeout(() => mounted.current && setSuccess(false), 3000)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
      authLogger.error('PROFILE','Profile update failed',err)
    } finally {
      mounted.current && setLoading(false)
    }
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
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            Profile updated successfully!
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/** First Name **/}
          <div>
            <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
              First Name
            </label>
            <input
              name="first_name"
              id="first_name"
              value={formData.first_name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          {/** Last Name **/}
          <div>
            <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
              Last Name
            </label>
            <input
              name="last_name"
              id="last_name"
              value={formData.last_name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          {/** Phone **/}
          <div>
            <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              name="phone_number"
              id="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          {/** Age **/}
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
              {AGE_BRACKETS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {/** Gender **/}
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
              {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          {/** Address **/}
          <div className="md:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Address
            </label>
            <input
              name="address"
              id="address"
              value={formData.address}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          {/** Consent **/}
          <div className="md:col-span-2">
            <label className="flex items-start">
              <input
                type="checkbox"
                name="contact_consent"
                checked={formData.contact_consent}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="ml-3 text-sm text-gray-700">
                I agree to receive updates and notifications about my decisions and account.
              </span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading
              ? <Loader className="animate-spin h-4 w-4 mr-2" />
              : <Save className="h-4 w-4 mr-2" />
            }
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  )
}