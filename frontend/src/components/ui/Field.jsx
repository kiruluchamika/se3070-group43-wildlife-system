import { ChevronDown } from 'lucide-react'
import { useId } from 'react'
import { cn } from '../../lib/cn'

const controlClass =
  'w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-sm text-fg placeholder:text-subtle transition duration-200 outline-none hover:border-brand-500/50 focus:border-brand-400 focus:ring-4 focus:ring-brand-400/15 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-red-400 aria-invalid:ring-red-400/15'

/** Label, control, hint and error wired together for screen readers. */
export function Field({ label, hint, error, required, className, children }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-semibold tracking-wide text-muted uppercase">
          {label}
          {required && <span className="ml-0.5 text-red-400">*</span>}
        </label>
      )}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red-500 dark:text-red-300">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-subtle">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export function Input({ className, ...props }) {
  return <input className={cn(controlClass, 'h-11', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <div className="relative">
      <select className={cn(controlClass, 'h-11 cursor-pointer appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
    </div>
  )
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(controlClass, 'min-h-24 resize-y py-3', className)} {...props} />
}
