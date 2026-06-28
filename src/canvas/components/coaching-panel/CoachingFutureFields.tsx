/**
 * CoachingFutureFields — render-only display of roadmap fields.
 *
 * Every field here is OPTIONAL and fixture-only this phase (UX amendment 7): it
 * renders iff present, exactly as given. Nothing is computed — priority is never
 * used to sort, lifecycle is never transitioned, staleness is never derived
 * (F.6). Human strings render verbatim; the raw numeric `priority` is kept on a
 * data attribute (traceability) rather than shown as prose (UX amendment 3).
 */
import { typography } from '@/styles/typography'
import type { CoachingSignal } from './types'

/** True when a signal carries any roadmap field worth expanding for. */
export function hasFutureFields(s: CoachingSignal): boolean {
  return (
    s.priority != null ||
    s.priority_reason != null ||
    s.lifecycle_state != null ||
    (s.suggested_actions?.length ?? 0) > 0 ||
    (s.evidence?.length ?? 0) > 0 ||
    s.staleness?.label != null
  )
}

const pill =
  'inline-flex items-center rounded-full border border-panel-border bg-transparent px-2 py-0.5 text-text-body'

export function CoachingFutureFields({ signal }: { signal: CoachingSignal }) {
  const { priority, priority_reason, lifecycle_state, suggested_actions, evidence, staleness } = signal

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="coaching-future-fields"
      data-priority={priority != null ? String(priority) : undefined}
    >
      {lifecycle_state && (
        <span className={`${pill} ${typography.panelMeta}`} data-testid="coaching-lifecycle">
          {lifecycle_state}
        </span>
      )}

      {priority_reason && (
        <p className={`${typography.panelMeta} text-text-light`}>{priority_reason}</p>
      )}

      {staleness?.label && (
        <p className={`${typography.panelMeta} text-text-light`} data-testid="coaching-staleness">
          {staleness.label}
        </p>
      )}

      {suggested_actions && suggested_actions.length > 0 && (
        <ul className="flex flex-col gap-1 list-none m-0 p-0" data-testid="coaching-suggested-actions">
          {suggested_actions.map((action, i) => (
            // Display-only: no handler, no execution this phase.
            <li key={action.id ?? `${i}`} className={`${typography.panelBody} text-text-body`}>
              {action.label}
            </li>
          ))}
        </ul>
      )}

      {evidence && evidence.length > 0 && (
        <ul className="flex flex-col gap-1 list-none m-0 p-0" data-testid="coaching-evidence">
          {evidence.map((item, i) => (
            <li key={item.ref ?? `${i}`} className={`${typography.panelMeta} text-text-light`}>
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default CoachingFutureFields
