/** Joins class names, skipping falsy values. */
export function cn(...classes) {
  return classes.flat().filter(Boolean).join(' ')
}
