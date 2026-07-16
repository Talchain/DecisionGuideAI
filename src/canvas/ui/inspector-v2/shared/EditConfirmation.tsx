/**
 * EditConfirmation — lightweight "Updated" + Lucide check indicator (no text-glyph icons).
 * Appears on successful store mutation, fades after 1.5s.
 * No layout shift — absolute positioned near the control.
 */

import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { typography } from '../../../../styles/typography'

interface EditConfirmationProps {
  /** Set to a truthy value (e.g. timestamp) to trigger the animation */
  trigger: number | null
}

export function EditConfirmation({ trigger }: EditConfirmationProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!trigger) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 1500)
    return () => clearTimeout(timer)
  }, [trigger])

  if (!visible) return null

  return (
    <span
      className={`${typography.panelMeta} text-success inline-flex items-center gap-0.5 transition-opacity duration-500`}
      style={{ opacity: visible ? 1 : 0 }}
      aria-live="polite"
    >
      Updated <Check className="h-3 w-3" aria-hidden="true" />
    </span>
  )
}
