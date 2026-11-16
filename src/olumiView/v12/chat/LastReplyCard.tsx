/**
 * "From my last reply" (V12 Commit): Olumi's newest next question as a quiet bordered card above the composer, so the thing to answer sits next to
 * where it is answered. The question is core's words, drawn by the caller (its cites kept); drawn only for a newest reply whose next has words.
 * The heading is the board's fixed chrome.
 */
import type { ReactNode } from 'react'
import { typography } from '../../../styles/typography'

export const LAST_REPLY_HEADING = 'From my last reply'

export function LastReplyCard({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <section aria-label={LAST_REPLY_HEADING} data-testid="view-last-reply-card" className={`${typography.viewPanelBody} space-y-1 rounded-md border border-panel-border bg-panel p-3`}>
      <p className={`${typography.viewPanelMeta} text-text-light`}>{LAST_REPLY_HEADING}</p>
      <p data-testid="view-last-reply-text">{label === '' ? null : <span className={`${typography.viewPanelHeading} text-text-header`}>{label} </span>}{children}</p>
    </section>
  )
}
