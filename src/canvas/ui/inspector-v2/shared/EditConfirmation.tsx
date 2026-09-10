/**
 * EditConfirmation — lightweight transient indicator beside a committed control.
 * Fades after 1.5s. No layout shift — absolute positioned near the control.
 *
 * ⚠⚠ WHAT IT MEASURES IS A LOCAL STORE MUTATION, AND THE DEFAULT COPY
 * OVERSTATES THAT. "Updated ✓" in success green is read as *saved*, and for
 * every caller that has a durable carrier the store write is only the first
 * half — the turn may still be in flight, deferred behind an in-flight lock,
 * or refused. That was harmless while the inspector was blanket-disabled and
 * no user could reach it; it stops being harmless the moment a pane unfences.
 *
 * `label`/`tone` exist so a caller whose commit is genuinely still in flight
 * can say so instead. Both default to the historic behaviour, so no existing
 * caller changes. A caller that CAN prove the server applied the value should
 * pass the success tone — nothing here can prove it on the caller's behalf.
 */

import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { typography } from '../../../../styles/typography'

interface EditConfirmationProps {
  /** Set to a truthy value (e.g. timestamp) to trigger the animation */
  trigger: number | null
  /** Visible text. Defaults to the historic "Updated". */
  label?: string
  /**
   * `success` shows the check in success green — reserve it for a commit that
   * has actually landed. `pending` is neutral and carries no tick, for a commit
   * that has been sent but not confirmed.
   */
  tone?: 'success' | 'pending'
  /**
   * ⚠⚠ HOLD THE NOTICE OPEN WHILE THE ANSWER IS STILL COMING.
   *
   * Measured on the deployed build: this component hid after 1500ms while a
   * `factor_value_edit` round trip takes ~1800ms (1756 / 1801 / 2019ms as a
   * guest on staging). So the outcome state added for the factor-value edit
   * was STRUCTURALLY UNOBSERVABLE — the notice always faded before the
   * dispatcher resolved, and the user never once saw "Sent to Olumi".
   *
   * A confirmation whose lifetime is shorter than the thing it confirms is not
   * a confirmation. While `hold` is true the timer does not run; when it clears
   * the terminal label gets its own full window.
   */
  hold?: boolean
}

export function EditConfirmation({ trigger, label = 'Updated', tone = 'success', hold = false }: EditConfirmationProps) {
  const [visible, setVisible] = useState(false)

  // ⚠ `label` IS A DEPENDENCY DELIBERATELY. A commit that changes state
  // (sending → sent) must restart the window, or the terminal answer inherits
  // whatever is left of the previous one and can flash for a few milliseconds.
  useEffect(() => {
    if (!trigger) return
    setVisible(true)
    if (hold) return
    const timer = setTimeout(() => setVisible(false), 1500)
    return () => clearTimeout(timer)
  }, [trigger, label, hold])

  if (!visible) return null

  return (
    <span
      className={`${typography.panelMeta} ${tone === 'success' ? 'text-success' : 'text-text-light'} inline-flex items-center gap-0.5 transition-opacity duration-500`}
      style={{ opacity: visible ? 1 : 0 }}
      aria-live="polite"
      data-tone={tone}
    >
      {label}{tone === 'success' && <> <Check className="h-3 w-3" aria-hidden="true" /></>}
    </span>
  )
}
