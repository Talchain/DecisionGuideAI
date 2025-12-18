// src/poc/io/validate.ts
// Uses pre-compiled Ajv validator to avoid runtime new Function() that violates CSP

import { validateSamState } from '../../generated/validators'

export function validateState(input: unknown): { ok: boolean; data?: any; errors?: string[] } {
  const data = input as any
  const ok = validateSamState(data) as boolean
  if (ok) return { ok: true, data }
  const errors = (validateSamState.errors || []).map((e: any) => `${e.instancePath || e.dataPath || '(root)'} ${e.message}`)
  return { ok: false, errors }
}
