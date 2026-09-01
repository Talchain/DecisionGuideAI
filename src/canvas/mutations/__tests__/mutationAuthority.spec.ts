import { describe, expect, it } from 'vitest'

import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
  type MutationAuthority,
} from '../mutationAuthority'

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
  // schemas 0.50.0 — the durable label writer. It qualifies for `server_graph`
  // on the same terms as its delete sibling directly above and on no weaker
  // ones: a receipt-bearing GraphV3 carrier (`structural_rename`), a server-side
  // write to `scenarios.graph`, and a committed `edit_graph` fact.
  //
  // ⚠ TWO ASSERTIONS, NOT ONE, and the second is what the evidence line names.
  // `base_graph_hash` alone is NOT sufficient here: `label` is absent from CEE's
  // analysis-affecting hash projection, so two concurrent renames move no hash
  // and the second would silently clobber the first. `expected_label` is the
  // gate for the field the hash cannot see, and a rename accepted WITHOUT it
  // would not deserve this authority.
  canvasNodeRenameWithServerHash: {
    authority: 'server_graph',
    entrySurfaces: ['inspector title', 'canvas double-click', 'pre-analysis hero'],
    requiredEvidence:
      'accepted structural_rename with matching server graph hash AND matching expected_label',
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

  /**
   * ⭐ TWO TESTS WERE REMOVED HERE ON 26 Aug 2026, AND THE PROPERTY THEY NAMED
   * DID NOT GO WITH THEM.
   *
   * They asserted over `NODE_SETTER_AUTHORITY` / `EDGE_SETTER_AUTHORITY` —
   * that every Inspector setter was classified, and that none was classified
   * `'server_graph'`. Those two tables were the only readers of themselves:
   * outside this file and their own definition, every reference was a comment
   * or a documentation string, and none was a consumer. So the tests proved a
   * hand-maintained list agreed with itself, which is not the same as proving
   * the Inspector is read-only.
   *
   * ⚠ This read "every reference was a COMMENT" until 27 Aug 2026. That was
   * false — `canvas/domain/analyticalNodeFields.ts:158` names the table in a
   * runtime string literal that ships to browsers. The claim the deletion
   * rests on is the narrow one: zero code CONSUMERS.
   *
   * What actually keeps it read-only is `InspectorRouter`'s unconditional
   * `<fieldset disabled>` around every panel. That is now pinned, per region
   * and by identity, in
   * `canvas/ui/inspector-v2/__tests__/inspectorAuthorityBinding.spec.tsx`:
   * the boundary exists, the notice renders `INSPECTOR_READ_ONLY_REASON`
   * (the CONSTANT, not a substring of it), `aria-describedby` resolves to that
   * notice, and no editing control inside the boundary is effectively enabled.
   * Those hold however many setters exist, so no key list can fall behind.
   */

  it('preserves only the receipt-bearing model actions as shared-model edits', () => {
    const graphEdits = Object.entries(CANONICAL_EDIT_AUTHORITY)
      .filter(([, authority]) => hasServerGraphAuthority(authority as MutationAuthority))
      .map(([action]) => action)
      .sort()
    expect(graphEdits).toEqual([
      // 0.50.0 — the rename joins the receipt-bearing set. ⚠ THIS LIST IS SORTED,
      // so the new member lands FIRST rather than beside its delete sibling; that
      // is the sort's doing, not a claim about ordering.
      'canvasNodeRenameWithServerHash',
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
