import { create } from 'zustand'
import type { FocusSubject } from './subject'

export const useStoredFocusSubject = create<{ subject: FocusSubject }>(() => ({ subject: null }))
