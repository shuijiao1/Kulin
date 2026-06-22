import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "dark" | "light" | "system"
export type ThemeMode = "default" | "glass"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    storageKey?: string
}

type ThemeProviderState = {
    theme: Theme
    setTheme: (theme: Theme) => void
    themeMode: ThemeMode
    setThemeMode: (themeMode: ThemeMode) => void
}

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
    themeMode: "default",
    setThemeMode: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

const rootDocument = () => window.document.documentElement

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "vite-ui-theme",
    ...props
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
    )
    const [themeMode, setThemeModeState] = useState<ThemeMode>(
        () => (localStorage.getItem(`${storageKey}-mode`) as ThemeMode) || "default",
    )

    useEffect(() => {
        const root = window.document.documentElement

        root.classList.remove("light", "dark")

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light"

            root.classList.add(systemTheme)
            return
        }

        root.classList.add(theme)
    }, [theme])

    useEffect(() => {
        rootDocument().classList.toggle("kulin-glass-theme", themeMode === "glass")
    }, [themeMode])

    const value = {
        theme,
        setTheme: (theme: Theme) => {
            localStorage.setItem(storageKey, theme)
            setTheme(theme)
        },
        themeMode,
        setThemeMode: (themeMode: ThemeMode) => {
            localStorage.setItem(`${storageKey}-mode`, themeMode)
            setThemeModeState(themeMode)
        },
    }

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext)

    if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider")

    return context
}
