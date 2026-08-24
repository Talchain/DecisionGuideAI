import { maximalGraphV3 } from '@talchain/schemas/fixtures'
import { ModelVersionMutationReceiptV1Schema } from '../../v5/modelVersionMutationReceipt'

export const modelVersionMutationReceiptFixture = ModelVersionMutationReceiptV1Schema.parse({
  schema: 'model_version_mutation_receipt.v1',
  scenario_id: 'f1000000-0000-4000-8000-000000000001',
  mutation_id: 'fc000000-0000-4000-8000-000000000007',
  version_id: 'f7000000-0000-4000-8000-000000000007',
  sequence: 7,
  graph: maximalGraphV3,
  full_hash: '7'.repeat(64),
  hash_algorithm: 'sha256',
  identity_projection_version: 'FIXTURE_identity_projection_v1',
  identity_normaliser_version: 'FIXTURE_identity_normaliser_v1',
  graph_schema_version: 'FIXTURE_graph_v3',
  analysis_affecting_hash: '0'.repeat(64),
  actor: { kind: 'known', authored_by: 'owner' },
  creation: { kind: 'committed_mutation' },
  source_turn_id: 'fixture_turn_model_version_receipt_committed',
  lineage: {
    kind: 'known',
    parent_version_id: 'f6000000-0000-4000-8000-000000000006',
    root_version_id: 'f1000000-0000-4000-8000-000000000001',
  },
  undo_version_id: null,
  event_id: 'model_version_created_mutation_fc000000-0000-4000-8000-000000000007',
})
