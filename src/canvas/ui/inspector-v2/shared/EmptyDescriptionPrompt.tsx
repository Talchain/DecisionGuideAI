/**
 * EmptyDescriptionPrompt — unified empty state for description-less nodes.
 *
 * Outcome and Risk panels currently render nothing when a node has no
 * description; Option/Decision/Goal render editable textareas with
 * placeholders. This primitive standardises the empty case into a single
 * read-only prompt that can optionally open an editor on click.
 *
 * ⭐ v3.1 (DESIGN-GAP-v31 row 32): "italic placeholders must not read as
 * content". The served inspector opened every pane's Context with an italic
 * question ("What is this factor and why does it matter?") that read as the
 * element's own text — and it sat INSIDE a `<fieldset disabled>` on every
 * router-mounted pane that passes `onStartEditing`, where a `role="button"`
 * div is NOT inerted by the fieldset: a click opened a textarea that was then
 * disabled. A control that cannot save looked editable.
 *
 * So there are two states now, neither italic:
 *  · CANNOT OPEN A WRITER (no `onStartEditing`, or inside a disabled
 *    fieldset): the clearly-empty statement `INSPECTOR_DESCRIPTION_EMPTY`,
 *    plain muted text, no role, no tab stop.
 *  · CAN (an editor would actually be live): the prompt, as an action.
 *
 * The fence is read from the DOM (`closest('fieldset[disabled]')`) before
 * paint, so the component asks the ONE authority the browser itself applies
 * rather than taking a second prop that could disagree with it.
 */

import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { typography } from '../../../../styles/typography'
import { INSPECTOR_DESCRIPTION_EMPTY } from '../inspectorStrings'

interface EmptyDescriptionPromptProps {
  placeholder: string
  onStartEditing?: () => void
}

export function EmptyDescriptionPrompt({
  placeholder,
  onStartEditing,
}: EmptyDescriptionPromptProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [fenced, setFenced] = useState(false)
  // Re-read on every new `onStartEditing` (callers pass an inline arrow, so
  // this re-runs on each parent render — which is when a fieldset's `disabled`
  // could change). The functional update bails out when nothing changed.
  useLayoutEffect(() => {
    const isFenced = ref.current?.closest('fieldset[disabled]') != null
    setFenced(prev => (prev === isFenced ? prev : isFenced))
  }, [onStartEditing])

  const interactive = typeof onStartEditing === 'function' && !fenced

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!interactive) return
    e.preventDefault()
    onStartEditing?.()
  }

  if (!interactive) {
    return (
      <div
        ref={ref}
        data-testid="inspector-description-empty"
        className={`${typography.panelBody} text-text-light mt-1`}
      >
        {INSPECTOR_DESCRIPTION_EMPTY}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      role="button"
      aria-label={placeholder}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onStartEditing?.()
        }
      }}
      className={`${typography.panelBody} text-text-light mt-1 cursor-pointer hover:text-info hover:underline underline-offset-2 transition-colors`}
    >
      {placeholder}
    </div>
  )
}
