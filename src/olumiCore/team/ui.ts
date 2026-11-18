/**
 * The Team tab's shared class recipes, built from the dock's own type tokens (`typography.panel*`) and the Olumi DS v5 colour tokens
 * (`panel`, `panel-border`, `text-*`, `info`, `success`, `danger`). Nothing here is a hex literal. `FIELD` is the answer field of
 * `ParticipantPacketPage` (its `FIELD`, not exported), narrowed to the dock's measure.
 */
import { typography } from '../../styles/typography'
import { controls } from '../../styles/controls'

export const FIELD =
  `w-full min-h-[32px] rounded-sm border border-field bg-panel px-2.5 py-2 ${typography.viewPanelBody} text-text-body placeholder:text-text-light transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50 disabled:bg-panel-hover disabled:text-text-light disabled:cursor-not-allowed`
export const CARD = 'grid gap-2 rounded-md border border-panel-border p-3'
export const H = `${typography.viewPanelMeta} font-medium text-text-header m-0`
export const BODY = `${typography.viewPanelBody} text-text-body m-0`
export const META = `${typography.viewPanelMeta} text-text-light m-0`
export const LABEL = `${typography.viewPanelMeta} font-medium text-text-header block`
export const ERR = `${typography.viewPanelMeta} text-danger m-0`
/** The mark of a person: a small circle with an initial (the v10 board's `tb-ic`). */
export const AVATAR = `inline-grid h-[22px] w-[22px] flex-none place-items-center rounded-full border border-panel-border bg-canvas ${typography.viewPanelMeta} text-text-body`
/**
 * The person's one filled action in a step (overnight 18 Nov): green (`--success`) with an ink label, as the chat's own green action
 * (`v12/chat/OlumiAsks` USE_CLASS); blue stays Olumi's. One per open step.
 */
export const GO = `${typography.viewPanelHeading} inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 ${controls.act}`
/** A quiet text action (a fold, a secondary step): underlined meta words, never a second filled button. */
export const QUIET = `${typography.viewPanelMeta} inline-flex min-h-[24px] cursor-pointer items-center gap-1 text-text-body underline underline-offset-2 hover:text-text-header disabled:cursor-not-allowed disabled:no-underline disabled:text-text-light`
/** A link that is not Olumi's (the printable record, a source the team cited): body ink, underlined. Blue stays Olumi's. */
export const PLAIN_LINK = 'text-text-body underline underline-offset-2 hover:text-text-header'
/** A fold's summary row (native details marker). */
export const FOLD = `${typography.viewPanelMeta} min-h-[24px] cursor-pointer font-medium text-text-header`
/** Ask Olumi (overnight 18 Nov, sent on the press): an outlined pill with Olumi's mark, quieter than the person's one green action. */
export const ASK = `${typography.viewPanelMeta} inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-panel-border bg-panel px-2.5 text-text-header hover:border-text-light hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header disabled:cursor-not-allowed disabled:text-text-light`
