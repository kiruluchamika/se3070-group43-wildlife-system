import { motion } from 'motion/react'
import { cn } from '../../lib/cn'
import { Spinner } from './Spinner'

const VARIANTS = {
  primary:
    'bg-linear-to-r from-brand-500 to-accent-500 text-white shadow-glow hover:brightness-110 disabled:shadow-none',
  secondary: 'border border-line-strong bg-surface-2 text-fg hover:bg-elevated',
  ghost: 'text-muted hover:bg-elevated hover:text-fg',
  danger: 'bg-linear-to-r from-red-500 to-rose-500 text-white shadow-glow-danger hover:brightness-110',
  warning: 'border border-amber-400/40 bg-amber-400/10 text-amber-700 hover:bg-amber-400/20 dark:text-amber-300',
}

const SIZES = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-sm',
  icon: 'size-9 rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}) {
  const isDisabled = disabled || loading

  return (
    <motion.button
      type={type}
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : { y: -1 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center font-semibold whitespace-nowrap transition-[background,filter,color,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : Icon && <Icon className="size-4" aria-hidden="true" />}
      {children}
    </motion.button>
  )
}
