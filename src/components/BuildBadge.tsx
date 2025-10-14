import { useEffect, useState } from 'react'

type Ver = { commit?: string; short?: string; branch?: string; timestamp?: string }

export default function BuildBadge() {
  const [v, setV] = useState<Ver>({})
  useEffect(() => {
    fetch('/version.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : {})
      .then(setV).catch(() => {})
    console.log('[BOOT] plot', {
      PLC_LAB: String(import.meta.env?.VITE_PLC_LAB),
      POC_ONLY: String(import.meta.env?.VITE_POC_ONLY),
      PLOT_PLC_CANVAS: String(import.meta.env?.VITE_FEATURE_PLOT_USES_PLC_CANVAS)
    })
  }, [])
  return (
    <div style={{
      position:'fixed', top:8, right:8, zIndex:9999,
      padding:'4px 8px', borderRadius:6, fontSize:11,
      background:'#0ea5e9', color:'#fff', boxShadow:'0 2px 6px rgba(0,0,0,.15)'
    }}>
      <strong>BUILD</strong>&nbsp;{v.short ?? '—'} · {v.branch ?? '—'} · {v.timestamp?.replace('T',' ').replace('Z',' UTC') ?? '—'}
      <div style={{opacity:.9, marginTop:2}}>
        PLC_LAB={String(import.meta.env?.VITE_PLC_LAB)} ·
        POC_ONLY={String(import.meta.env?.VITE_POC_ONLY)} ·
        PLOT_PLC_CANVAS={String(import.meta.env?.VITE_FEATURE_PLOT_USES_PLC_CANVAS)}
      </div>
    </div>
  )
}
