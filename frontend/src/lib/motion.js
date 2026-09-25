/** Shared motion presets so every module animates the same way. */

export const spring = { type: 'spring', stiffness: 260, damping: 26 }

/** Entrance for cards and list items inside a staggered container. */
export const riseIn = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: spring },
}

/** Parent that reveals its children one after another. */
export const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

/** Route transition used by the app shell. */
export const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } },
}

/** Rows that slide in and collapse out when data changes. */
export const listItem = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0, transition: spring },
  exit: { opacity: 0, x: 12, transition: { duration: 0.15 } },
}
