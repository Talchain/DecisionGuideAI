/**
 * Skeleton - Branded loading placeholder
 *
 * Design: Sand-200 background with sand-100 shimmer animation
 * Usage: Content placeholders, loading skeletons, lazy-loaded sections
 */

interface SkeletonProps {
  width?: string
  height?: string
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
}

export function Skeleton({
  width,
  height,
  className = '',
  variant = 'rectangular'
}: SkeletonProps) {
  const baseClasses = 'bg-sand-200 animate-pulse'
  const variantClasses = {
    text: 'rounded h-3',
    circular: 'rounded-full',
    rectangular: 'rounded',
  }

  const style: React.CSSProperties = {
    ...(width && { width }),
    ...(height && { height }),
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
      aria-hidden="true"
      data-testid="skeleton"
    />
  )
}

/**
 * SkeletonGroup - Multiple skeleton lines for text blocks
 */
interface SkeletonGroupProps {
  lines?: number
  className?: string
}

export function SkeletonGroup({ lines = 3, className = '' }: SkeletonGroupProps) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? '66%' : '100%'}
        />
      ))}
    </div>
  )
}
