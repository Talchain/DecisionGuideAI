// src/poc/utils/inputGuards.ts
// PoC-only typing target guard to avoid triggering shortcuts when typing

export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false
  const tag = (el as HTMLElement).tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  const editable = (el as HTMLElement).getAttribute?.('contenteditable')
  return editable === '' || editable === 'true'
}
