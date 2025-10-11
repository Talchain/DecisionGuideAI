// src/utils/inputGuards.ts

export function isTypingTarget(el: HTMLElement | null | undefined): boolean {
  if (!el) return false
  if (el instanceof HTMLInputElement) return true
  if (el instanceof HTMLTextAreaElement) return true
  if (el.isContentEditable) return true
  const active = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null
  if (active instanceof HTMLInputElement) return true
  if (active instanceof HTMLTextAreaElement) return true
  if (active?.getAttribute?.('contenteditable') === 'true') return true
  return false
}
