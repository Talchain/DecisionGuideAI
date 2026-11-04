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

/** Each move's icon (v10's look). `other_method` names no one move, so it has no chip. The words are core's (`next.label`), never here. */
export const V10_MOVE_ICONS: Readonly<Record<Exclude<CoachMove, 'other_method'>, LucideIcon>> = {
  widen_options: Split,
  outside_view: Globe,
  pre_mortem: AlertCircle,
  what_would_change_your_mind: Scale,
  define_success: Target,
  gather_evidence: NotebookPen,
}

/**
 * The chip for a reply's next move: its icon by the move core names, and core's label for it (`next.label`) verbatim. A press calls
 * `onPress` with nothing typed; the caller sends the person's choice ({ move, at }). Nothing is drawn for a move with no chip.
 */
export function V10MoveChip({ move, label, onPress }: { move: string | null | undefined; label: string; onPress: () => void }) {
  const Icon = move != null && Object.prototype.hasOwnProperty.call(V10_MOVE_ICONS, move) ? V10_MOVE_ICONS[move as keyof typeof V10_MOVE_ICONS] : null
  if (Icon === null) return null
  return (
    <button
      type="button"
      onClick={() => onPress()}
      className={`${typography.panelBody} inline-flex items-center rounded-full bg-panel text-text-body hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2`}
      style={{ gap: 5, padding: '4px 10px', border: '1px solid var(--border-default)' }}
      data-testid={`v10-move-${move}`}
    >
      <Icon aria-hidden="true" size={13} strokeWidth={ICON_STROKE} />
      {label}
    </button>
  )
}
