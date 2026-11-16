import { typography } from '../styles/typography'
import { EARLY_LABEL, earlyBlocks } from './early'

/**
 * Olumi's early answer, under its small label: general knowledge, unverified, drawn before and apart from the model-grounded reply.
 * `fold`: the early answer stands beside a model-grounded reply (UI-BRIEF 16 Nov: 385 + 748 words both open was the panel's wall of text),
 * so it is one closed line, its label the summary (said once), and opens to the whole text. Every testid is kept, the label's on the summary.
 */
export function EarlyAnswer({ text, testid = 'view-early', bare = false, fold = false }: { text: string; testid?: string; /** No label: an ordinary reply of the conversation (the model-less floor), not the first thoughts. */ bare?: boolean; /** Closed behind its label, which is the disclosure's summary. */ fold?: boolean }) {
  const folded = fold && !bare
  const body = (
    <section className="space-y-1 text-left" data-testid={testid} aria-label={bare ? undefined : EARLY_LABEL}>
      {bare || folded ? null : <p className={`${typography.viewPanelMeta} text-text-light`} data-testid={`${testid}-label`}>{EARLY_LABEL}</p>}
      <div className={`${typography.viewPanelBody} space-y-2 text-text-body`} data-testid={`${testid}-text`}>
        {earlyBlocks(text).map((b, i) => (b.list
          ? <ul key={i} className="m-0 list-disc space-y-1 pl-5" data-reply-list="">{b.lines.map((l, j) => <li key={j}>{l}</li>)}</ul>
          : <p key={i} className="m-0" data-reply-para="">{b.lines.map((l, j) => <span key={j}>{j > 0 ? <br /> : null}{l}</span>)}</p>))}
      </div>
    </section>
  )
  if (!folded) return body
  return (
    <details className="ok-early-fold text-left" data-testid={`${testid}-fold`}>
      <summary className={`${typography.viewPanelMeta} text-text-light`} data-testid={`${testid}-label`}>{EARLY_LABEL}</summary>
      {body}
    </details>
  )
}
