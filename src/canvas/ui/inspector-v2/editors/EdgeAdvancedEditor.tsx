/**
 * EdgeAdvancedEditor — structured technical detail for edges.
 * Groups: Effect parameters, Structural uncertainty, Metadata.
 * All edits flow through useEdgeMutations.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../../store'
import { EDGE_CONSTRAINTS } from '../../../domain/edges'
import { useEdgeMutations } from '../useInspectorMutations'
import { AdvancedField } from '../shared/AdvancedField'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'
import { AdvancedWarningPill } from '../shared/AdvancedWarningPill'

interface EdgeAdvancedEditorProps {
  edgeId: string
}

export function EdgeAdvancedEditor({ edgeId }: EdgeAdvancedEditorProps) {
  const edge = useCanvasStore(s => s.edges.find(e => e.id === edgeId))
  const mutations = useEdgeMutations(edgeId)

  const weight = edge?.data?.weight ?? 0.5
  const direction = edge?.data?.direction ?? 'positive'
  const signedMean = direction === 'negative' ? -weight : weight
  const std = edge?.data?.strengthStd ?? 0.15
  const existsProb = edge?.data?.beliefExists ?? EDGE_CONSTRAINTS.beliefExists.default
  const edgeLabel = (edge?.data as Record<string, unknown>)?.label as string | undefined
  const provenance = (edge?.data as Record<string, unknown>)?.provenance as string | undefined

  // CIL warnings from pipeline + provenance-derived defaults
  const cilWarnings = useMemo(() => {
    const warnings = [...((edge?.data as Record<string, unknown>)?.cil_warnings as string[] ?? [])]
    // Add STRENGTH_DEFAULT_APPLIED when edge uses default provenance
    if (!provenance || provenance === 'default' || provenance === 'brief_extraction') {
      if (!warnings.includes('STRENGTH_DEFAULT_APPLIED')) {
        warnings.push('STRENGTH_DEFAULT_APPLIED')
      }
    }
    return warnings
  }, [edge?.data, provenance])

  if (!edge) return null

  return (
    <div className="space-y-1">
      <AdvancedFieldGroup title="Effect parameters">
        <AdvancedField
          label="Effect coefficient (\u03B2)"
          value={Number(signedMean.toFixed(4))}
          onChange={v => mutations.setStrength(v as number)}
          type="number"
          min={-1}
          max={1}
          step={0.01}
          helperText="Signed causal effect size. Positive = same direction."
        />
        <AdvancedField
          label="Epistemic uncertainty (\u03C3)"
          value={Number(std.toFixed(4))}
          onChange={v => mutations.setStd(v as number)}
          type="number"
          min={0.01}
          max={0.5}
          step={0.01}
          helperText="Std dev of the effect estimate. Higher = less certain."
        />
        <AdvancedField
          label="Effect direction"
          value={direction}
          onChange={v => mutations.setDirection(v as 'positive' | 'negative')}
          type="select"
          options={[
            { value: 'positive', label: 'positive' },
            { value: 'negative', label: 'negative' },
          ]}
        />
      </AdvancedFieldGroup>

      <AdvancedFieldGroup title="Structural uncertainty">
        <AdvancedField
          label="Existence probability"
          value={Number(existsProb.toFixed(4))}
          onChange={v => mutations.setExistsProbability(v as number)}
          type="number"
          min={0.01}
          max={1}
          step={0.01}
          helperText="Bernoulli probability that this causal link exists."
        />
      </AdvancedFieldGroup>

      <AdvancedFieldGroup title="Metadata">
        <AdvancedField
          label="Edge key"
          value={`${edge.source}\u2192${edge.target}`}
          type="readonly"
        />
        <AdvancedField
          label="Relationship description"
          value={edgeLabel ?? ''}
          onChange={v => mutations.setLabel(v as string)}
          type="text"
          placeholder="Describe the causal mechanism"
        />
      </AdvancedFieldGroup>

      {cilWarnings.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {cilWarnings.map((w, i) => (
            <AdvancedWarningPill key={i} text={w} />
          ))}
        </div>
      )}
    </div>
  )
}
