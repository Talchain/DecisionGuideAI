import { useState } from 'react'
import { useCanvasStore } from '../store'
import { useToast } from '../ToastContext'
import { BottomSheet } from './BottomSheet'
import { typography } from '../../styles/typography'

export function LayoutGuidedModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const applyGuidedLayout = useCanvasStore(s => s.applyGuidedLayout)
  const { showToast } = useToast()
  const [direction, setDirection] = useState<'LR' | 'TB'>('LR')

  const handleApply = () => {
    applyGuidedLayout({ direction })
    showToast('Layout applied — press ⌘Z to undo.', 'success')
    onClose()
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Guided Layout">
      <div className="space-y-4">
          <div>
            <label className={`block ${typography.label} mb-2`}>Direction</label>
            <div className="flex gap-2">
              <button onClick={() => setDirection('LR')} className={direction === 'LR' ? 'flex-1 px-3 py-2 bg-[#EA7B4B] text-white rounded' : 'flex-1 px-3 py-2 bg-gray-100 rounded'}>Left → Right</button>
              <button onClick={() => setDirection('TB')} className={direction === 'TB' ? 'flex-1 px-3 py-2 bg-[#EA7B4B] text-white rounded' : 'flex-1 px-3 py-2 bg-gray-100 rounded'}>Top → Bottom</button>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <button onClick={onClose} className="flex-1 px-4 py-2 border rounded">Cancel</button>
            <button onClick={handleApply} className="flex-1 px-4 py-2 bg-[#EA7B4B] text-white rounded">Apply</button>
          </div>
      </div>
    </BottomSheet>
  )
}
