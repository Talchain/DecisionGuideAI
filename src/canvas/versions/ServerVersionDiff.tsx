/**
 * ⭐ WHAT CHANGED BETWEEN TWO SHARED VERSIONS (DL #85 5942533417, version compare, LOW).
 *
 * Renders CEE's `model_version_diff.v1` VERBATIM: each row's `summary`, its
 * `before_display → after_display` and its `why_it_matters` are CEE's words. This
 * view never reads the live canvas, never recomputes a consequence, and never
 * names who made a change (the diff carries no actor). It only translates CEE's
 * fixed vocabularies (category keys, the coverage tokens) into plain English.
 *
 * Ported from the unmerged `codex/c8-version-history-ui` `ServerVersionDiff.tsx`
 * (24 Aug), re-bound to the published contract type (`ModelVersionDiffV1`,
 * snake_case, parsed by its own schema in `compareModelVersions`) rather than a
 * hand-mirrored camelCase copy.
 */
import { typography } from '../../styles/typography'
import type { ModelVersionDiff, ServerModelVersion } from '../../adapters/cee/modelVersions'

export const SERVER_VERSION_DIFF_TESTID = 'server-version-diff'

type DiffCategory = keyof ModelVersionDiff['categories']
type DiffItem = ModelVersionDiff['categories'][DiffCategory][number]

/** The contract's own category order, presentation last (it is collapsed). */
export const DIFF_CATEGORY_ORDER: readonly DiffCategory[] = [
  'structure',
  'relationships',
  'values_uncertainty',
  'evidence_provenance',
  'goals_constraints_options',
  'assumptions_claims',
  'other_model_fields',
  'presentation',
]

export const DIFF_CATEGORY_LABELS: Readonly<Record<DiffCategory, string>> = {
  structure: 'Structure',
  relationships: 'Links',
  values_uncertainty: 'Values and uncertainty',
  evidence_provenance: 'Evidence and sources',
  goals_constraints_options: 'Goals, limits and options',
  assumptions_claims: 'Assumptions and claims',
  other_model_fields: 'Other model details',
  presentation: 'Presentation only',
}

const CHANGE_MARKERS: Readonly<Record<DiffItem['change_kind'], string>> = {
  added: '+',
  removed: '−',
  changed: '~',
}

const CHANGE_CLASSES: Readonly<Record<DiffItem['change_kind'], string>> = {
  added: 'text-success',
  removed: 'text-danger',
  changed: 'text-info',
}

const CHANGE_WORDS: Readonly<Record<DiffItem['change_kind'], string>> = {
  added: 'Added',
  removed: 'Removed',
  changed: 'Changed',
}

/** CEE's known-undetectable tokens, in plain English; an unknown token is humanised, never hidden. */
const UNDETECTABLE_LABELS: Readonly<Record<string, string>> = {
  conversation_or_discussion_not_committed_to_the_shared_graph:
    'Conversation that was not saved into the shared model.',
  private_contributions_not_revealed_into_the_shared_graph:
    'Private contributions not yet shared into the model.',
  transient_ui_state_excluded_from_graph_persistence:
    'Temporary screen state, which is never saved with the model.',
}

export function undetectableLabel(token: string): string {
  const known = UNDETECTABLE_LABELS[token]
  if (known !== undefined) return known
  const words = token.replace(/_/g, ' ').trim()
  if (words.length === 0) return 'A detail that is not saved in shared history.'
  const sentence = `${words[0].toUpperCase()}${words.slice(1)}`
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`
}

export function versionCaption(version: Pick<ServerModelVersion, 'versionNumber' | 'label'>): string {
  return `v${version.versionNumber}${version.label === null ? '' : ` · ${version.label}`}`
}

function DiffItems({ category, items }: { category: DiffCategory; items: readonly DiffItem[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li
          key={`${category}:${item.path}:${item.entity_id ?? 'model'}:${index}`}
          className="flex items-start gap-2"
          data-testid={`${SERVER_VERSION_DIFF_TESTID}-item`}
          data-change-kind={item.change_kind}
          data-entity-id={item.entity_id ?? ''}
        >
          <span aria-hidden="true" className={`${typography.panelBody} ${CHANGE_CLASSES[item.change_kind]} shrink-0 w-3`}>
            {CHANGE_MARKERS[item.change_kind]}
          </span>
          <span className="min-w-0">
            <span className="sr-only">{CHANGE_WORDS[item.change_kind]}: </span>
            <span className={`${typography.panelBody} text-text-body break-words`}>{item.summary}</span>
            {(item.before_display !== null || item.after_display !== null) && (
              <span
                className={`${typography.panelMeta} text-text-light block break-words`}
                data-testid={`${SERVER_VERSION_DIFF_TESTID}-transition`}
              >
                {item.before_display ?? '—'} → {item.after_display ?? '—'}
              </span>
            )}
            <span className={`${typography.panelMeta} text-text-light block break-words`}>{item.why_it_matters}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export interface ServerVersionDiffProps {
  diff: ModelVersionDiff
  fromVersion: Pick<ServerModelVersion, 'versionNumber' | 'label'>
  toVersion: Pick<ServerModelVersion, 'versionNumber' | 'label'>
}

export function ServerVersionDiff({ diff, fromVersion, toVersion }: ServerVersionDiffProps) {
  const shown = DIFF_CATEGORY_ORDER.filter((c) => c !== 'presentation' && diff.categories[c].length > 0)
  const presentation = diff.categories.presentation
  const { known_undetectable: undetectable, known_uninterpreted_paths: uninterpreted } = diff.coverage

  return (
    <div className="space-y-2" data-testid={SERVER_VERSION_DIFF_TESTID} data-relation={diff.relation}>
      <p className={`${typography.panelBody} text-text-body font-medium`}>
        {versionCaption(fromVersion)} → {versionCaption(toVersion)}
      </p>

      {diff.relation === 'identical' ? (
        <p className={`${typography.panelBody} text-text-light`} data-testid={`${SERVER_VERSION_DIFF_TESTID}-identical`}>
          These two versions are the same model.
        </p>
      ) : (
        <>
          <p className={`${typography.panelMeta} text-text-light`} data-testid={`${SERVER_VERSION_DIFF_TESTID}-analysis`}>
            {diff.analysis_equivalent
              ? 'None of these changes affects the analysis.'
              : 'Some of these changes affect the analysis, so a Run on each version can give different results.'}
          </p>
          {shown.map((category) => (
            <section key={category} className="space-y-1.5" data-diff-category={category}>
              <h4 className={`${typography.panelBody} text-text-body font-medium`}>{DIFF_CATEGORY_LABELS[category]}</h4>
              <DiffItems category={category} items={diff.categories[category]} />
            </section>
          ))}
          {presentation.length > 0 && (
            <details className="rounded-md border border-panel-border p-2" data-diff-category="presentation">
              <summary className={`${typography.panelBody} text-text-body cursor-pointer`}>
                Presentation-only changes ({presentation.length})
              </summary>
              <div className="mt-1.5">
                <DiffItems category="presentation" items={presentation} />
              </div>
            </details>
          )}
        </>
      )}

      {undetectable.length > 0 && (
        <div className="rounded-md border border-panel-border p-2" data-testid={`${SERVER_VERSION_DIFF_TESTID}-undetectable`}>
          <p className={`${typography.panelMeta} text-text-light`}>
            Not saved with the model, so this comparison cannot say whether these changed:
          </p>
          <ul className={`${typography.panelMeta} text-text-light list-disc pl-4`}>
            {undetectable.map((token, index) => (
              <li key={`${token}:${index}`}>{undetectableLabel(token)}</li>
            ))}
          </ul>
        </div>
      )}

      {uninterpreted.length > 0 && (
        <details className="rounded-md border border-panel-border p-2" data-testid={`${SERVER_VERSION_DIFF_TESTID}-uninterpreted`}>
          <summary className={`${typography.panelMeta} text-text-light cursor-pointer`}>
            {uninterpreted.length === 1 ? '1 detail changed' : `${uninterpreted.length} details changed`} that Olumi has not
            put into words (listed under Other model details)
          </summary>
          <ul className={`${typography.panelMeta} text-text-light list-disc pl-4 mt-1 break-all`}>
            {uninterpreted.map((path, index) => (
              <li key={`${path}:${index}`}>{path}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
