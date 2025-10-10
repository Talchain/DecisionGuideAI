// src/poc/io/validate.ts
import Ajv from 'ajv'
import { samStateSchema } from './schema'

const ajv = new Ajv({ allErrors: true, removeAdditional: 'all', coerceTypes: true })
const validate = ajv.getSchema(samStateSchema.$id!) || ajv.compile(samStateSchema as any)

export function validateState(input: unknown): { ok: boolean; data?: any; errors?: string[] } {
  const data = input as any
  const ok = (validate as any)(data) as boolean
  if (ok) return { ok: true, data }
  const errors = ((validate as any).errors || []).map((e: any) => `${e.instancePath || e.dataPath || '(root)'} ${e.message}`)
  return { ok: false, errors }
}
