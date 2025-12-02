/**
 * Card - Container component for grouped content
 *
 * Provides consistent spacing and visual hierarchy
 */

export interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className = '', padding = 'md' }: CardProps): JSX.Element {
  const paddingStyles: Record<NonNullable<CardProps['padding']>, string> = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  return (
    <div className={`bg-white border border-storm-200 rounded-lg ${paddingStyles[padding]} ${className}`}>
      {children}
    </div>
  )
}
