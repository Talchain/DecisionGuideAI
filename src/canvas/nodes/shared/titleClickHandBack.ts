// ⭐ A card title's clicks stay local through a double-click (PR Review on #2318, 5895008733): see `BaseNode`'s
// `onTitleClick`. A lone click is handed back to the card once the double-click window has passed.

/**
 * How long a click on a card's title waits for a second click before it is handed to the card as an ordinary card
 * click. Long enough for an ordinary double-click; short enough that a lone click on the title still feels immediate.
 */
export const TITLE_DOUBLE_CLICK_WINDOW_MS = 300

/**
 * Re-issue a lone title click on the card element (`.react-flow__node`), where React Flow's own node handler reads
 * it: selection and `onNodeClick` then behave exactly as for a click anywhere else on the card. The click is issued
 * on the card itself, above the title, so it never re-enters the title's handler.
 */
export function handTitleClickToCard(card: Element | null, init: MouseEventInit): void {
  if (!card || !card.isConnected) return
  card.dispatchEvent(new MouseEvent('click', init))
}
