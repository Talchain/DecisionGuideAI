/**
 * Icon rendering helper - handles strings, Lucide components, and React nodes
 */
import type { LucideIcon } from 'lucide-react'
import { isValidElement } from 'react'

export function renderIcon(icon: string | LucideIcon | React.ReactNode, size = 16): React.ReactNode {
  if (!icon) return null
  
  // String (emoji or text)
  if (typeof icon === 'string') {
    return <span aria-hidden="true">{icon}</span>
  }
  
  // Already a React element
  if (isValidElement(icon)) {
    return icon
  }
  
  // Lucide component constructor
  const IconComponent = icon as LucideIcon
  return <IconComponent size={size} strokeWidth={2} aria-hidden="true" />
}
