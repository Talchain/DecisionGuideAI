/**
 * v10's ring on the core lane: the cards a reply's next step is about (core's `chat[].answer.next.about`) are lit, and only those. Its own
 * module, importing nothing, so the chat (in the dock's import closure) does not pull in the card components (shell-conformance).
 */

/** Light exactly these cards (v10's ring, a class on each card's own node), and only these: none, to clear. */
export function ringCards(ids: readonly string[]): void {
  if (typeof document === 'undefined') return
  document.querySelectorAll('.react-flow__node.v10-lit').forEach((el) => el.classList.remove('v10-lit'))
  for (const id of ids) document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`)?.classList.add('v10-lit')
}
