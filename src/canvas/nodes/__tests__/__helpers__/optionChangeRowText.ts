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
 * and its value text — everything BEFORE the source-mark cluster
 * (`option-change-row-mark-*`) — must equal `change` exactly. The value text of
 * the `<dd>` is byte-identical to `OptionChangeRow.change`, so a spec asserts
 * the same string it always did, however the halves are styled.
 *
 * ⚠ NOT A `.spec.` FILE, deliberately (see `canvasCopyHonesty.ts`): the
 * vitest include glob would collect it as a suite.
 */

/** The value text of a change-row `<dd>`: its content before the source mark. */
export function changeRowValueText(dd: Element): string {
  let out = ''
  for (const child of Array.from(dd.childNodes)) {
    if (
      child.nodeType === 1 &&
      ((child as Element).getAttribute('data-testid') ?? '').startsWith('option-change-row-mark-')
    ) break
    out += child.textContent ?? ''
  }
  return out.replace(/\s+/g, ' ').trim()
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
