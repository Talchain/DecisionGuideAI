import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Tldraw } from '@/whiteboard/tldraw'
import { ensureCanvasForDecision, loadCanvasDoc, saveCanvasDoc } from './persistence'
import { loadSeed } from './seed'
import { writeProjection } from './projection'

interface CanvasProps {
  decisionId: string
  onReady?: (info: { canvasId: string }) => void
  persistDelayMs?: number
  persistOnlyWithTldraw?: boolean
}

export const Canvas: React.FC<CanvasProps> = ({ decisionId, onReady, persistDelayMs = 500, persistOnlyWithTldraw = false }) => {
  const [canvasId, setCanvasId] = useState<string | null>(null)
  const [doc, setDoc] = useState<any | null>(null)
  const savingRef = useRef<number | null>(null)
  const editorRef = useRef<any | null>(null)
  const unsubRef = useRef<null | (() => void)>(null)

  // Preload or create
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { canvasId } = await ensureCanvasForDecision(decisionId)
        if (cancelled) return
        setCanvasId(canvasId)
        onReady?.({ canvasId })

        const existing = await loadCanvasDoc(canvasId)
        if (cancelled) return

        if (existing && existing.shapes) {
          setDoc(existing)
        } else {
          const seeded = await loadSeed(decisionId)
          if (cancelled) return
          setDoc(seeded.doc)
          // Prime persistence immediately with seed
          await saveCanvasDoc(canvasId, seeded.doc)
          await writeProjection(decisionId, seeded.doc)
        }
      } catch (e) {
        console.error('[Whiteboard] init failed', e)
      }
    })()
    return () => {
      cancelled = true
      if (savingRef.current) window.clearTimeout(savingRef.current)
    }
  }, [decisionId])

  // Persist on doc change (basic debounce)
  useEffect(() => {
    if (!canvasId || !doc) return
    if (persistOnlyWithTldraw && !(doc as any)?.tldraw) return
    if (savingRef.current) window.clearTimeout(savingRef.current)
    savingRef.current = window.setTimeout(async () => {
      await saveCanvasDoc(canvasId, doc)
      await writeProjection(decisionId, doc)
    }, persistDelayMs)
  }, [canvasId, doc, decisionId, persistDelayMs, persistOnlyWithTldraw])

  // In a fuller impl, we would connect Tldraw editor events to update `doc` when content changes.
  // Here we connect to the editor store and mirror its snapshot into doc.tldraw.
  function handleMount(editor: any) {
    editorRef.current = editor
    try {
      // Load previous snapshot if present
      const snap = (doc as any)?.tldraw
      if (snap && editor?.store?.loadSnapshot) {
        editor.store.loadSnapshot(snap)
      }
    } catch (e) {
      console.warn('[Whiteboard] loadSnapshot failed', e)
    }

    try {
      // Listen to document changes and mirror snapshot into doc
      if (unsubRef.current) unsubRef.current()
      const store = editor?.store
      if (store?.listen) {
        unsubRef.current = store.listen(() => {
          try {
            const nextSnap = store.getSnapshot ? store.getSnapshot() : store.getState?.()
            setDoc((prev: any) => (prev ? { ...prev, tldraw: nextSnap } : prev))
          } catch (e) {
            // no-op
          }
        }, { scope: 'document' })
      }
    } catch (e) {
      console.warn('[Whiteboard] store.listen failed', e)
    }
  }

  // Cleanup subscriptions and timers on unmount
  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        try { unsubRef.current() } catch {}
        unsubRef.current = null
      }
      if (savingRef.current) {
        window.clearTimeout(savingRef.current)
        savingRef.current = null
      }
    }
  }, [])

  const ui = useMemo(() => (
    <div className="relative w-full h-full">
      <Tldraw persistenceKey={`sandbox-${decisionId}`} onMount={handleMount} />
      <div className="pointer-events-none absolute top-2 right-2 bg-white/80 text-xs text-gray-700 rounded px-2 py-1 shadow">
        Scenario Sandbox (MVP)
      </div>
    </div>
  ), [decisionId])

  if (!doc) {
    return (
      <div className="w-full h-[70vh] flex items-center justify-center text-gray-600">
        Initializing canvas…
      </div>
    )
  }

  return ui
}
