import { useEffect, useState } from 'react'

const currentTime = () => Date.now()

/** Current time that re-renders every `intervalMs`, for "x minutes ago" labels. */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(currentTime)

  useEffect(() => {
    const interval = setInterval(() => setNow(currentTime()), intervalMs)
    return () => clearInterval(interval)
  }, [intervalMs])

  return now
}
