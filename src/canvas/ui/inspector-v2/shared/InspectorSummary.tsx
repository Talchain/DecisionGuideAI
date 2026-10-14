import { typography } from '../../../../styles/typography'
import { ProvenanceChip, type ProvenanceKind } from './ProvenanceChip'

export function InspectorSummary({
  sentence,
  chip,
}: {
  sentence: string
  chip?: ProvenanceKind | null
}) {
  return (
    <div className="pt-3 space-y-1.5">
      <p data-testid="inspector-summary-sentence" className={`${typography.panelBody} text-text-body`}>
        {sentence}
      </p>
      <ProvenanceChip kind={chip} />
    </div>
  )
}
