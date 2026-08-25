import { describe, expect, it } from 'vitest'

import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
  type MutationAuthority,
} from '../mutationAuthority'
import {
  EDGE_SETTER_AUTHORITY,
  EDGE_SETTER_FIELDS,
  NODE_SETTER_AUTHORITY,
  NODE_SETTER_FIELDS,
} from '../../ui/inspector-v2/useInspectorMutations'

/**
 * Frozen, independently-written audit contract from Brief B3. This is
 * intentionally not generated from CANONICAL_EDIT_AUTHORITY: adding a new
 * product control must first state where it mounts and what evidence could
 * make it authoritative, then make the implementation manifest agree.
 */
const EXPECTED_MOUNTED_AUTHORITY = {
  modelFactorValue: {
    authority: 'server_graph',
    entrySurfaces: ['Model factor row'],
    requiredEvidence: 'accepted factor_value_edit plus GraphV3 readback',
  },
  structuralDeleteWithServerHash: {
    authority: 'server_graph',
    entrySurfaces: ['canvas pointer', 'canvas keyboard', 'canvas change events'],
    requiredEvidence: 'accepted structural_delete with matching server graph hash',
  },
  priorRangeJudgement: {
    authority: 'disabled',
    entrySurfaces: ['Inspector prior range'],
    requiredEvidence: 'blanket Inspector fieldset disables the control; no pointer or keyboard affordance executes',
  },
  canvasSelectionAndLayout: {
    authority: 'local_presentation',
    entrySurfaces: ['canvas selection', 'canvas layout'],
    requiredEvidence: 'copy makes no shared-model or analysis claim',
  },
  modelOptionIntervention: {
    authority: 'disabled',
    entrySurfaces: ['Model option detail'],
    requiredEvidence: 'no pointer or keyboard control mounts',
  },
  modelFactorConfirmation: {
    authority: 'disabled',
    entrySurfaces: ['Model factor row'],
    requiredEvidence: 'no pointer or keyboard control mounts',
  },
  postRunFactorValue: {
    authority: 'disabled',
    entrySurfaces: ['post-run triage card'],
    requiredEvidence: 'no edit control mounts',
  },
  postRunFactorConfirmation: {
    authority: 'disabled',
    entrySurfaces: ['post-run triage card'],
    requiredEvidence: 'no confirmation control mounts',
  },
  postRunAutoFix: {
    authority: 'disabled',
    entrySurfaces: ['post-run engine critique Validation panel'],
    requiredEvidence: 'critique remains visible while local Fix automatically control does not mount',
  },
  preAnalysisFactorValue: {
    authority: 'disabled',
    entrySurfaces: ['pre-analysis improvement card'],
    requiredEvidence: 'no edit control mounts',
  },
  preAnalysisFactorConfirmation: {
    authority: 'disabled',
    entrySurfaces: ['pre-analysis improvement card'],
    requiredEvidence: 'no confirmation control mounts',
  },
  preAnalysisEdgeStrength: {
    authority: 'disabled',
    entrySurfaces: ['pre-analysis improvement card'],
    requiredEvidence: 'no edge-strength control mounts',
  },
  preAnalysisV3FactorValue: {
    authority: 'server_graph',
    entrySurfaces: ['pre-analysis v3 estimate drill-in'],
    requiredEvidence: 'accepted factor_value_edit plus receipt-gated optimistic rollback/readback',
  },
  preAnalysisV3FactorConfirmation: {
    authority: 'disabled',
    entrySurfaces: ['pre-analysis v3 estimate drill-in'],
    requiredEvidence: 'Confirm as is and Undo confirmation do not mount',
  },
  preAnalysisV3StructuralAdd: {
    authority: 'disabled',
    entrySurfaces: ['pre-analysis v3 option group', 'pre-analysis v3 risk group'],
    requiredEvidence: 'local Add controls are replaced by Olumi coaching actions',
  },
  analysisAssumedEdgeStrength: {
    authority: 'disabled',
    entrySurfaces: ['analysis assumed-strength card'],
    requiredEvidence:
      'finding remains visible; the mounted action ASKS Olumi (a conversation turn) and the surface itself writes no graph state',
  },
  canvasEdgeStrength: {
    authority: 'disabled',
    entrySurfaces: ['canvas edge label'],
    requiredEvidence: 'double-click opens read-only details and writes no edge data',
  },
  canvasFactorConfirmation: {
    authority: 'disabled',
    entrySurfaces: ['factor node footer'],
    requiredEvidence: 'no local confirmation control mounts',
  },
  goalSuccessTarget: {
    authority: 'disabled',
    entrySurfaces: ['pre-analysis hero', 'analysis hero', 'Strengthen panel'],
    requiredEvidence: 'no local threshold editor or local Define-success modal action mounts',
  },
  canvasSemanticMutations: {
    authority: 'disabled',
    entrySurfaces: ['context menu', 'command palette', 'keyboard', 'connection handles'],
    requiredEvidence: 'local add, reverse, duplicate, paste, value and history controls do not mount or execute',
  },
  inspectorSemanticControls: {
    authority: 'disabled',
    entrySurfaces: ['node Inspector', 'edge Inspector', 'technical editors'],
    requiredEvidence: 'disabled fieldset plus one visible shared-model authority reason',
  },
} as const satisfies Record<string, {
  authority: MutationAuthority
  entrySurfaces: readonly string[]
  requiredEvidence: string
}>

describe('mutation authority is exhaustive and fail-closed', () => {
  it('matches the frozen mounted-family audit contract exactly', () => {
    expect(CANONICAL_EDIT_AUTHORITY).toEqual(
      Object.fromEntries(
        Object.entries(EXPECTED_MOUNTED_AUTHORITY)
          .map(([family, contract]) => [family, contract.authority]),
      ),
    )
    for (const contract of Object.values(EXPECTED_MOUNTED_AUTHORITY)) {
      expect(contract.entrySurfaces.length).toBeGreaterThan(0)
      expect(contract.requiredEvidence.length).toBeGreaterThan(0)
    }
  })

  it('classifies every Inspector setter, with no unowned write surface', () => {
    expect(Object.keys(NODE_SETTER_AUTHORITY).sort()).toEqual(Object.keys(NODE_SETTER_FIELDS).sort())
    expect(Object.keys(EDGE_SETTER_AUTHORITY).sort()).toEqual(Object.keys(EDGE_SETTER_FIELDS).sort())
  })

  it('mounts no Inspector semantic setter as a GraphV3 edit', () => {
    expect(Object.values(NODE_SETTER_AUTHORITY)).not.toContain('server_graph')
    expect(Object.values(NODE_SETTER_AUTHORITY)).toEqual(
      expect.arrayContaining(Array(Object.keys(NODE_SETTER_AUTHORITY).length).fill('disabled')),
    )
    expect(Object.values(EDGE_SETTER_AUTHORITY)).toEqual(
      expect.arrayContaining(Array(Object.keys(EDGE_SETTER_AUTHORITY).length).fill('disabled')),
    )
    expect(NODE_SETTER_AUTHORITY.setPriorRange).toBe('disabled')
  })

  it('preserves only the receipt-bearing model actions as shared-model edits', () => {
    const graphEdits = Object.entries(CANONICAL_EDIT_AUTHORITY)
      .filter(([, authority]) => hasServerGraphAuthority(authority as MutationAuthority))
      .map(([action]) => action)
      .sort()
    expect(graphEdits).toEqual([
      'modelFactorValue',
      'preAnalysisV3FactorValue',
      'structuralDeleteWithServerHash',
    ])
    expect(CANONICAL_EDIT_AUTHORITY.modelOptionIntervention).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.modelFactorConfirmation).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.postRunFactorValue).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.postRunFactorConfirmation).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.postRunAutoFix).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.preAnalysisFactorValue).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.preAnalysisFactorConfirmation).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.preAnalysisEdgeStrength).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.preAnalysisV3FactorValue).toBe('server_graph')
    expect(CANONICAL_EDIT_AUTHORITY.preAnalysisV3FactorConfirmation).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.preAnalysisV3StructuralAdd).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.analysisAssumedEdgeStrength).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.canvasEdgeStrength).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.canvasFactorConfirmation).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.goalSuccessTarget).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations).toBe('disabled')
    expect(CANONICAL_EDIT_AUTHORITY.inspectorSemanticControls).toBe('disabled')
  })
})
