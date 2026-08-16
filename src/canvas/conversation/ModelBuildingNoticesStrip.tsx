import type {
  ModelBuildingNoticeKind,
  ModelBuildingNotices,
} from '@talchain/schemas/boundary'

import { typography } from '../../styles/typography'
import styles from './Conversation.module.css'

type NoticeCopy = Readonly<{ singular: string; plural: string }>

/**
 * Consumer-owned, neutral wording for the aggregate-only 0.45 contract.
 * Never interpolate producer text: the wire deliberately contains no labels,
 * values, reasons or node ids, and enum tokens are not user-facing copy.
 */
const NOTICE_COPY: Readonly<Record<ModelBuildingNoticeKind, NoticeCopy>> = {
  detail_not_connected: {
    singular: 'detail not connected',
    plural: 'details not connected',
  },
  relationship_not_used: {
    singular: 'relationship not used',
    plural: 'relationships not used',
  },
  alternative_consolidated: {
    singular: 'alternative consolidated',
    plural: 'alternatives consolidated',
  },
  conflict_resolved_conservatively: {
    singular: 'conflict handled conservatively',
    plural: 'conflicts handled conservatively',
  },
  target_not_modelled_as_threshold: {
    singular: 'target not modelled as a threshold',
    plural: 'targets not modelled as thresholds',
  },
  other: {
    singular: 'other modelling choice',
    plural: 'other modelling choices',
  },
}

export interface ModelBuildingNoticesStripProps {
  notices: ModelBuildingNotices
}

export function ModelBuildingNoticesStrip({ notices }: ModelBuildingNoticesStripProps) {
  // The schema makes this branch unreachable for parsed responses. Keep the
  // display component total when directly exercised with a drifted test value:
  // anything without the explicit redaction attestation renders nothing.
  if (notices.details_redacted !== true || notices.groups.length === 0) return null

  return (
    <section
      className={styles.insightStrip}
      data-testid="model-building-notices"
      aria-label="Model-building notices"
      role="note"
    >
      <div className={styles.insightItem}>
        <div className={styles.modelBuildingNoticeContent}>
          <div className={styles.modelBuildingNoticeHeading}>
            <span className={typography.panelHeader}>Model-building notices</span>
            <span className={typography.panelMeta}>
              {notices.total_count} modelling {notices.total_count === 1 ? 'choice' : 'choices'} noted
            </span>
          </div>
          <ul
            className={styles.modelBuildingNoticeGroups}
            aria-label="Grouped model-building notices"
          >
            {notices.groups.map(({ kind, count }) => {
              const copy = NOTICE_COPY[kind]
              return (
                <li key={kind} className={`${styles.modelBuildingNoticeGroup} ${typography.panelBody}`}>
                  <span className={styles.modelBuildingNoticeCount}>{count}</span>{' '}
                  {count === 1 ? copy.singular : copy.plural}
                </li>
              )
            })}
          </ul>
          <span className={typography.panelMeta}>Details are not shown.</span>
        </div>
      </div>
    </section>
  )
}
