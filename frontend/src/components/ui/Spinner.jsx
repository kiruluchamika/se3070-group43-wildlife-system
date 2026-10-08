import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

export function Spinner({ className, label = 'Loading' }) {
  return <LoaderCircle className={cn('size-5 animate-spin', className)} aria-label={label} role="status" />
}
