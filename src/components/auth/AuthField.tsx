/**
 * AuthField: the labelled input every sign-in surface uses.
 *
 * Design System v5 §8.2/§8.3: visible 14px label, 4px gap, 44px input with a
 * 12px radius and the neutral 16% ink border, info focus ring, and an error
 * line led by a 14px Lucide AlertTriangle. Password fields carry a show/hide
 * control, so nobody has to retype a long password to find one typo.
 */

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { typography } from '../../styles/typography'

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string
  /** Optional control on the right of the label row (e.g. "Forgot password?"). */
  labelAction?: ReactNode
  error?: ReactNode
  errorTestId?: string
  hint?: ReactNode
}

const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, labelAction, error, errorTestId, hint, type = 'text', id, ...inputProps },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = `${inputId}-desc`
  const isPassword = type === 'password'
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className={`${typography.label} text-text-header`}>
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={isPassword && revealed ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? describedBy : undefined}
          {...inputProps}
          className={`w-full min-h-[44px] rounded-md border bg-panel px-4 py-3 ${typography.body} text-text-body placeholder:text-text-light transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-info disabled:opacity-50 ${
            isPassword ? 'pr-12' : ''
          } ${error ? 'border-danger' : 'border-[rgba(38,38,38,0.16)] hover:border-[rgba(38,38,38,0.28)]'}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed(r => !r)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-1 my-auto flex h-9 w-9 items-center justify-center rounded-sm text-text-light transition-colors duration-fast hover:text-text-body focus:outline-none focus:ring-2 focus:ring-info"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p
          id={describedBy}
          role="alert"
          data-testid={errorTestId}
          className={`${typography.bodySmall} flex items-start gap-1.5 text-danger`}
        >
          <AlertTriangle className="mt-[3px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={describedBy} className={`${typography.bodySmall} text-text-light`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
})

export default AuthField
