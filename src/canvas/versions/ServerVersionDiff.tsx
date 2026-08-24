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

const UNDETECTABLE_LABELS: Readonly<Record<string, string>> = {
  conversation_or_discussion_not_committed_to_the_shared_graph:
    'Conversation or discussion that was not committed to the shared model.',
  private_contributions_not_revealed_into_the_shared_graph:
    'Private contributions that have not been revealed into the shared model.',
  transient_ui_state_excluded_from_graph_persistence:
    'Temporary interface state that is not stored in the shared model.',
}

function undetectableLabel(value: string): string {
  const known = UNDETECTABLE_LABELS[value]
  if (known !== undefined) return known
  const words = value.replace(/_/g, ' ').trim()
  if (words.length === 0) return 'A model detail that is not stored in shared history.'
  const sentence = `${words[0].toUpperCase()}${words.slice(1)}`
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`
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

function DiffCategoryItems({
  category,
  changes,
}: {
  category: ModelVersionDiffCategory
  changes: ModelVersionDiffChange[]
}) {
  return (
    <ul className="space-y-1.5" data-diff-category={category}>
      {changes.map((change, index) => (
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
            <span className={`${typography.panelMeta} text-text-light block break-words`}>
              {change.whyItMatters}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function ServerVersionDiff({ diff, fromVersion, toVersion }: ServerVersionDiffProps) {
  const visibleCategories = MODEL_VERSION_DIFF_CATEGORIES.filter(
    (category) => category !== 'presentation' && diff.categories[category].length > 0,
  )
  const presentationChanges = diff.categories.presentation

  return (
    <div className="space-y-2" data-testid="server-version-diff">
      <p className={`${typography.panelBody} text-text-body`}>
        {versionCaption(fromVersion)} → {versionCaption(toVersion)}
      </p>
      <p className={`${typography.panelMeta} text-text-light`} data-testid="server-diff-attribution">
        Actor: Unknown. This comparison does not include actor metadata.
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
              <DiffCategoryItems category={category} changes={diff.categories[category]} />
            </section>
          ))}
          {presentationChanges.length > 0 && (
            <details
              className="rounded-md border border-panel-border p-2"
              data-testid="server-diff-presentation"
            >
              <summary className={`${typography.panelBody} text-text-body cursor-pointer`}>
                Presentation-only changes ({presentationChanges.length})
              </summary>
              <div className="mt-1.5">
                <DiffCategoryItems category="presentation" changes={presentationChanges} />
              </div>
            </details>
          )}
        </>
      )}

      {diff.coverage.knownUndetectable.length > 0 && (
        <div
          className="rounded-md border border-panel-border p-2"
          data-testid="server-diff-undetectable-warning"
        >
          <p className={`${typography.panelMeta} text-text-light`}>
            These facts are absent from authoritative persistence, so this comparison cannot
            detect whether they changed.
          </p>
          <ul className={`${typography.panelMeta} text-text-light list-disc pl-4`}>
            {diff.coverage.knownUndetectable.map((item, index) => (
              <li key={`${item}:${index}`}>{undetectableLabel(item)}</li>
            ))}
          </ul>
        </div>
      )}

      {diff.coverage.knownUninterpretedPaths.length > 0 && (
        <div
          className="rounded-md border border-panel-border p-2"
          data-testid="server-diff-uninterpreted-warning"
        >
          <p className={`${typography.panelMeta} text-text-light`}>
            These persisted differences were detected mechanically and are shown under Other model
            fields; Olumi has not assigned them a semantic interpretation.
          </p>
          <ul className={`${typography.panelMeta} text-text-light list-disc pl-4`}>
            {diff.coverage.knownUninterpretedPaths.map((path, index) => (
              <li key={`${path}:${index}`}>{path}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
