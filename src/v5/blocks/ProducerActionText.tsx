/**
 * ProducerActionText — a producer `action_label` with NO command behind it,
 * rendered as what it is: a line of text, not a control.
 *
 * WHY THIS EXISTS (RC, programme-docs #63 5819467504). `review_card` and
 * `evidence` blocks carry `action_label` / `action_intent` but, by contract, no
 * `action_prompt` — only `coaching` does (@talchain/schemas, CoachingBlockSchema).
 * There is therefore nothing for a click to send. Both renderers drew the label
 * as a rounded, bordered pill in the exact grammar of a working chip, so on a Run
 * turn the top-level "Strengthen this evidence" looked like a button and did
 * nothing — a dead control. The ruling: render it as a working action or as plain
 * text, never as a chip-styled dead `<span>`. With no producer prompt the only
 * honest option is plain text.
 *
 * Verbatim producer copy; the intent rides only as a `data-*` attribute (a
 * machine token is never copy). The testid is the caller's, unchanged, so every
 * existing selector keeps binding to the same element.
 */
import type { ReactElement } from 'react'
import { typography } from '../../styles/typography'

export interface ProducerActionTextProps {
  /** Producer's `action_label`, rendered verbatim. */
  label: string
  /** Producer's `action_intent`, carried as data only. */
  intent?: string
  testId: string
}

export function ProducerActionText({ label, intent, testId }: ProducerActionTextProps): ReactElement {
  return (
    <p
      data-testid={testId}
      data-action-kind="text"
      {...(intent ? { 'data-action-intent': intent } : {})}
      className={`${typography.panelMeta} text-text-light`}
    >
      {label}
    </p>
  )
}

export default ProducerActionText
