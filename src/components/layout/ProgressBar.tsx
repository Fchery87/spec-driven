"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import NProgress from "nprogress"
import "nprogress/nprogress.css"

NProgress.configure({ showSpinner: false })

export function ProgressBar() {
  const router = useRouter()

  useEffect(() => {
    // Start progress when router.push is called
    const originalPush = router.push
    const newPush = (href: string) => {
      NProgress.start()
      return originalPush(href)
    }
     
    ;(router as any).push = newPush

    // Start progress when router.replace is called
    const originalReplace = router.replace
    const newReplace = (href: string) => {
      NProgress.start()
      return originalReplace(href)
    }
     
    ;(router as any).replace = newReplace

    // Complete progress after a delay to let animations finish
    const timer = setInterval(() => {
      if (document.readyState === "complete") {
        NProgress.done()
      }
    }, 100)

    return () => {
      clearInterval(timer)
       
      ;(router as any).push = originalPush
       
      ;(router as any).replace = originalReplace
    }
  }, [router])

  return null
}
