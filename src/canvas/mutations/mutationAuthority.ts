/**
 * Central product authority for user-visible model mutations.
 *
 * A control may look like a shared-model edit only when it has a
 * receipt-bearing GraphV3 carrier. Keeping this policy independent of any
 * particular editor prevents the Model tab, Inspector and post-run surfaces
 * from inventing different definitions of "saved".
 */
export type MutationAuthority =
  | 'server_graph'
  | 'server_fact'
  | 'local_presentation'
  | 'disabled'

export const CANONICAL_EDIT_AUTHORITY = {
  modelFactorValue: 'server_graph',
  structuralDeleteWithServerHash: 'server_graph',
  priorRangeJudgement: 'disabled',
  canvasSelectionAndLayout: 'local_presentation',
  modelOptionIntervention: 'disabled',
  modelFactorConfirmation: 'disabled',
  postRunFactorValue: 'disabled',
  postRunFactorConfirmation: 'disabled',
  postRunAutoFix: 'disabled',
  preAnalysisFactorValue: 'disabled',
  preAnalysisFactorConfirmation: 'disabled',
  preAnalysisEdgeStrength: 'disabled',
  preAnalysisV3FactorValue: 'server_graph',
  preAnalysisV3FactorConfirmation: 'disabled',
  preAnalysisV3StructuralAdd: 'disabled',
  analysisAssumedEdgeStrength: 'disabled',
  canvasEdgeStrength: 'disabled',
  canvasFactorConfirmation: 'disabled',
  goalSuccessTarget: 'disabled',
  canvasSemanticMutations: 'disabled',
  inspectorSemanticControls: 'disabled',
} as const satisfies Record<string, MutationAuthority>

export const SHARED_MODEL_AUTHORITY_COPY =
  'Change this through the Model tab or ask Olumi so the shared model stays in sync.'

export function hasServerGraphAuthority(authority: MutationAuthority): boolean {
  return authority === 'server_graph'
}
