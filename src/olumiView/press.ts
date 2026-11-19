/**
 * Typed fields 13a and 13b, the UI half (CONTRACT ~/olumi-work/claude-checks/overnight-20261117/dl-takeover/typed-fields/CONTRACT.md; Codex
 * ROOT 02:53:03Z GO_WITH_CHANGES; UI lead's UI-READ.md).
 *
 * - 13a `ask`: how a saved chat turn was asked (core's job row), on `chat[]`. 'challenge' or 'method' is a press of the page's own template,
 *   drawn as the "Asked with a method" chrome, never as words the person typed.
 * - 13b `press`: a message sent by a press on the canvas, `{ kind, card, label }`, on `chat[]`, `turn` and unanswered `floor[]` rows. The
 *   person's row draws core's `label` and the pressed card's heading, never `said` as typed words.
 *
 * Every field is read by its type, and an absent or unreadable field is an older core: today's behaviour. No words here but core's.
 */
import type { View } from './client'

export type PressKind = 'explain' | 'ask_about'
export type TurnPress = { readonly kind: PressKind; readonly card: string | null; readonly label: string }
export type AskKind = 'message' | 'challenge' | 'method' | 'move' | 'consider'
const ASK_KINDS: readonly AskKind[] = ['message', 'challenge', 'method', 'move', 'consider']

/** Core's `press` on a turn-like row, by type; null when absent or not of the contract's shape. */
export function pressFieldOf(row: unknown): TurnPress | null {
  const p = row !== null && typeof row === 'object' ? (row as { press?: unknown }).press : undefined
  if (p === null || typeof p !== 'object') return null
  const { kind, card, label } = p as { kind?: unknown; card?: unknown; label?: unknown }
  if (kind !== 'explain' && kind !== 'ask_about') return null
  if (card !== null && (typeof card !== 'string' || card === '')) return null
  if (typeof label !== 'string' || label.trim() === '') return null
  return { kind, card, label }
}

/** Core's `ask` on a saved chat turn (13a), by type; null when absent. */
export function askFieldOf(row: unknown): AskKind | null {
  const a = row !== null && typeof row === 'object' ? (row as { ask?: unknown }).ask : undefined
  return typeof a === 'string' && (ASK_KINDS as readonly string[]).includes(a) ? (a as AskKind) : null
}

/** The pressed card's heading in the model this reader is shown (core already nulls a card the reader's model lacks); null without one. */
export function pressHeading(p: TurnPress, view: Pick<View, 'model'> | null): string | null {
  if (p.card === null) return null
  const card = view?.model?.cards.find((c) => c.id === p.card)
  return card === undefined || card.heading.trim() === '' ? null : card.heading
}

/** Team's "Ask Olumi about this difference": a template control, named by its own chip id. */
export const TEAM_DIFFERENCE_CHIP = 'team:ask-difference'
/**
 * The template controls that declare a press, by chip id (Codex ROOT 03:07:18Z; the UI lead's rule, 19 Nov): nothing else is ever a press.
 * A message with no chip, or one whose chip is not listed, or edited words, is an ordinary message that shows its words.
 */
export const PRESS_CHIPS: Readonly<Record<string, PressKind>> = { 'ask:explain': 'explain', [TEAM_DIFFERENCE_CHIP]: 'ask_about' }

/** The press the page sends with a press's words (13b): the listed chip's kind, only with exactly one card as `about`; never inferred. */
export function pressKindFor(chip: string, record: string | null): PressKind | null {
  return record === null ? null : PRESS_CHIPS[chip] ?? null
}
