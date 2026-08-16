/**
 * Model tab v2 — THE DETAIL REGION (design §4.4).
 *
 * ⚠ UNMOUNTED. See `types.ts`.
 *
 * WHAT IT REPLACES. Today reaching an edge's detail costs THREE nested
 * disclosures — the section accordion, then a per-card `cardExpanded` toggled by
 * clicking the card body with NO CHEVRON AND NO VISIBLE AFFORDANCE, then the
 * global `showDetail` whose control lives outside the tab in the dock chrome
 * (design §2 F7). Selection replaces the middle one entirely, so the axes drop
 * from three to two: group open/closed, and selection. The invisible axis is the
 * one being deleted, and it is invisible by design accident, not by intent.
 *
 * TWO PROPERTIES THIS FILE EXISTS TO GUARANTEE:
 *
 * 1. THE ADVANCED BLOCK IS ABSENT FROM THE DOM IN PLAIN — not hidden, not
 *    `display:none`, not zero-height. A parameter that is merely invisible is
 *    still findable, still copyable, still read by a screen reader, and still
 *    there to be mistaken for a plain value the moment a stylesheet changes.
 *    "Flip one switch and see none of them" (design §12) is a claim about what
 *    EXISTS, and it is enforced here by not rendering the subtree at all.
 *
 * 2. IT REFUSES TO RENDER SOMEBODY ELSE'S DETAIL. `detail.rowId` must equal the
 *    row it was asked to describe. On a mismatch it says so, loudly, instead of
 *    painting a confident and wrong pane — see `ModelRowDetail.rowId`.
 */

import { typography } from '../../styles/typography'
import { SourceProvenancePill } from '../components/model-tab/SourceProvenancePill'
import { KIND_LABEL } from './rowPresentation'
import type { DetailField, DetailTier, ModelRow, ModelRowDetail } from './types'

export interface ModelDetailRegionProps {
  row: ModelRow
  detail: ModelRowDetail
  tier: DetailTier
  onFocusOnCanvas?: (id: string) => void
}

/** Absence is rendered as absence — never as a zero, never as a blank cell. */
function FieldList({ fields, testid }: { fields: readonly DetailField[]; testid: string }) {
  if (fields.length === 0) return null
  return (
    <dl data-testid={testid} className="grid grid-cols-2 gap-x-3 gap-y-1">
      {fields.map(f => (
        <div key={f.label} className="contents">
          <dt className={`${typography.caption} text-text-light`}>{f.label}</dt>
          <dd
            data-testid={`${testid}-${f.label}`}
            className={`${typography.tabular} text-text-body`}
          >
            {f.value ?? 'Not stated'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function ModelDetailRegion({
  row,
  detail,
  tier,
  onFocusOnCanvas,
}: ModelDetailRegionProps) {
  /*
   * The identity gate. This is deliberately a VISIBLE refusal rather than a
   * silent `return null`: a detail region that quietly vanishes looks like a
   * rendering bug and gets "fixed" by removing the check, whereas a stated
   * mismatch names the defect for whoever sees it.
   */
  if (detail.rowId !== row.id) {
    return (
      <aside data-testid="model-detail-v2" data-mismatch="true">
        <p data-testid="model-detail-v2-mismatch" className={`${typography.bodySmall} text-danger`}>
          This panel was given details for a different element, so it has not shown them.
        </p>
      </aside>
    )
  }

  return (
    <aside
      data-testid="model-detail-v2"
      data-row-id={row.id}
      data-tier={tier}
      aria-label={`${KIND_LABEL[row.kind]} details: ${row.label}`}
      className="flex flex-col gap-3 p-3"
    >
      {/* 1 — What this is */}
      <section data-testid="model-detail-v2-what">
        <h3 className={`${typography.h5} text-text-header`}>{row.label}</h3>
        <p className={`${typography.caption} text-text-light`}>{KIND_LABEL[row.kind]}</p>
        {detail.description !== null && (
          <p
            data-testid="model-detail-v2-description"
            className={`${typography.bodySmall} text-text-body`}
          >
            {detail.description}
          </p>
        )}
      </section>

      {/* 2 — Its value */}
      <section data-testid="model-detail-v2-value">
        <h4 className={`${typography.label} text-text-header`}>Its value</h4>
        <p data-testid="model-detail-v2-primary" className={`${typography.tabular} text-text-body`}>
          {row.primaryValue ?? 'Not set'}
        </p>
        <FieldList fields={detail.secondaryValues} testid="model-detail-v2-secondary" />
      </section>

      {/* 3 — Where it came from */}
      <section data-testid="model-detail-v2-provenance">
        <h4 className={`${typography.label} text-text-header`}>Where it came from</h4>
        {row.provenanceSource !== undefined && (
          <SourceProvenancePill source={row.provenanceSource} showWhenAbsent={false} />
        )}
        {detail.basis !== null && (
          <p
            data-testid="model-detail-v2-basis"
            className={`${typography.bodySmall} text-text-body`}
          >
            {detail.basis}
          </p>
        )}
        {detail.adjustments.length > 0 && (
          <ul data-testid="model-detail-v2-adjustments">
            {detail.adjustments.map(a => (
              <li key={a} className={`${typography.caption} text-text-light`}>
                {a}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4 — What it affects */}
      <section data-testid="model-detail-v2-affects">
        <h4 className={`${typography.label} text-text-header`}>What it affects</h4>
        {detail.affects.length === 0 ? (
          <p className={`${typography.caption} text-text-light`}>
            Nothing in the model depends on this yet
          </p>
        ) : (
          <ul>
            {detail.affects.map(a => (
              <li key={a.id}>
                <button
                  type="button"
                  data-testid={`model-detail-v2-affects-${a.id}`}
                  onClick={() => onFocusOnCanvas?.(a.id)}
                  className={`${typography.bodySmall} text-info text-left`}
                >
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        5 — Advanced. ⚠ NOT RENDERED AT ALL IN PLAIN. See the header: this is an
        existence claim, not a visibility one.
      */}
      {tier === 'advanced' && (
        <section data-testid="model-detail-v2-advanced">
          <h4 className={`${typography.label} text-text-header`}>Advanced — model parameters</h4>
          {detail.advancedParameters.length === 0 ? (
            <p className={`${typography.caption} text-text-light`}>
              This element has no model parameters
            </p>
          ) : (
            <FieldList fields={detail.advancedParameters} testid="model-detail-v2-advanced-fields" />
          )}
        </section>
      )}
    </aside>
  )
}
