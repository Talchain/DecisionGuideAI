import { controls } from '../../styles/controls'
import { HIT_44 } from '../../styles/hitArea'
import { typography } from '../../styles/typography'

const TOOLBAR_SURFACE = 'rounded-md border border-panel-border bg-panel shadow-2'
export const TOOLBAR_SHELL = `${TOOLBAR_SURFACE} p-1`
export const TOOLBAR_BAR = `${TOOLBAR_SHELL} flex items-center`
export const TOOLBAR_RAIL = `${TOOLBAR_SHELL} flex flex-col items-center`
export const TOOLBAR_TRAY = `ok-float pointer-events-auto flex min-h-0 max-h-[min(52vh,28rem)] flex-col`
export const TOOLBAR_BAR_SEPARATOR = 'mx-1 my-1 w-px shrink-0 self-stretch bg-panel-border'
export const TOOLBAR_RAIL_SEPARATOR = 'mx-1 my-1 h-px shrink-0 self-stretch bg-panel-border'

export const TOOLBAR_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header focus-visible:ring-offset-2'
const STATE = [
  'bg-transparent hover:bg-panel-hover hover:text-text-body active:bg-panel-border',
  'aria-disabled:opacity-50 aria-disabled:text-text-light aria-disabled:hover:bg-transparent aria-disabled:hover:text-text-light',
  '[&:is([aria-pressed=true],[aria-checked=true],[aria-expanded=true])]:bg-panel-hover',
  '[&:is([aria-pressed=true],[aria-checked=true],[aria-expanded=true])]:ring-1',
  '[&:is([aria-pressed=true],[aria-checked=true],[aria-expanded=true])]:ring-text-header',
  '[&:is([aria-pressed=true],[aria-checked=true],[aria-expanded=true])]:text-text-header',
  '[&:is([aria-pressed=true],[aria-checked=true],[aria-expanded=true])]:font-medium',
  '[&:is([aria-pressed=true],[aria-checked=true],[aria-expanded=true]):not(:focus-visible)]:ring-inset',
  '[&:is([aria-pressed=true],[aria-checked=true],[aria-expanded=true]):active]:bg-panel-border',
  '[&:is([aria-pressed=true],[aria-checked=true],[aria-expanded=true]):focus-visible]:ring-2',
].join(' ')
const FACE_BASE = `toolbar-face inline-flex shrink-0 items-center justify-center whitespace-nowrap ${TOOLBAR_FOCUS}`
const GEOMETRY = `${FACE_BASE} ${controls.toolbarButton}`
const FACE = `${GEOMETRY} ${STATE}`
// The shared track is flush. Expand across the track, and use the face's own extent along the track.
const BAR_HIT = HIT_44.replace('after:w-11', 'after:w-full')
const RAIL_HIT = HIT_44.replace('after:h-11', 'after:h-full')
const LABEL = `gap-1.5 text-text-body`

export const TOOLBAR_ICON = `${FACE} ${BAR_HIT} text-text-light`
export const TOOLBAR_COUNTED_ICON = `${FACE} ${BAR_HIT} gap-1 text-text-light`
export const TOOLBAR_LABEL = `${FACE} ${BAR_HIT} ${LABEL}`
export const TOOLBAR_RAIL_ICON = `${FACE} ${RAIL_HIT} text-text-light`
export const OLDER_TOOLBAR_RAIL_ICON = `${FACE_BASE} h-[30px] w-[30px] min-w-[30px] rounded-sm ${STATE} ${RAIL_HIT} text-text-light`
export const TOOLBAR_ACTION = `${GEOMETRY} ${BAR_HIT} gap-1.5 aria-disabled:opacity-50`
export const TOOLBAR_STATUS = `inline-flex h-[30px] shrink-0 items-center gap-1.5 whitespace-nowrap px-2 ${typography.viewPanelMeta} text-text-body`
export const TOOLBAR_TITLE = `${typography.viewPanelHeadline} text-text-header`
