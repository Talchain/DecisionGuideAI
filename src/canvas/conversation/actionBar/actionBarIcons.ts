/**
 * The icons an action bar offer may name. CEE sends the lucide NAME (the bar is
 * the presenter contract); a bundle cannot import an icon by a runtime string,
 * so the names it can draw are held here. A name this build does not hold gets
 * the generic glyph and a warning: the offer still shows, with its label.
 */
import {
  Anchor,
  ArrowDownUp,
  BadgeCheck,
  CalendarClock,
  Circle,
  ClipboardList,
  FileText,
  Frame,
  GitFork,
  Globe,
  ListChecks,
  Scale,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Unlink,
} from 'lucide-react'
import type { ComponentType } from 'react'

export type ActionGlyph = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>

export const ACTION_BAR_ICONS: Readonly<Record<string, ActionGlyph>> = {
  Anchor,
  ArrowDownUp,
  BadgeCheck,
  CalendarClock,
  ClipboardList,
  FileText,
  Frame,
  GitFork,
  Globe,
  ListChecks,
  Scale,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Unlink,
}

export const ACTION_BAR_FALLBACK_ICON: ActionGlyph = Circle

const warned = new Set<string>()

export function actionGlyph(name: string): ActionGlyph {
  const glyph = Object.prototype.hasOwnProperty.call(ACTION_BAR_ICONS, name) ? ACTION_BAR_ICONS[name] : undefined
  if (glyph) return glyph
  if (!warned.has(name)) {
    warned.add(name)
    console.warn('[action_bar] unknown icon', name)
  }
  return ACTION_BAR_FALLBACK_ICON
}
