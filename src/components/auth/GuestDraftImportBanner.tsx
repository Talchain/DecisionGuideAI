/**
 * Guest-draft import banner — login UI half (3.4).
 *
 * One-time offer on the scenario hub (the post-login landing): a guest who
 * built a draft before signing in can save it to their account. Renders
 * nothing unless loginDraftImport says the offer is due (flag-gated dark).
 * DS v4: bg-panel card, semantic tokens, rounded-pill buttons, Lucide only.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUp, Loader2 } from 'lucide-react'

import { useAuth } from '../../contexts/AuthContext'
import { typography } from '../../styles/typography'
import {
  shouldOfferDraftImport,
  importGuestDraft,
  dismissDraftImport,
} from '../../lib/loginDraftImport'

export function GuestDraftImportBanner() {
  const { user, authenticated } = useAuth()
  const navigate = useNavigate()
  const [hidden, setHidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (hidden || !shouldOfferDraftImport(user, authenticated)) return null

  const handleSave = async () => {
    if (!user || saving) return
    setSaving(true)
    setError(null)
    try {
      const scenarioId = await importGuestDraft(user.id)
      navigate(`/scenario/${scenarioId}`)
    } catch {
      setError("Couldn't save your draft — please try again.")
      setSaving(false)
    }
  }

  const handleDismiss = () => {
    dismissDraftImport()
    setHidden(true)
  }

  return (
    <div
      className="mt-4 mb-4 flex items-start gap-3 rounded-md border border-panel-border bg-panel p-4"
      data-testid="guest-draft-import-banner"
    >
      <FileUp className="mt-0.5 h-5 w-5 flex-shrink-0 text-info" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={`${typography.label} text-text-header`}>
          Save your draft to your account
        </p>
        <p className={`${typography.bodySmall} mt-1 text-text-body`}>
          You built a draft before signing in. Save it to keep working on it —
          otherwise it stays only in this browser.
        </p>
        {error && (
          <p className={`${typography.bodySmall} mt-2 text-danger`} role="alert">
            {error}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`${typography.button} inline-flex items-center gap-1.5 px-4 py-1.5 rounded-pill bg-primary text-text-on-color hover:bg-primary-hover disabled:bg-primary-disabled disabled:cursor-not-allowed transition-colors duration-fast`}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Save draft
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={saving}
            className={`${typography.button} px-4 py-1.5 rounded-pill text-text-body hover:text-text-header disabled:cursor-not-allowed transition-colors duration-fast`}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
