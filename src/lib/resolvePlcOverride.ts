export type PlcOverrideSource = 'url' | 'localStorage' | 'env'
export type PlcOverrideResult = { usePlc: boolean; source: PlcOverrideSource }

const parseBool = (v: string | null | undefined) => v === '1'

// Support hash routes like /#/plot?plc=1
const readSearchParams = (loc: Location): URLSearchParams => {
  const raw = loc.hash.includes('?') ? loc.hash.split('?')[1] : loc.search.slice(1)
  return new URLSearchParams(raw)
}

/**
 * Precedence (highest → lowest):
 *  1) URL (?plc=1|0) — works with hash routes
 *  2) localStorage.PLOT_USE_PLC ("1"|"0")
 *  3) env VITE_FEATURE_PLOT_USES_PLC_CANVAS ("1"|"0")
 */
export function resolvePlcOverride(win: Window | undefined): PlcOverrideResult {
  // SSR default → env
  if (!win) {
    return {
      usePlc: parseBool(import.meta.env.VITE_FEATURE_PLOT_USES_PLC_CANVAS as string),
      source: 'env',
    }
  }

  // 1) URL
  try {
    const sp = readSearchParams(win.location)
    const plc = sp.get('plc')
    if (plc === '1' || plc === '0') return { usePlc: plc === '1', source: 'url' }
  } catch { /* ignore */ }

  // 2) localStorage
  try {
    const ls = win.localStorage?.getItem('PLOT_USE_PLC')
    if (ls === '1' || ls === '0') return { usePlc: ls === '1', source: 'localStorage' }
  } catch { /* ignore */ }

  // 3) env
  return {
    usePlc: parseBool(import.meta.env.VITE_FEATURE_PLOT_USES_PLC_CANVAS as string),
    source: 'env',
  }
}
