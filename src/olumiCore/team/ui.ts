/**
 * The Team tab's shared class recipes, built from the dock's own type tokens (`typography.panel*`) and the Olumi DS v5 colour tokens
 * (`panel`, `panel-border`, `text-*`, `info`, `success`, `danger`). Nothing here is a hex literal. `FIELD` is the answer field of
 * `ParticipantPacketPage` (its `FIELD`, not exported), narrowed to the dock's measure.
 */
import { typography } from '../../styles/typography'

export const FIELD =
  `w-full min-h-[40px] rounded-md border border-panel-border bg-panel px-3 py-2 ${typography.panelBody} text-text-body placeholder:text-text-light transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-info/50 disabled:opacity-50`
export const CARD = 'grid gap-2.5 rounded-[14px] border border-panel-border bg-panel p-3'
export const H = `${typography.panelHeader} text-text-header m-0`
export const BODY = `${typography.panelBody} text-text-body m-0`
export const META = `${typography.panelMeta} text-text-light m-0`
export const LABEL = `${typography.panelMeta} text-text-header block`
export const ERR = `${typography.panelMeta} text-danger m-0`
/** The mark of a person: a small circle with an initial (the v10 board's `tb-ic`). */
export const AVATAR = `inline-grid h-[22px] w-[22px] flex-none place-items-center rounded-full border border-panel-border bg-canvas ${typography.panelMeta} text-text-body`

/** The privacy promise, said once and in the words of the moment: before the reveal, and after it. While figures cannot be entered, nothing is promised about them. */
export const PRIVACY_BEFORE = 'Your view is private until the reveal.'
export const PRIVACY_AFTER = 'Revealed to everyone, Olumi included.'
/** Said only where a figure can be entered (`TEAM_FIGURES_SERVED`). */
export const PRIVACY_FIGURES = 'Olumi never reads your figures, and they never change the model.'
