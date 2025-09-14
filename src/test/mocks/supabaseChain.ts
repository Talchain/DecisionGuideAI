import { vi } from 'vitest'

export type ChainResult<T = any> = Promise<{ data: T; error: any }>

export type TableState = {
  limitResult?: { data: any; error: any }
  maybeSingleResult?: { data: any; error: any }
  singleResult?: { data: any; error: any }
  insertImpl?: (...args: any[]) => ChainResult
  upsertImpl?: (...args: any[]) => ChainResult
}

export function chainableTable(init?: TableState) {
  const state: TableState = { ...init }
  const table: any = {}
  table.select = vi.fn(() => table)
  table.eq = vi.fn(() => table)
  table.order = vi.fn(() => table)
  table.limit = vi.fn(async () => state.limitResult ?? { data: [], error: null })
  table.maybeSingle = vi.fn(async () => state.maybeSingleResult ?? { data: null, error: null })
  table.single = vi.fn(async () => state.singleResult ?? { data: null, error: null })
  table.insert = state.insertImpl ?? vi.fn(async () => ({ data: null, error: null }))
  table.upsert = state.upsertImpl ?? vi.fn(async () => ({ data: null, error: null }))
  table.__set = (patch: Partial<TableState>) => Object.assign(state, patch)
  table.__getState = () => ({ ...state })
  return table
}

export function makeSupabase(tables: Record<string, any>) {
  return {
    from: (name: string) => tables[name] || chainableTable(),
  }
}
