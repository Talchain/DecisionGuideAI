/**
 * ⭐⭐ ONE OWNER FOR "WHICH ELEMENT IS THE PANEL'S CONTENT COLUMN".
 *
 * Two specs ask it — `thePanelCannotRegrow` (how many top-level blocks are
 * there?) and `everySectionBelongsToAZone` (is each of them in a zone?) — and
 * they are different questions, so they stay separate files. What they must
 * NOT do is each keep their own copy of the traversal.
 *
 * ⛔ THE TRAP IS NAMED IN `thePanelCannotRegrow`'S OWN DOCBLOCK, and it is the
 * reason this is shared rather than retyped: the element carrying
 * `analysis-new-tab-body` is the SCROLL CONTAINER and has exactly ONE child.
 * A traversal pointed at it reads 1 for every panel that has ever existed —
 * it passes every ceiling, and it would report every section as correctly
 * zoned, because there would be only one child and it would be a zone group.
 * **The wrong element makes both specs pass while measuring nothing.** A copy
 * of this that drifts is therefore not a tidiness problem; it is a guard that
 * silently stops guarding.
 */
import { screen } from '@testing-library/react'

/** The tab's CONTENT column — the scroll container's only child. */
export function contentColumn(): HTMLElement {
  const root = screen.getByTestId('analysis-new-tab-body')
  const column = root.firstElementChild
  if (column === null) throw new Error('tab body rendered no content column')
  return column as HTMLElement
}

/** Direct children of the content column that produced DOM on this run. */
export function topLevelBlockElements(): HTMLElement[] {
  return Array.from(contentColumn().children).filter((el) => el.textContent !== '') as HTMLElement[]
}
