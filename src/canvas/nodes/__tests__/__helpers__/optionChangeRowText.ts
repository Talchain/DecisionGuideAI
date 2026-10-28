/**
 * ⭐ FIND AN OPTION CARD'S CHANGE ROW BY ITS VALUE TEXT — ONE DEFINITION.
 *
 * Contract v3.1 OPT-03 tones the two halves of a `from → to` row differently:
 * the "from" value is a muted `<span>`, the arrow and target stay ink. So the
 * row's `<dd>` no longer holds `"40% → 80%"` as ONE text node, and Testing
 * Library's default `getByText('40% → 80%')` — which reads an element's OWN
 * text nodes only — stops finding it. Worse, every NEGATIVE form
 * (`queryByText('40% → 80%')).toBeNull()`) would go VACUOUSLY green: it would
 * pass whether or not the card rendered that change.
 *
 * This matcher binds by IDENTITY instead of by text-node shape: the element
 * must be the change row's own `<dd>` (`data-testid="option-change-row-<option>-<factor>"`),
 * and its value text — everything EXCEPT the source-mark cluster
 * (`option-change-row-mark-*`) — must equal `change` exactly. The value text of
 * the `<dd>` is byte-identical to `OptionChangeRow.change`, so a spec asserts
 * the same string it always did, however the halves are styled.
 *
 * ⚠ NOT A `.spec.` FILE, deliberately (see `canvasCopyHonesty.ts`): the
 * vitest include glob would collect it as a suite.
 */

/** The value text of a change-row `<dd>`: its content less the target's source-mark cluster (vision I: the mark
 * now LEADS the target, inside the value, so it is skipped wherever it sits rather than read up to). */
export function changeRowValueText(dd: Element): string {
  const read = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent ?? ''
    if (node.nodeType !== 1) return ''
    if (((node as Element).getAttribute('data-testid') ?? '').startsWith('option-change-row-mark-')) return ''
    return Array.from(node.childNodes).map(read).join('')
  }
  return Array.from(dd.childNodes).map(read).join('').replace(/\s+/g, ' ').trim()
}

function isChangeRowDd(el: Element | null): el is Element {
  if (!el || el.tagName !== 'DD') return false
  const id = el.getAttribute('data-testid') ?? ''
  return id.startsWith('option-change-row-') &&
    !id.startsWith('option-change-row-mark-') &&
    !id.startsWith('option-change-row-before-')
}

/**
 * A Testing Library text matcher: `screen.getByText(changeRow('40% → 80%'))`.
 * A RegExp is tested against the value text instead of an exact string.
 */
export function changeRow(change: string | RegExp) {
  return (_content: string, el: Element | null): boolean =>
    isChangeRowDd(el) &&
    (typeof change === 'string'
      ? changeRowValueText(el) === change
      : change.test(changeRowValueText(el)))
}

/**
 * W8 c7.1 (acceptance 27 Oct: one card said "From your brief" twice in a row): the card's bottom row says each source of
 * its targets ONCE. The first row of a source carries the mark (`option-change-row-source-*` / `-estimate-*`); a later row
 * from the same source carries none, and the first row's mark names it ("A and B targets: …"). This returns the mark that
 * covers one row: its own, else the one that names it. Null when no mark covers it.
 */
export function sourceMarkCovering(root: ParentNode, optionId: string, factorId: string, rowLabel: string): HTMLElement | null {
  const own = root.querySelector<HTMLElement>(
    `[data-testid="option-change-row-source-${optionId}-${factorId}"], [data-testid="option-change-row-estimate-${optionId}-${factorId}"]`)
  if (own) return own
  return Array.from(root.querySelectorAll<HTMLElement>(
    `[data-testid^="option-change-row-source-${optionId}-"], [data-testid^="option-change-row-estimate-${optionId}-"]`))
    .find(m => / targets: /.test(m.getAttribute('aria-label') ?? '') && (m.getAttribute('aria-label') ?? '').includes(rowLabel)) ?? null
}
