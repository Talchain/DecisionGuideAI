/**
 * P4 (system spec): a reply's facts, ONE compact grey icon row under the reply (it replaces the separate "What these results rest on" fold, the "Why, and
 * what moves it" fold and the tools row's version words): the cards it is about, what it rests on (the existing receipts and the why lines in ONE
 * disclosure), keep, show in the workspace, and the version as its icon. Every hover is the registry's (OkIconButton / OkIcon, which draw their words
 * through the one Tip). No sentence is written here: the disclosure's two headings are the folds' own existing words.
 */
import { useId, useState, type ReactNode } from 'react'
import { OkIconButton } from '../../look/icons'
import { typography } from '../../../styles/typography'
import { AboutChips, type AboutCard } from './AboutChip'
import { RESULTS_REST_ON } from '../../ResultReceipts'

/** The why lines' heading, chrome (it was the fold's summary). */
export const WHY_AND_WHAT_MOVES_IT = 'Why, and what moves it'

export function ReplyFacts({ at, about, rests, why, children }: {
  at: string
  about: readonly AboutCard[]
  /** The receipts' body (ResultReceipts), or null when the reply used no figure. */
  rests: ReactNode | null
  /** The why lines' list, or null when the reply has none. */
  why: ReactNode | null
  /** The rest of the row, in order: keep, show in the workspace, the version icon. */
  children?: ReactNode
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const body = useId()
  const parts = [rests === null ? null : RESULTS_REST_ON, why === null ? null : WHY_AND_WHAT_MOVES_IT].filter((x): x is string => x !== null)
  return (
    <>
      <div className="ok-facts" data-testid="view-reply-tools">
        <AboutChips cards={about} />
        {parts.length === 0 ? null : (
          <OkIconButton id="rests-on" tone="ghost" words={parts.join(', ')} hover={parts.join('\n')} expanded={open} controls={body} testid="view-reply-rests"
            onClick={() => setOpen((o) => !o)} />
        )}
        {children}
      </div>
      {!open || parts.length === 0 ? null : (
        <div id={body} className="ok-section ok-stack" data-reply-more={at} data-testid="view-reply-rests-body">
          {rests === null ? null : <section className="ok-stack" aria-label={RESULTS_REST_ON}><p className={`${typography.viewPanelHeading} text-text-header`}>{RESULTS_REST_ON}</p>{rests}</section>}
          {why === null ? null : <section className="ok-stack" aria-label={WHY_AND_WHAT_MOVES_IT}><p className={`${typography.viewPanelHeading} text-text-header`}>{WHY_AND_WHAT_MOVES_IT}</p>{why}</section>}
        </div>
      )}
    </>
  )
}
