// Flag-gated, behaviour-neutral submit hook for PLoT‑lite
// This does not change UI behaviour; it quietly fires only when the flag is ON.

import { flags } from '../flags'
import { postDraftFlows } from './client'

export async function onSubmitDescribeDecision(parseText: string): Promise<void> {
  // Keep existing behaviour first; this helper only adds a guarded side-call.
  const seed = 1
  const text = (parseText ?? '').trim()
  if (!flags.plotLite.enabled || !text) return

  // Fire-and-forget; swallow errors to keep behaviour identical
  void postDraftFlows({ seed, parse_text: text }).catch(() => {})
}
