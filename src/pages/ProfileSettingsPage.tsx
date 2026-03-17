/**
 * Profile Settings Page — display name, email, research consent, account deletion.
 *
 * Route: /profile
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { typography } from '../styles/typography'
import { UserAvatarMenu } from '../components/layout/UserAvatarMenu'

type FeedbackState = { type: 'success' | 'error'; message: string } | null

export default function ProfileSettingsPage() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [researchConsent, setResearchConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Populate form from profile
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setResearchConsent(profile.research_consent ?? false)
    }
  }, [profile])

  const handleSave = useCallback(async () => {
    if (!user) return
    setSaving(true)
    setFeedback(null)

    const { error } = await supabase
      .from('user_profiles')
      .update({
        display_name: displayName.trim() || null,
        research_consent: researchConsent,
      })
      .eq('id', user.id)

    setSaving(false)
    if (error) {
      setFeedback({ type: 'error', message: 'Failed to save. Please try again.' })
    } else {
      setFeedback({ type: 'success', message: 'Settings saved.' })
    }
  }, [user, displayName, researchConsent])

  const handleDeleteAccount = useCallback(async () => {
    if (!user) return
    setDeleting(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        setFeedback({ type: 'error', message: 'Session expired. Please sign in again.' })
        setDeleting(false)
        return
      }

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Deletion failed')
      }

      // Reset UI state before navigation to avoid stuck spinner
      setDeleting(false)
      setShowDeleteModal(false)
      await signOut()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Account deletion failed.' })
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }, [user, signOut])

  const email = user?.email ?? ''
  const deleteEnabled = deleteConfirmText === 'DELETE'

  // Check if Edge Function is likely deployed
  const edgeFunctionAvailable = !!import.meta.env.VITE_SUPABASE_URL

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-panel border-b border-[rgba(38,38,38,0.08)]">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-text-body hover:text-text-header transition-colors duration-fast"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className={typography.bodySmall}>Back</span>
        </button>
        <UserAvatarMenu />
      </header>

      {/* Content */}
      <main className="mx-auto max-w-[520px] px-4 py-10">
        <h1 className={`${typography.h3} text-text-header mb-8`}>Profile settings</h1>

        {/* Feedback banner */}
        {feedback && (
          <div
            className={`mb-6 rounded-lg px-4 py-3 ${typography.bodySmall} ${
              feedback.type === 'success'
                ? 'bg-panel text-success'
                : 'bg-panel text-danger'
            }`}
          >
            {feedback.message}
          </div>
        )}

        {/* Display name */}
        <div className="mb-6">
          <label htmlFor="display-name" className={`${typography.label} text-text-header block mb-1.5`}>
            Display name
          </label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name"
            className={`w-full rounded-lg border border-[rgba(38,38,38,0.12)] bg-panel px-3 py-2 ${typography.body} text-text-body placeholder:text-text-light focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow duration-fast`}
          />
        </div>

        {/* Email (read-only) */}
        <div className="mb-6">
          <label htmlFor="email" className={`${typography.label} text-text-header block mb-1.5`}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            readOnly
            className={`w-full rounded-lg border border-[rgba(38,38,38,0.12)] bg-canvas px-3 py-2 ${typography.body} text-text-light cursor-not-allowed`}
          />
        </div>

        {/* Research consent */}
        <div className="mb-8 flex items-start gap-3">
          <input
            id="research-consent"
            type="checkbox"
            checked={researchConsent}
            onChange={e => setResearchConsent(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[rgba(38,38,38,0.12)] text-primary focus:ring-primary/40"
          />
          <label htmlFor="research-consent" className={`${typography.bodySmall} text-text-body`}>
            I consent to anonymised usage data being used for research purposes.
          </label>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`inline-flex items-center gap-2 rounded-pill bg-primary px-5 py-2.5 ${typography.button} text-text-on-color transition-transform duration-fast hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50`}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save changes'}
        </button>

        {/* Danger zone */}
        <div className="mt-16 border-t border-[rgba(38,38,38,0.08)] pt-8">
          <h2 className={`${typography.h4} text-danger mb-2`}>Danger zone</h2>
          <p className={`${typography.bodySmall} text-text-light mb-4`}>
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          {edgeFunctionAvailable ? (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className={`inline-flex items-center gap-2 rounded-pill border border-danger/30 bg-panel px-5 py-2.5 ${typography.button} text-text-body transition-colors duration-fast hover:bg-danger hover:text-text-on-color`}
            >
              <Trash2 className="h-4 w-4" />
              Delete account
            </button>
          ) : (
            <p className={`${typography.bodySmall} text-text-light italic`}>
              Account deletion will be available soon.
            </p>
          )}
        </div>
      </main>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-[400px] mx-4 rounded-[20px] bg-panel p-6 shadow-2">
            <h3 className={`${typography.h4} text-text-header mb-2`}>Delete your account?</h3>
            <p className={`${typography.bodySmall} text-text-body mb-4`}>
              This will permanently delete your account, all scenarios, and associated data.
              Type <strong className="text-danger">DELETE</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className={`w-full rounded-lg border border-danger/30 bg-canvas px-3 py-2 ${typography.body} text-text-body placeholder:text-text-light focus:outline-none focus:ring-2 focus:ring-danger/40 mb-4`}
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText('') }}
                className={`rounded-pill px-4 py-2 ${typography.button} text-text-body hover:bg-panel-hover transition-colors duration-fast`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={!deleteEnabled || deleting}
                className={`inline-flex items-center gap-2 rounded-pill bg-danger px-4 py-2 ${typography.button} text-text-on-color disabled:opacity-50 transition-transform duration-fast hover:scale-[1.02] active:scale-[0.98]`}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
