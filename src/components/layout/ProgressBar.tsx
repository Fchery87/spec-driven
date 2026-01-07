"use client"

import { useEffect, useCallback, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import NProgress from "nprogress"
import "nprogress/nprogress.css"

NProgress.configure({ showSpinner: false })

export function ProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFirstMount = useRef(true)

  // Track route changes and trigger progress
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    
    // Route changed, complete the progress
    NProgress.done()
  }, [pathname, searchParams])

  // Start progress on link clicks
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const anchor = target.closest('a')
      
      if (anchor && anchor.href && !anchor.target && !anchor.download) {
        const url = new URL(anchor.href, window.location.origin)
        if (url.origin === window.location.origin && url.pathname !== pathname) {
          NProgress.start()
        }
      }
    }

    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [pathname])

  return null
}
