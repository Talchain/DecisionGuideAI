/**
 * EdgeAdvancedEditor — structured technical detail for edges.
 * Groups: Effect parameters, Structural uncertainty, Metadata.
 * All edits flow through useEdgeMutations.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../../store'
import { EDGE_CONSTRAINTS } from '../../../domain/edges'
import { useEdgeMutations } from '../useInspectorMutations'
import { EDGE_COPY } from '../inspectorStrings'
import { AdvancedField } from '../shared/AdvancedField'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'
import { AdvancedWarningPill } from '../shared/AdvancedWarningPill'

/**
 * Which of `EdgePanel`'s three link classes this editor is rendering under.
 *
 * ⚠ SUPPLIED BY THE CALLER ON PURPOSE — this editor does NOT re-derive it.
 * `EdgePanel` already owns the derivation (`sourceKind`/`targetKind`, EdgePanel
 * .tsx:180-181) and uses it to choose which notice to render. Deriving it a
 * second time here would create a second semantic owner for one question, and
 * the two would drift (trap 21: two authorities answering what looks like the
 * same question, disagreeing on a reachable class, neither one wrong in
 * isolation). The prop is REQUIRED, not defaulted, so a future call site is a
 * type error rather than a silent `'causal'`.
 */
export type EdgeLinkKind = 'causal' | 'organisational' | 'intervention'

interface EdgeAdvancedEditorProps {
  edgeId: string
  linkKind: EdgeLinkKind
}

export function EdgeAdvancedEditor({ edgeId, linkKind }: EdgeAdvancedEditorProps) {
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
          label="Effect coefficient (β)"
          value={Number(signedMean.toFixed(4))}
          onChange={v => mutations.setStrength(v as number)}
          type="number"
          min={-1}
          max={1}
          step={0.01}
          helperText="Signed causal effect size. Positive = same direction."
        />
        {/* ⛔ DO NOT "FIX" THIS BY HIDING OR DISABLING THE FIELD ABOVE. The
            no-hiding ruling applies: the coefficient is real, it is stored, and
            a user is entitled to see and change it. What was wrong was the
            claim around it, so the claim is what changes. */}
        {linkKind === 'intervention' && (
          <p
            data-testid="edge-beta-inert-on-intervention"
            className="text-warning mt-0.5"
          >
            {EDGE_COPY.interventionStrengthInert}
          </p>
        )}
        <AdvancedField
          label="Epistemic uncertainty (σ)"
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
          value={`${edge.source}→${edge.target}`}
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
