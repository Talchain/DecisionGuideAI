/**
 * Layer Manager - Z-Index & Portal System
 * Ensures proper stacking: canvas < panel < popovers < modals < toasts
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Z-Index Scale
export const Z_INDEX = {
  APP: 0,      // Canvas base
  PANEL: 10,   // Right panel
  POPOVER: 20, // Popovers
  MODAL: 30,   // Modals
  TOAST: 40,   // Toasts
  DEBUG: 50    // Debug overlays
} as const

interface LayerContextValue {
  openModal: (id: string, content: React.ReactNode) => void
  closeModal: (id: string) => void
  closeAllModals: () => void
  activeModalId: string | null
}

const LayerContext = createContext<LayerContextValue | null>(null)

export function useLayer() {
  const ctx = useContext(LayerContext)
  if (!ctx) throw new Error('useLayer must be used within LayerProvider')
  return ctx
}

interface Modal {
  id: string
  content: React.ReactNode
}

export function LayerProvider({ children }: { children: React.ReactNode }) {
  const [modals, setModals] = useState<Modal[]>([])
  const [portalRoot] = useState(() => {
    if (typeof document === 'undefined') return null
    let root = document.getElementById('portal-root')
    if (!root) {
      root = document.createElement('div')
      root.id = 'portal-root'
      document.body.appendChild(root)
    }
    return root
  })

  const openModal = useCallback((id: string, content: React.ReactNode) => {
    setModals(() => {
      // Close all existing modals, open new one
      return [{ id, content }]
    })
  }, [])

  const closeModal = useCallback((id: string) => {
    setModals(prev => prev.filter(m => m.id !== id))
  }, [])

  const closeAllModals = useCallback(() => {
    setModals([])
  }, [])

  const activeModalId = modals[0]?.id || null

  // Global Escape handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modals.length > 0) {
        closeModal(modals[0].id)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [modals, closeModal])

  const value: LayerContextValue = {
    openModal,
    closeModal,
    closeAllModals,
    activeModalId
  }

  return (
    <LayerContext.Provider value={value}>
      {children}
      {portalRoot && modals.map(modal => 
        createPortal(
          <ModalPortal key={modal.id} id={modal.id} onClose={() => closeModal(modal.id)}>
            {modal.content}
          </ModalPortal>,
          portalRoot
        )
      )}
    </LayerContext.Provider>
  )
}

interface ModalPortalProps {
  id: string
  onClose: () => void
  children: React.ReactNode
}

function ModalPortal({ id, onClose, children }: ModalPortalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // Focus trap
  useEffect(() => {
    const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()
  }, [])

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: Z_INDEX.MODAL }}
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Content */}
      <div
        ref={contentRef}
        className="relative bg-white rounded-lg shadow-2xl max-w-md w-full mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        {children}
      </div>
    </div>
  )
}

// Hook for modals
export function useModal() {
  const { openModal, closeModal, activeModalId } = useLayer()
  
  const show = useCallback((id: string, content: React.ReactNode) => {
    openModal(id, content)
  }, [openModal])
  
  const hide = useCallback((id: string) => {
    closeModal(id)
  }, [closeModal])
  
  return { show, hide, activeModalId }
}

// Hook for toasts (simplified - uses existing ToastContext)
export function useToast() {
  // Re-export from ToastContext
  const { showToast } = require('../canvas/ToastContext').useToast()
  return { showToast }
}

// Hook for popovers (placeholder for future)
export function usePopover() {
  return {
    open: () => {},
    close: () => {}
  }
}
