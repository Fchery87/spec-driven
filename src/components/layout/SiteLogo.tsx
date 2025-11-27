"use client"

import { useId } from "react"

import { cn } from "@/lib/utils"

interface SiteLogoProps {
  className?: string
  showText?: boolean
  size?: "sm" | "md" | "lg"
}

export function SiteLogo({ className, showText = true, size = "md" }: SiteLogoProps) {
  const gradientId = useId()

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  }

  const textSizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex-shrink-0">
        <div className={cn(
          "absolute inset-0 rounded-xl bg-gradient-to-br from-primary via-amber-500 to-orange-500 opacity-20 blur-lg",
          sizeClasses[size]
        )} />
        <svg
          viewBox="0 0 48 48"
          className={cn("relative drop-shadow-md", sizeClasses[size])}
          role="img"
          aria-label="Spec-Driven"
        >
          <defs>
            <linearGradient id={`${gradientId}-main`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(38 92% 50%)" />
            </linearGradient>
            <linearGradient id={`${gradientId}-accent`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(38 92% 50%)" />
              <stop offset="100%" stopColor="hsl(25 95% 53%)" />
            </linearGradient>
          </defs>
          <rect
            x="4"
            y="4"
            width="40"
            height="40"
            rx="10"
            fill={`url(#${gradientId}-main)`}
          />
          <rect
            x="10"
            y="12"
            width="20"
            height="3"
            rx="1.5"
            fill="hsl(var(--background))"
            opacity="0.95"
          />
          <rect
            x="10"
            y="18"
            width="14"
            height="2.5"
            rx="1.25"
            fill="hsl(var(--background))"
            opacity="0.7"
          />
          <rect
            x="10"
            y="23"
            width="18"
            height="2.5"
            rx="1.25"
            fill="hsl(var(--background))"
            opacity="0.7"
          />
          <path
            d="M10 30 L16 30 L19 33 L16 36 L10 36 Z"
            fill="hsl(var(--background))"
            opacity="0.9"
          />
          <path
            d="M21 30 L27 30 L30 33 L27 36 L21 36 Z"
            fill="hsl(var(--background))"
            opacity="0.75"
          />
          <circle
            cx="36"
            cy="33"
            r="7"
            fill={`url(#${gradientId}-accent)`}
            opacity="0.95"
          />
          <path
            d="M33 33 L35 35 L39 31"
            stroke="hsl(var(--background))"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>

      {showText && (
        <div className="leading-tight">
          <span className={cn(
            "font-semibold tracking-tight text-foreground",
            textSizeClasses[size]
          )}>
            Spec-Driven
          </span>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
            Orchestrate Tomorrow
          </p>
        </div>
      )}
    </div>
  )
}
