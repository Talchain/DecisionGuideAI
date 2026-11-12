/**
 * The look-proof's marks (ui-ws2-20261112 src/template.html `I` and `FM`), as React elements. Shapes only: colour and size come from
 * next.css. The family marks are keyed by the glyph the View itself assigns (`model.key`), never by a family the screen guesses.
 */
import type { ReactNode } from 'react'

export const OlumiMark = ({ s = 9 }: { s?: number }) => <svg className="mk-olumi" viewBox="0 0 10 10" width={s} height={s}><path d="M5 .5 9.5 5 5 9.5.5 5Z" /></svg>
export const PartlyMark = () => <svg className="mk-partly" viewBox="0 0 10 10" width="9" height="9"><path className="o" d="M5 .9 9.1 5 5 9.1.9 5Z" /><path className="f" d="M5 .9.9 5 5 9.1Z" /></svg>
export const PersonMark = () => <svg className="mk-person" viewBox="0 0 12 12" width="11" height="11"><circle cx="6" cy="3.7" r="2.2" /><path d="M1.8 11c.4-2.5 2-3.8 4.2-3.8s3.8 1.3 4.2 3.8" /></svg>
export const Chev = () => <svg className="chev" viewBox="0 0 16 16" width="16" height="16"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
export const Down = () => <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
export const Pencil = () => <svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 13l.6-2.9L11 2.7l2.3 2.3-7.4 7.4L3 13z M9.8 3.9l2.3 2.3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>
export const Close = () => <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
export const Send = () => <svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 12.5v-9M4.2 7.2 8 3.4l3.8 3.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
export const Tick = () => <svg className="tick" viewBox="0 0 16 16" width="12" height="12"><path d="M3.5 8.3l3 3 6-6.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
export const Dash = () => <svg className="dash" viewBox="0 0 16 16" width="12" height="12"><path d="M4 8h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
export const Brand = ({ s }: { s: number }) => (
  <svg viewBox="0 0 680 680" width={s} height={s}>
    <g transform="translate(13 49)" fill="none" stroke="#252525" strokeWidth="52.2"><path d="M460.5 561.0A244.8 244.8 0 0 1 159.0 460.1" /><path d="M138.8 250.4A244.8 244.8 0 0 1 317.9 94.6" /><path d="M547.8 167.1A244.8 244.8 0 0 1 609.1 380.8" /></g>
    <g transform="translate(13 49)"><circle cx="447" cy="95" r="95.5" fill="#EA7B4B" /><path d="M0 432L226 432L112.5 243Z" fill="#5C9BB8" /><rect x="484" y="412" width="170" height="170" fill="#62B28F" /></g>
  </svg>
)

const FM: Readonly<Record<string, ReactNode>> = {
  '▣': <svg viewBox="0 0 10 10" width="9" height="9"><rect x="1" y="1" width="8" height="8" rx="1.5" fill="var(--option)" /></svg>,
  '●': <svg viewBox="0 0 10 10" width="9" height="9"><circle cx="5" cy="5" r="3.8" fill="var(--factor)" /></svg>,
  '△': <svg viewBox="0 0 10 10" width="10" height="10"><path d="M5 1.2 9.3 8.8H.7Z" fill="var(--danger)" /></svg>,
  '★': <svg viewBox="0 0 12 12" width="11" height="11"><path fill="var(--goal)" d="M6 .8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L6 9l-3.2 1.7.6-3.6L.8 4.6l3.6-.5z" /></svg>,
  '□': <svg viewBox="0 0 10 10" width="9" height="9"><rect className="s" x="1.3" y="1.3" width="7.4" height="7.4" rx="1.2" /></svg>,
  '○': <svg viewBox="0 0 10 10" width="9" height="9"><circle className="s" cx="5" cy="5" r="3.6" /></svg>,
  '!': <svg viewBox="0 0 10 10" width="10" height="10"><path className="s heavy" d="M5 1.4v4.6M5 8.3v.3" /></svg>,
  '⚑': <svg viewBox="0 0 10 10" width="10" height="10"><path className="s" d="M2.2 9.2V1.2M2.2 1.6h5.6L6.4 3.6l1.4 2H2.2" /></svg>,
  '↝': <svg viewBox="0 0 12 10" width="12" height="10"><path className="s" d="M1 5h9M7.4 2.4 10 5 7.4 7.6" /></svg>,
  'aim-empty': <svg viewBox="0 0 12 12" width="11" height="11"><path className="s" d="M6 1.2l1.5 3 3.3.5-2.4 2.3.6 3.3L6 8.7l-3 1.6.6-3.3L1.2 4.7l3.3-.5z" /></svg>,
}
/** A family mark, by the View's own glyph; nothing for a glyph the look has no mark for. */
export const Fam = ({ glyph }: { glyph: string | null | undefined }) => <span className="fm" aria-hidden="true">{glyph == null ? null : FM[glyph] ?? null}</span>
/** A mark span (`.mk`), hidden from assistive technology: the words beside it say the same. */
export const Mk = ({ children }: { children: ReactNode }) => <span className="mk" aria-hidden="true">{children}</span>
