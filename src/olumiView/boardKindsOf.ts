import { DEFAULT_THINKING_KINDS } from '../canvas/conversation/zones/ThinkingIndicator'
import type { View } from './client'
import type { DsKind } from './v12/cards/kind'
import { cardDsKindOf, cardKind } from './v12/fields/fields'

const BOARD_KIND_ORDER: readonly DsKind[] = [...DEFAULT_THINKING_KINDS, 'constraint']

export function boardKindsOf(view: View | null | undefined): readonly DsKind[] {
  const model = view?.model
  if (model == null || model.cards.length === 0) return DEFAULT_THINKING_KINDS

  const kinds = new Set(model.cards.map((card) => cardDsKindOf(cardKind(card, model, view))))
  return BOARD_KIND_ORDER.filter((kind) => kinds.has(kind))
}
