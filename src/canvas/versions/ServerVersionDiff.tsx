/**
 * Deterministic shared-model diff rendering.
 *
 * This surface renders only ModelVersionDiffV1 fields attested by CEE. It does
 * not inspect the live canvas, recalculate scientific consequences, or infer a
 * person from the authenticated viewer or a version's provenance.
 */

import { typography } from '../../styles/typography'
import {
  MODEL_VERSION_DIFF_CATEGORIES,
  type ModelVersionDiffCategory,
  type ModelVersionDiffChange,
  type ModelVersionDiffV1,
  type ServerModelVersion,
} from '../../adapters/cee/modelVersions'

const CATEGORY_LABELS: Readonly<Record<ModelVersionDiffCategory, string>> = {
  structure: 'Structure',
  relationships: 'Relationships',
  values_uncertainty: 'Values and uncertainty',
  evidence_provenance: 'Evidence and provenance',
  goals_constraints_options: 'Goals, constraints and options',
  assumptions_claims: 'Assumptions and claims',
  presentation: 'Presentation only',
  other_model_fields: 'Other model fields',
}

const CHANGE_MARKERS: Readonly<Record<ModelVersionDiffChange['changeKind'], string>> = {
  added: '+',
  removed: '−',
  changed: '~',
}

const CHANGE_CLASSES: Readonly<Record<ModelVersionDiffChange['changeKind'], string>> = {
  added: 'text-success',
  removed: 'text-danger',
  changed: 'text-info',
}

export function versionRecordSource(provenance: string | null): 'System' | 'Unknown' {
  return provenance === 'commit' || provenance === 'pre_restore' || provenance === 'restore'
    ? 'System'
    : 'Unknown'
}

function versionCaption(version: ServerModelVersion): string {
  return `v${version.versionNumber}${version.label === null ? '' : ` · ${version.label}`}`
}

function ValueTransition({ change }: { change: ModelVersionDiffChange }) {
  if (change.beforeDisplay === null && change.afterDisplay === null) return null
  return (
    <p className={`${typography.panelMeta} text-text-light break-words`}>
      {change.beforeDisplay ?? '—'} → {change.afterDisplay ?? '—'}
    </p>
  )
}

export interface ServerVersionDiffProps {
  diff: ModelVersionDiffV1
  fromVersion: ServerModelVersion
  toVersion: ServerModelVersion
}

export function ServerVersionDiff({ diff, fromVersion, toVersion }: ServerVersionDiffProps) {
  const visibleCategories = MODEL_VERSION_DIFF_CATEGORIES.filter(
    (category) => diff.categories[category].length > 0,
  )
  const coverageUnknown = [
    ...diff.coverage.knownUndetectable,
    ...diff.coverage.knownUninterpretedPaths,
  ]
  const recordSource = versionRecordSource(toVersion.provenance)

  return (
    <div className="space-y-2" data-testid="server-version-diff">
      <p className={`${typography.panelBody} text-text-body`}>
        {versionCaption(fromVersion)} → {versionCaption(toVersion)}
      </p>
      <p className={`${typography.panelMeta} text-text-light`} data-testid="server-diff-attribution">
        Change author: Unknown. Version record source: {recordSource}. Olumi has not inferred a
        person from this history.
      </p>

      {diff.relation === 'identical' ? (
        <p className={`${typography.panelBody} text-text-light`}>
          No deterministic model differences were found.
        </p>
      ) : (
        <>
          <p className={`${typography.panelMeta} text-text-light`}>
            {diff.analysisEquivalent
              ? 'The server reports these versions as analysis-equivalent.'
              : 'The server reports a change to analysis-affecting model content.'}
          </p>
          {visibleCategories.map((category) => (
            <section key={category} className="space-y-1.5" data-diff-category={category}>
              <h4 className={`${typography.panelBody} text-text-body font-medium`}>
                {CATEGORY_LABELS[category]}
              </h4>
              <ul className="space-y-1.5">
                {diff.categories[category].map((change, index) => (
                  <li
                    key={`${category}:${change.path}:${change.entityId ?? 'model'}:${index}`}
                    className="flex items-start gap-2"
                  >
                    <span
                      aria-hidden="true"
                      className={`${typography.panelBody} ${CHANGE_CLASSES[change.changeKind]} shrink-0 w-3`}
                    >
                      {CHANGE_MARKERS[change.changeKind]}
                    </span>
                    <span className="min-w-0">
                      <span className={`${typography.panelBody} text-text-body break-words`}>
                        {change.summary}
                      </span>
                      <ValueTransition change={change} />
                      {change.whyItMatters.length > 0 && (
                        <span className={`${typography.panelMeta} text-text-light block break-words`}>
                          {change.whyItMatters}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {coverageUnknown.length > 0 && (
        <div
          className="rounded-md border border-panel-border p-2"
          data-testid="server-diff-coverage-warning"
        >
          <p className={`${typography.panelMeta} text-text-light`}>
            Some differences could not be fully interpreted. They are not silently counted as no
            change.
          </p>
          <ul className={`${typography.panelMeta} text-text-light list-disc pl-4`}>
            {coverageUnknown.map((item, index) => (
              <li key={`${item}:${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
