"use client"

import { useEffect, useState, useCallback } from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Theme = "light" | "dark"

const STORAGE_KEY = "spec-driven-theme"

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light")

  // Define applyTheme before the useEffect that uses it
  const applyTheme = useCallback((next: Theme) => {
    setTheme(next)
    if (typeof window !== "undefined") {
      const root = window.document.documentElement
      root.classList.toggle("dark", next === "dark")
      localStorage.setItem(STORAGE_KEY, next)
    }
  }, [])

  useEffect(() => {
    const stored = (typeof window !== "undefined" && (localStorage.getItem(STORAGE_KEY) as Theme | null)) || null
    const initial = stored === "dark" ? "dark" : "light"
    applyTheme(initial)
  }, [applyTheme])

  const toggle = () => {
    applyTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={toggle}
      className={cn("h-9 w-9 rounded-full", className)}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
