/**
 * ONE visual vocabulary for the inspector — canvas visual contract v3.1.
 *
 * The contract's inspector CSS, transcribed once so every pane draws the same
 * button, the same row, the same rule colour and the same radius (DESIGN-GAP-v31
 * rows 7, 8, 32: the served inspector mixed pill chips, tinted buttons, 4px and
 * 14px boxes and boxes nested inside boxes).
 *
 *   .inspector{width:330px;border:1px solid #B8D5CF;border-radius:12px;
 *              box-shadow:0 10px 40px #22333024;max-height:calc(100vh - 135px)}
 *   .inspector-head{padding:13px 14px;border-bottom:1px solid #E5DDD0}
 *   .inspector-head .label{font-size:10px;color:var(--muted);margin-bottom:4px}
 *   .inspector-head h3{font-size:14px;line-height:1.4;font-weight:600}
 *   .inspector-body{padding:14px}   .inspector-body h4{font-size:12px;margin:12px 0 7px}
 *   .detail-row{display:flex;align-items:baseline;justify-content:space-between;
 *               gap:15px;padding:8px 0;border-bottom:1px solid #EEE9E1;font-size:12px}
 *   .section-highlight{border-left:2px solid #A3C5D1;padding-left:10px;margin:14px 0}
 *   .inspector-note{font-size:10px;color:var(--muted);margin:13px 0 0;
 *                   border-top:1px solid var(--line);padding-top:9px}
 *   .button{border:1px solid #BFC9CA;background:white;border-radius:8px}
 *   .button.small{padding:5px 9px;font-size:11px}
 *   .button.primary{border-color:var(--info);background:var(--info);color:white}
 *
 * v3.1 point 9 (no new colours): every value here is the contract's own. The
 * muted token is the design system's `text-text-light` (#6E6B6B, 5.23:1 on the
 * panel — measured; it beats the contract's #666762 band grey on this surface).
 */

/** Numbers the shell and its measure read. */
export const INSPECTOR_WIDTH_PX = 330

export const INSPECTOR_SHELL_STYLE = {
  width: INSPECTOR_WIDTH_PX,
  border: '1px solid #B8D5CF',
  borderRadius: 12,
  boxShadow: '0 10px 40px #22333024',
  maxHeight: 'calc(100vh - 135px)',
} as const

/** Rules: the head's, a detail row's, and the note's (`--line`). */
export const INSPECTOR_RULE = {
  head: 'border-[#E5DDD0]',
  row: 'border-[#EEE9E1]',
  note: 'border-[#DBD7D0]',
  highlight: 'border-[#A3C5D1]',
} as const

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-[8px] border px-[9px] py-[5px] text-[11px] leading-[1.4] font-sans transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:cursor-default disabled:opacity-60'

/** `.button.small` — the one secondary button. */
export const inspectorButton =
  `${BUTTON_BASE} border-[#BFC9CA] bg-white text-text-body hover:border-info hover:bg-[#F6FAFB]`

/** `.button.small.primary` — the one primary button. */
export const inspectorButtonPrimary =
  `${BUTTON_BASE} border-info bg-info text-white hover:bg-info-hover hover:border-info-hover`

/** `.button-row` */
export const inspectorButtonRow = 'flex flex-wrap gap-1.5'

/** `.detail-row` — label muted on the left, value right-aligned. */
export const inspectorDetailRow =
  `flex items-baseline justify-between gap-[15px] py-2 border-b ${INSPECTOR_RULE.row} text-xs leading-[1.45]`

/** `.inspector-body h4` */
export const inspectorHeading = 'text-xs font-semibold text-text-header mt-3 mb-[7px]'

/** `.section-highlight` */
export const inspectorSectionHighlight = `border-l-2 ${INSPECTOR_RULE.highlight} pl-2.5 my-3.5`

/** `.inspector-note` — the quiet 10px note. */
export const inspectorNote =
  `text-[10px] leading-[1.45] text-text-light mt-[13px] mb-0 pt-[9px] border-t ${INSPECTOR_RULE.note}`

/** `.icon-btn` — the header's close control. */
export const inspectorIconButton =
  'grid place-items-center w-[25px] h-[25px] rounded-[5px] shrink-0 text-[#777B77] hover:text-info hover:bg-[#EAF2F5] transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-info'
