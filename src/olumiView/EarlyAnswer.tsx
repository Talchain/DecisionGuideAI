import './look/olumiLook.css'
import { typography } from '../styles/typography'
import { EARLY_LABEL, earlyBlocks } from './early'
import { ITEM_MARK, LEAD_IN, richText } from './v12/chat/richText'

/**
 * A reply's text as the conversation draws it, as blocks: a blank line is a new paragraph, "- " lines are one list (the marker dropped), and each
 * line through `richText` (a "## " lead-in is a quiet heading, `**x**` is weight 500, an address is a link). No type size of its own: it takes the
 * size of where it is drawn (the panel's body, or a kept idea's card at the board's scale). One renderer for a reply's text wherever it is shown.
 * A bullet sits on the middle of its first line at any size: 0.75em less half its 4 px dot (7 px in the panel's 12/18 body, as before).
 */
export function ReplyBlocks({ text }: { text: string }) {
  return (
    <>
      {earlyBlocks(text).map((b, i) => (b.list
        ? <ul key={i} data-reply-list="">{b.lines.map((l, j) => <li key={j} className="relative before:absolute before:-left-3 before:top-[calc(0.75em_-_2px)] before:h-1 before:w-1 before:rounded-full before:content-['']">{richText(l)}</li>)}</ul>
        : <p key={i} className="m-0" data-reply-para="">{b.lines.map((l, j) => <span key={j}>{j > 0 ? <br /> : null}{richText(l)}</span>)}</p>))}
    </>
  )
}

/** A reply's words without its layout marks (a lead-in's hashes, a list's "- ", the `**` around a bold run): for a hover title, which draws no marks. */
export const replyWordsOf = (text: string): string =>
  text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(LEAD_IN, '').replace(ITEM_MARK, '').replace(/\*\*([^*\n]+)\*\*/g, '$1')).join('\n')

/** Olumi's early answer, under its small label: general knowledge, unverified, drawn before and apart from the model-grounded reply. */
export function EarlyAnswer({ text, testid = 'view-early', bare = false }: { text: string; testid?: string; /** No label: an ordinary reply of the conversation (the model-less floor), not the first thoughts. */ bare?: boolean }) {
  return (
    <section className="space-y-1 text-left" data-testid={testid} aria-label={bare ? undefined : EARLY_LABEL}>
      {bare ? null : <p className={`${typography.viewPanelMeta} text-text-light`} data-testid={`${testid}-label`}>{EARLY_LABEL}</p>}
      <div className={`${typography.viewPanelBody} space-y-2 text-text-body`} data-testid={`${testid}-text`}>
        <ReplyBlocks text={text} />
      </div>
    </section>
  )
}
