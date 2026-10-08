import type { ReactNode } from 'react'
import { typography } from '../../../../styles/typography'
import { InspectorSummary } from '../shared/InspectorSummary'
import type { ProvenanceKind } from '../shared/ProvenanceChip'

/** Translate the existing source words; unknown or named sources stay explicit in More. */
function factorSummaryChip(sourceLabel: string): ProvenanceKind | null {
  switch (sourceLabel) {
    case 'From your brief': return 'brief'
    case 'Estimated by Olumi': return 'olumi'
    case 'Set by you':
    case 'Confirmed by you':
    case 'Your assumption': return 'user'
    default: return null
  }
}

export function FactorAnatomySummary({
  label,
  displayText,
  hasStoredValue,
  sourceLabel,
  pending = false,
  summaryContext,
}: {
  label: string
  displayText: string | null
  hasStoredValue: boolean
  sourceLabel: string
  pending?: boolean
  summaryContext?: ReactNode
}) {
  return (
    <>
      <InspectorSummary
        sentence={displayText
          // A figure reads as a sentence ("Pro plan price is £49 …"); a word value
          // ("Not in use", a binary state) would read as "X is Not in use", so it
          // is stated as a label/value pair instead.
          ? (/^[\d£$€+\-−.~<>≈]/.test(displayText) ? `${label} is ${displayText}.` : `${label}: ${displayText}.`)
          : hasStoredValue
            ? `${label} has a value, but no unit is recorded for it.`
            : `${label} has no value yet.`}
        chip={displayText && !pending ? factorSummaryChip(sourceLabel) : null}
      />
      {summaryContext}
      {pending && (
        <p role="status" className={`${typography.panelMeta} text-text-light mt-1`}>
          Your edit — not saved to the model yet
        </p>
      )}
    </>
  )
}
