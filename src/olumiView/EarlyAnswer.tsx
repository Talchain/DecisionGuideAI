import { typography } from '../styles/typography'
import { EARLY_LABEL, earlyBlocks } from './early'
import { richText } from './v12/chat/richText'

/** Olumi's early answer, under its small label: general knowledge, unverified, drawn before and apart from the model-grounded reply. */
export function EarlyAnswer({ text, testid = 'view-early', bare = false }: { text: string; testid?: string; /** No label: an ordinary reply of the conversation (the model-less floor), not the first thoughts. */ bare?: boolean }) {
  return (
    <section className="space-y-1 text-left" data-testid={testid} aria-label={bare ? undefined : EARLY_LABEL}>
      {bare ? null : <p className={`${typography.viewPanelMeta} text-text-light`} data-testid={`${testid}-label`}>{EARLY_LABEL}</p>}
      <div className={`${typography.viewPanelBody} space-y-2 text-text-body`} data-testid={`${testid}-text`}>
        {earlyBlocks(text).map((b, i) => (b.list
          ? <ul key={i} className="m-0 !list-none !pl-3" data-reply-list="">{b.lines.map((l, j) => <li key={j} className="relative !mb-1 last:!mb-0 before:absolute before:-left-3 before:top-[7px] before:h-1 before:w-1 before:rounded-full before:!bg-text-light before:content-['']">{richText(l)}</li>)}</ul>
          : <p key={i} className="m-0" data-reply-para="">{b.lines.map((l, j) => <span key={j}>{j > 0 ? <br /> : null}{richText(l)}</span>)}</p>))}
      </div>
    </section>
  )
}
