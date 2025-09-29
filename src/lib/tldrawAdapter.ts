// src/lib/tldrawAdapter.ts
// Lazy TLdraw adapter: attempts to import '@tldraw/tldraw'. If unavailable, throws so caller can fallback to shim.
// Exposes a minimal CanvasAPI compatible surface: addNote, clear, exportSnapshot, importSnapshot.

export type CanvasAPI = {
  addNote: (text: string) => void
  clear: () => void
  exportSnapshot: () => string
  importSnapshot: (json: string) => void
}

const SNAP_KEY = 'canvas.snapshot'

function readLS(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}
function writeLS(key: string, val: string | null) {
  try { if (val == null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, val) } catch {}
}

export async function createTldrawCanvas(surface: HTMLDivElement | null, autosave: boolean): Promise<CanvasAPI> {
  // Ensure TLdraw is present; if not, signal missing so caller can fallback.
  try {
    const spec = '@tldraw/tldraw'
    // Avoid pre-bundling when package is absent
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await import(/* @vite-ignore */ spec)
  } catch {
    throw new Error('TLDRAW_MISSING')
  }

  // Very lightweight DOM-based adapter placeholder; in a real integration we would mount TLdraw here.
  const host = surface || document.createElement('div')
  host.innerHTML = ''
  try { host.setAttribute('data-testid', 'tldraw-surface') } catch {}
  const list = document.createElement('ul')
  list.setAttribute('data-testid', 'tldraw-notes')
  list.style.fontSize = '12px'
  list.style.listStyle = 'none'
  list.style.padding = '0'
  host.appendChild(list)

  let notes: string[] = []
  if (autosave) {
    try {
      const snap = readLS(SNAP_KEY)
      if (snap) {
        const data = JSON.parse(snap)
        if (Array.isArray(data?.notes)) notes = data.notes.map(String)
      }
    } catch {}
  }

  const render = () => {
    list.innerHTML = ''
    for (const n of notes) {
      const li = document.createElement('li')
      li.textContent = n
      li.setAttribute('data-testid', 'tldraw-note')
      li.style.border = '1px solid #e5e7eb'
      li.style.padding = '6px'
      li.style.marginBottom = '6px'
      li.style.borderRadius = '4px'
      li.style.background = '#fff'
      list.appendChild(li)
    }
  }
  render()

  const api: CanvasAPI = {
    addNote: (text: string) => {
      notes.push(String(text))
      if (autosave) writeLS(SNAP_KEY, JSON.stringify({ notes }))
      render()
    },
    clear: () => {
      notes = []
      if (autosave) writeLS(SNAP_KEY, JSON.stringify({ notes }))
      render()
    },
    exportSnapshot: () => JSON.stringify({ notes }),
    importSnapshot: (json: string) => {
      try {
        const data = JSON.parse(json)
        if (Array.isArray(data?.notes)) {
          notes = data.notes.map(String)
          if (autosave) writeLS(SNAP_KEY, JSON.stringify({ notes }))
          render()
        }
      } catch {}
    },
  }

  return api
}
