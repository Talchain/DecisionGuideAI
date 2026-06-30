import type { ChatComposerHandle } from './zones/ChatComposer'

/**
 * Route a prefill to the visible composer.
 *
 * The legacy ChatComposer, when mounted, owns the textarea — set it directly via
 * its ref. Under aiPanelV2 (`hideComposer`) that composer is NOT mounted and the
 * visible composer is AIInputBar, which is bound to ConversationContext `draft` —
 * so write the draft instead. Writing to the (null) composer ref was the silent
 * no-op behind the "AI panel opens but nothing appears" prefill bug (inspector
 * "Ask about this", analysis-hero prefills). Either path is replace semantics,
 * matching the legacy `replaceText` behaviour.
 */
export function prefillInto(
  composer: Pick<ChatComposerHandle, 'replaceText'> | null,
  setDraft: ((text: string) => void) | undefined,
  text: string,
): void {
  if (composer) composer.replaceText(text)
  else setDraft?.(text)
}
