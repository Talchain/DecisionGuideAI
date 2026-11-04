/**
 * v10: ways to test the model, above the composer. Each fills the box with a method prefix for the person to finish
 * and edit before sending; nothing is sent. Shown only in the v10 presentation (#/canvas2).
 */
import { memo } from 'react'
import { Zap, ArrowLeftRight, Search, Globe, Split, AlertCircle, Scale, Target, NotebookPen, type LucideIcon } from 'lucide-react'
import { ICON_STROKE } from '../canvas/conversation/panelIcons'
import { typography } from '../styles/typography'

/** The four methods, in order: each one's chip id, label and the prefix it puts in the box. */
export const V10_METHODS = [
  { key: 'assumption', label: 'Challenge it', prefix: 'Challenge it: ', Icon: Zap },
  { key: 'opposite', label: 'The opposite', prefix: 'Argue the opposite of: ', Icon: ArrowLeftRight },
  { key: 'disconfirming', label: 'What would disprove it', prefix: 'What would disprove: ', Icon: Search },
  { key: 'outside', label: 'Outside view', prefix: 'Outside view on: ', Icon: Globe },
] as const

const PREFIXES = V10_METHODS.map((m) => m.prefix)

/** Keeps what the person already wrote and swaps only the method prefix. */
export function withMethodPrefix(prefix: string, current: string): string {
  const rest = PREFIXES.reduce((t, p) => (t.startsWith(p) ? t.slice(p.length) : t), current)
  return prefix + rest
}

export const V10MethodChips = memo(function V10MethodChips({ value, onReplace }: { value: string; onReplace: (text: string) => void }) {
  return (
    <div role="group" aria-label="Ways to test the model" className="flex flex-wrap" style={{ gap: 6, padding: '0 2px 8px' }} data-testid="v10-method-chips">
      {V10_METHODS.map(({ key, label, prefix, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onReplace(withMethodPrefix(prefix, value))}
          className={`${typography.panelBody} inline-flex items-center rounded-full bg-panel text-text-body hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2`}
          style={{ gap: 5, padding: '4px 10px', border: '1px solid var(--border-default, #EEE6D8)' }}
          data-testid={`v10-method-${key}`}
        >
          <Icon aria-hidden="true" size={13} strokeWidth={ICON_STROKE} />
          {label}
        </button>
      ))}
    </div>
  )
})

/** The coach's moves (olumi-core `form.ts` MOVES), as core names them in a reply's `next.move`. */
export type CoachMove = 'widen_options' | 'outside_view' | 'pre_mortem' | 'what_would_change_your_mind' | 'define_success' | 'gather_evidence' | 'other_method'

type MoveChip = { readonly label: string; readonly prefix: string; readonly Icon: LucideIcon }

/**
 * One chip per coach move Olumi can point the person to, the same look and grammar as the composer's methods: a press puts the move's
 * prefix in the composer for the person to finish, and sends nothing. `other_method` has no chip: it names no one move.
 */
export const V10_MOVES: Readonly<Record<Exclude<CoachMove, 'other_method'>, MoveChip>> = {
  widen_options: { label: 'Widen the options', prefix: 'Another option we could consider: ', Icon: Split },
  outside_view: { label: 'Outside view', prefix: 'Outside view on: ', Icon: Globe },
  pre_mortem: { label: 'Imagine it failed', prefix: 'Imagine it failed. The likeliest reason: ', Icon: AlertCircle },
  what_would_change_your_mind: { label: 'What would change my mind', prefix: 'What would change my mind: ', Icon: Scale },
  define_success: { label: 'Define success', prefix: 'Success would look like: ', Icon: Target },
  gather_evidence: { label: 'Bring evidence', prefix: 'Evidence on this: ', Icon: NotebookPen },
}

/** The chip for a reply's next move (core's `next.move`); nothing for a move with no chip. `onPick` gets the prefix; nothing is sent. */
export function V10MoveChip({ move, onPick }: { move: string | null | undefined; onPick: (prefix: string) => void }) {
  const chip = move != null && Object.prototype.hasOwnProperty.call(V10_MOVES, move) ? V10_MOVES[move as keyof typeof V10_MOVES] : null
  if (chip === null) return null
  const { label, prefix, Icon } = chip
  return (
    <button
      type="button"
      onClick={() => onPick(prefix)}
      className={`${typography.panelBody} inline-flex items-center rounded-full bg-panel text-text-body hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2`}
      style={{ gap: 5, padding: '4px 10px', border: '1px solid var(--border-default)' }}
      data-testid={`v10-move-${move}`}
    >
      <Icon aria-hidden="true" size={13} strokeWidth={ICON_STROKE} />
      {label}
    </button>
  )
}

