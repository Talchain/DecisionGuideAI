import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ServerVersionDiff, versionRecordSource } from '../ServerVersionDiff'
import type { ModelVersionDiffV1, ServerModelVersion } from '../../../adapters/cee/modelVersions'

const FROM_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const TO_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'

function version(
  id: string,
  versionNumber: number,
  provenance: string | null,
): ServerModelVersion {
  return {
    id,
    versionNumber,
    label: null,
    provenance,
    restoredFromVersionId: null,
    createdAt: '2026-08-24T10:00:00.000Z',
    graphIdentityHash: id === FROM_ID ? 'a'.repeat(64) : 'b'.repeat(64),
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
      values_uncertainty: [
        {
          path: 'nodes.factor-price.observed_state.value',
          changeKind: 'changed',
          entityKind: 'node',
          entityId: 'factor-price',
          label: 'Price',
          beforeDisplay: '0.5',
          afterDisplay: '0.8',
          summary: 'Price changed from 0.5 to 0.8.',
          whyItMatters: 'This changes an analysis input.',
        },
      ],
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
  it('renders server-attested deterministic categories and values', () => {
    render(
      <ServerVersionDiff
        diff={diff()}
        fromVersion={version(FROM_ID, 1, 'user_save')}
        toVersion={version(TO_ID, 2, 'commit')}
      />,
    )

    expect(screen.getByText('Values and uncertainty')).toBeInTheDocument()
    expect(screen.getByText('Price changed from 0.5 to 0.8.')).toBeInTheDocument()
    expect(screen.getByText('0.5 → 0.8')).toBeInTheDocument()
    expect(screen.getByText('This changes an analysis input.')).toBeInTheDocument()
  })

  it('never infers a person: change author is Unknown and only explicit automatic provenance is System', () => {
    render(
      <ServerVersionDiff
        diff={diff()}
        fromVersion={version(FROM_ID, 1, 'user_save')}
        toVersion={version(TO_ID, 2, 'commit')}
      />,
    )

    expect(screen.getByTestId('server-diff-attribution')).toHaveTextContent(
      /change author: unknown.*version record source: system/i,
    )
    expect(versionRecordSource('user_save')).toBe('Unknown')
    expect(versionRecordSource('future_provenance')).toBe('Unknown')
  })

  it('keeps coverage gaps visible rather than silently treating them as no change', () => {
    render(
      <ServerVersionDiff
        diff={diff({
          coverage: {
            knownUndetectable: ['legacy nested evidence payload'],
            knownUninterpretedPaths: ['nodes.factor-price.custom_field'],
          },
        })}
        fromVersion={version(FROM_ID, 1, 'user_save')}
        toVersion={version(TO_ID, 2, 'user_save')}
      />,
    )

    expect(screen.getByTestId('server-diff-coverage-warning')).toHaveTextContent(
      /could not be fully interpreted/i,
    )
    expect(screen.getByText('legacy nested evidence payload')).toBeInTheDocument()
    expect(screen.getByText('nodes.factor-price.custom_field')).toBeInTheDocument()
  })

  it('renders the identical relation without manufacturing change lines', () => {
    const identical = diff({
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
    })
    render(
      <ServerVersionDiff
        diff={identical}
        fromVersion={version(FROM_ID, 1, 'user_save')}
        toVersion={version(TO_ID, 2, 'user_save')}
      />,
    )

    expect(screen.getByText(/no deterministic model differences/i)).toBeInTheDocument()
    expect(screen.queryByText('Values and uncertainty')).not.toBeInTheDocument()
  })
})
