import { useEffect, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'

interface HelpMenuProps {
  onShowOnboarding: () => void
  onShowKeyboardLegend: () => void
  onShowInfluenceExplainer: () => void
}

interface MenuItem {
  label: string
  description: string
  action: () => void
}

export function HelpMenu({ onShowOnboarding, onShowKeyboardLegend, onShowInfluenceExplainer }: HelpMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return
      const target = event.target as Node
      if (!menuRef.current.contains(target) && !buttonRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleToggle = () => setIsOpen(prev => !prev)

  const handleAction = (action: () => void) => {
    action()
    setIsOpen(false)
  }

  const menuItems: MenuItem[] = [
    {
      label: 'Show onboarding tour',
      description: 'Replay the multi-step walkthrough',
      action: onShowOnboarding
    },
    {
      label: 'Keyboard legend',
      description: 'See every shortcut (also ? key)',
      action: onShowKeyboardLegend
    },
    {
      label: 'Influence explainer',
      description: 'Understand weight vs belief',
      action: onShowInfluenceExplainer
    }
  ]

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border border-gray-200 shadow-sm text-sm font-medium text-gray-800 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="canvas-help-menu"
      >
        <HelpCircle className="w-4 h-4" aria-hidden="true" />
        Help
      </button>

      {isOpen && (
        <div
          id="canvas-help-menu"
          role="menu"
          aria-label="Canvas help"
          className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-[1100]"
        >
          <p className="px-4 pb-2 text-xs uppercase tracking-wide text-gray-500">Need a refresher?</p>
          <div className="flex flex-col">
            {menuItems.map(item => (
              <button
                key={item.label}
                role="menuitem"
                onClick={() => handleAction(item.action)}
                className="text-left px-4 py-3 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span className="block text-sm font-semibold text-gray-900">{item.label}</span>
                <span className="block text-xs text-gray-600">{item.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
