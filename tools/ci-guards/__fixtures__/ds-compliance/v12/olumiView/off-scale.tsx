// One offence per V12 rule (the guard's positive control). A comment naming font-semibold, rounded-xl or ✎ is not scanned.
export const a = <p className="text-base">size</p>
export const b = <p className="text-[13px]">size</p>
export const c = <p style={{ fontSize: 16 }}>size</p>
export const d = <p className="font-semibold">weight</p>
export const e = <p style={{ fontWeight: 600 }}>weight</p>
export const f = <p className="font-mono">family</p>
export const g = <p style={{ color: 'rgba(0, 0, 0, 0.5)' }}>colour</p>
export const h = <p className="border border-border">colour</p>
export const i = <p className="rounded-xl">radius</p>
export const j = <p className="rounded">radius</p>
export const k = <p style={{ borderRadius: 4 }}>radius</p>
export const l = <span aria-hidden="true">✎</span>
