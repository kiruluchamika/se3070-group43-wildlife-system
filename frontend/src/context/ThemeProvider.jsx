import { useCallback, useEffect, useMemo, useState } from 'react'
import { readStorage, writeStorage } from '../lib/storage'
import { ThemeContext } from './theme-context'

const THEME_KEY = 'wildguard-theme'

// Dark matches Group 41's operations wireframes; light helps outdoors in sunlight.
const initialTheme = () => (readStorage(THEME_KEY) === 'light' ? 'light' : 'dark')

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#061419' : '#eef5f3')
    writeStorage(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => setTheme((current) => (current === 'dark' ? 'light' : 'dark')), [])
  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
