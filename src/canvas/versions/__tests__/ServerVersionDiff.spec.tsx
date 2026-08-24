import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ServerVersionDiff } from '../ServerVersionDiff'
import type { ModelVersionDiffV1, ServerModelVersion } from '../../../adapters/cee/modelVersions'

const FROM_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const TO_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'

function version(id: string, versionNumber: number): ServerModelVersion {
  return {
    contractVersion: 'v2',
    id,
    scenarioId: 'cccccccc-3333-4333-8333-cccccccccccc',
    versionNumber,
    label: null,
    provenance: null,
    restoredFromVersionId: null,
    createdAt: '2026-08-24T10:00:00.000Z',
    graphIdentityHash: id === FROM_ID ? 'a'.repeat(64) : 'b'.repeat(64),
    analysisAffectingHash: 'c'.repeat(64),
    actor: { kind: 'known', authoredBy: 'owner' },
    creation: { kind: 'committed_mutation', mutationId: null, sourceTurnId: null },
    lineage: { kind: 'unknown' },
  }
}

function change(path: string) {
  return {
    path,
    changeKind: 'changed' as const,
    entityKind: 'node' as const,
    entityId: 'factor-price',
    label: 'Price',
    beforeDisplay: '0.5',
    afterDisplay: '0.8',
    summary: 'Price changed from 0.5 to 0.8.',
    whyItMatters: 'This changes an analysis input.',
  }
}

function diff(overrides: Partial<ModelVersionDiffV1> = {}): ModelVersionDiffV1 {
  return {
    schema: 'model_version_diff.v1',
    scenarioId: 'cccccccc-3333-4333-8333-cccccccccccc',
    fromVersionId: FROM_ID,
    toVersionId: TO_ID,
    relation: 'different',
    fromFullHash: 'a'.repeat(64),
    toFullHash: 'b'.repeat(64),
    analysisEquivalent: false,
    categories: {
      structure: [],
      relationships: [],
      values_uncertainty: [change('/nodes/factor-price/observed_state/value')],
      evidence_provenance: [],
      goals_constraints_options: [],
      assumptions_claims: [],
      presentation: [],
      other_model_fields: [],
    },
    coverage: { knownUndetectable: [], knownUninterpretedPaths: [] },
    ...overrides,
  }
}

describe('ServerVersionDiff', () => {
  it('renders semantic changes while attribution remains Unknown even for known version actors', () => {
    render(
      <ServerVersionDiff
        diff={diff()}
        fromVersion={version(FROM_ID, 1)}
        toVersion={version(TO_ID, 2)}
      />,
    )
    expect(screen.getByText('Values and uncertainty')).toBeInTheDocument()
    expect(screen.getByText('Price changed from 0.5 to 0.8.')).toBeInTheDocument()
    expect(screen.getByText('0.5 → 0.8')).toBeInTheDocument()
    expect(screen.getByTestId('server-diff-attribution')).toHaveTextContent(
      /actor: unknown.*does not include actor metadata/i,
    )
  })

  it('separates absent facts from mechanically detected uninterpreted paths', () => {
    const other = { ...change('/future_field'), entityKind: 'model' as const, entityId: null }
    render(
      <ServerVersionDiff
        diff={diff({
          categories: {
            structure: [],
            relationships: [],
            values_uncertainty: [],
            evidence_provenance: [],
            goals_constraints_options: [],
            assumptions_claims: [],
            presentation: [],
            other_model_fields: [other],
          },
          coverage: {
            knownUndetectable: [
              'conversation_or_discussion_not_committed_to_the_shared_graph',
              'private_contributions_not_revealed_into_the_shared_graph',
              'transient_ui_state_excluded_from_graph_persistence',
              'future_external_fact_not_persisted',
            ],
            knownUninterpretedPaths: ['/future_field'],
          },
        })}
        fromVersion={version(FROM_ID, 1)}
        toVersion={version(TO_ID, 2)}
      />,
    )
    expect(screen.getByTestId('server-diff-undetectable-warning')).toHaveTextContent(
      /absent from authoritative persistence/i,
    )
    expect(screen.getByTestId('server-diff-uninterpreted-warning')).toHaveTextContent(
      /detected mechanically.*other model fields/i,
    )
    const undetectable = screen.getByTestId('server-diff-undetectable-warning')
    expect(undetectable).toHaveTextContent(
      /conversation or discussion that was not committed to the shared model/i,
    )
    expect(undetectable).toHaveTextContent(
      /private contributions that have not been revealed into the shared model/i,
    )
    expect(undetectable).toHaveTextContent(
      /temporary interface state that is not stored in the shared model/i,
    )
    expect(undetectable).toHaveTextContent(/future external fact not persisted/i)
    expect(undetectable).not.toHaveTextContent(/known_undetectable|shared_graph|ui_state/)
    expect(screen.getByText('Other model fields')).toBeInTheDocument()
  })

  it('keeps presentation-only changes collapsed by default', () => {
    render(
      <ServerVersionDiff
        diff={diff({
          categories: {
            structure: [],
            relationships: [],
            values_uncertainty: [],
            evidence_provenance: [],
            goals_constraints_options: [],
            assumptions_claims: [],
            presentation: [change('/nodes/factor-price/position')],
            other_model_fields: [],
          },
        })}
        fromVersion={version(FROM_ID, 1)}
        toVersion={version(TO_ID, 2)}
      />,
    )
    const details = screen.getByTestId('server-diff-presentation')
    expect(details).not.toHaveAttribute('open')
    expect(details).toHaveTextContent('Presentation-only changes (1)')
  })

  it('renders identical without manufacturing change lines', () => {
    render(
      <ServerVersionDiff
        diff={diff({
          relation: 'identical',
          toFullHash: 'a'.repeat(64),
          analysisEquivalent: true,
          categories: {
            structure: [],
            relationships: [],
            values_uncertainty: [],
            evidence_provenance: [],
            goals_constraints_options: [],
            assumptions_claims: [],
            presentation: [],
            other_model_fields: [],
          },
        })}
        fromVersion={version(FROM_ID, 1)}
        toVersion={version(TO_ID, 2)}
      />,
    )
    expect(screen.getByText(/no deterministic model differences/i)).toBeInTheDocument()
  })
})
