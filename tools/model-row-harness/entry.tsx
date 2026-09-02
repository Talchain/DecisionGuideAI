/**
 * DEV-ONLY HARNESS — NOT FOR MERGE. Vite entry at `/model-rows.html`.
 *
 * Paul, 2 Sep: *"Let's test this and see which works best. We can always use
 * progressive disclosure if necessary, but I think we need to get it
 * implemented and visualised to see what works."* So this renders the REAL
 * `ModelRowView` three times over the SAME rows — today's row, the marks
 * candidate, the two-line candidate — at the three real dock widths.
 *
 * ⚠ IT LIVES OUTSIDE `src/` ON PURPOSE. `modelTabV2Boundary.sourceScan.spec.ts`
 * holds an exact-equality list of every file in `src/` allowed to reference
 * `model-tab-v2/`, in both directions, so a harness entry under `src/` would
 * RED that guard — correctly, since it would be a second mount path nobody
 * ruled on. The sweep never leaves `src/`, so `tools/` is invisible to it and
 * the guard keeps meaning what it says.
 *
 * ⚠ SCOPE: this exercises the ROW COMPONENT and its layout against synthetic
 * rows. It is not a witness about the adapter, the wire, or the panel around
 * it. The rows below are hand-built precisely BECAUSE the shipped starter
 * fixtures cannot cover the question (see the note on the fixture set).
 */
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { ModelRowView } from '../../src/canvas/model-tab-v2/ModelRowView'
import type { ModelRow } from '../../src/canvas/model-tab-v2/types'

/**
 * ⚠⚠ WHY THESE ARE SYNTHETIC AND NOT A STARTER DRAFT. I swept all five shipped
 * starter drafts: EVERY factor `observed_state.source` in every one of them is
 * `cee_inference`. There is no `user_confirmed` anywhere in any JSON under
 * `src/`, no factor-level `brief_extraction`, and no `panel_elicited`. A
 * fixture set that only exercises ONE of the seven provenance kinds cannot
 * answer a question about how seven kinds read as marks — it would show three
 * columns of the same glyph and prove nothing. So the rows are built to span
 * the register, and each is labelled with the literal it carries.
 */
const row = (over: Partial<ModelRow> & Pick<ModelRow, 'id' | 'label'>): ModelRow => ({
  kind: 'factor',
  group: 'factors',
  primaryValue: null,
  attention: [],
  editable: true,
  ...over,
})

const ROWS: ModelRow[] = [
  // The row from Paul's own example — the worst case, seven atoms.
  row({
    id: 'fac_gdpr_compliance',
    label: 'GDPR EU Data Residency Compliance',
    primaryValue: null,
    estimateText: 'Moderate (0.5)',
    provenanceSource: 'cee_inference',
    attention: ['no-value', 'unconfirmed-estimate'],
  }),
  // ⭐ THE CASE THAT FORBIDS MERGING THE ⚠ INTO THE MARK. A band is an Olumi
  // estimate that CANNOT be ratified, so it carries provenance and no ⚠.
  row({
    id: 'fac_billing_complexity',
    label: 'Usage-Based Billing Complexity',
    primaryValue: null,
    estimateText: '0.4 to 0.9',
    provenanceSource: 'cee_inference',
    attention: ['no-value'],
  }),
  row({
    id: 'fac_platform_migration',
    label: 'Platform Migration Effort',
    primaryValue: '8 months',
    provenanceSource: 'brief_extraction',
  }),
  row({
    id: 'fac_eng_capacity',
    label: 'Engineering Capacity',
    primaryValue: '45 days',
    provenanceSource: 'user_confirmed',
  }),
  row({
    id: 'fac_churn_pressure',
    label: 'Mid-Market Churn Pressure',
    primaryValue: '35 %',
    provenanceSource: 'user_edited',
  }),
  row({
    id: 'fac_discount_floor',
    label: 'Discount Floor We Will Not Cross',
    primaryValue: '12 %',
    provenanceSource: 'user_assumption',
  }),
  row({
    id: 'fac_panel_estimate',
    label: 'Competitive Intensity in Target Market',
    primaryValue: '0.62',
    provenanceSource: 'panel_elicited',
  }),
  row({
    id: 'fac_legacy_user_set',
    label: 'Customer Success Headcount',
    primaryValue: '6 FTE',
    provenanceSource: 'user',
  }),
  // Non-editable + empty: the cell is SILENT, so the ⚠ is the only signal and
  // the marks layout must NOT cut it here.
  row({
    id: 'rel_pricing_to_churn',
    label: 'Repricing → Churn',
    kind: 'relationship',
    group: 'relationships',
    primaryValue: null,
    editable: false,
    attention: ['no-value'],
  }),
  row({
    id: 'goal_arr',
    label: 'Grow Total ARR Materially Within 12 Months',
    kind: 'goal',
    group: 'goal',
    primaryValue: '11 £M ARR',
    labelFromBrief: true,
    provenanceSource: 'brief_extraction',
  }),
]

const WIDTHS = [280, 416, 480] as const
const VARIANTS = [
  { id: 'pill', label: 'Today — worded pill' },
  { id: 'marks', label: 'A — provenance marks' },
  { id: 'two-line', label: 'B — two lines' },
] as const

function Column({ variant, width, tier }: { variant: 'pill' | 'marks' | 'two-line'; width: number; tier: 'plain' | 'advanced' }) {
  return (
    <div style={{ flex: '0 0 auto' }}>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#444' }}>
        {VARIANTS.find(v => v.id === variant)!.label} · {width}px
      </div>
      <div
        data-testid={`ab-${variant}-${width}`}
        style={{ width, background: '#fff', border: '1px solid #d8dbe2', borderRadius: 4, overflow: 'hidden' }}
      >
        <ul role="listbox" aria-label="Model rows" className="list-none p-0 m-0">
          {ROWS.map(r => (
            <ModelRowView key={r.id} row={r} tier={tier} rowLayout={variant} onBeginEdit={() => {}} onConfirmValueAsIs={() => {}} />
          ))}
        </ul>
      </div>
    </div>
  )
}

function Harness() {
  const [width, setWidth] = useState<number>(390)
  const [tier, setTier] = useState<'plain' | 'advanced'>('plain')
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16, background: '#f4f5f7', minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13 }}>Model row — A/B</strong>
        <span style={{ fontSize: 12 }}>
          width{' '}
          {WIDTHS.map(w => (
            <button key={w} data-testid={`ab-w-${w}`} onClick={() => setWidth(w)} style={{ marginLeft: 4, padding: '2px 8px', fontWeight: width === w ? 700 : 400 }}>{w}</button>
          ))}
        </span>
        <span style={{ fontSize: 12 }}>
          tier{' '}
          {(['plain', 'advanced'] as const).map(t => (
            <button key={t} data-testid={`ab-tier-${t}`} onClick={() => setTier(t)} style={{ marginLeft: 4, padding: '2px 8px', fontWeight: tier === t ? 700 : 400 }}>{t}</button>
          ))}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', overflowX: 'auto' }}>
        {VARIANTS.map(v => <Column key={v.id} variant={v.id} width={width} tier={tier} />)}
      </div>
    </div>
  )
}

createRoot(document.getElementById('harness-root')!).render(<StrictMode><Harness /></StrictMode>)
