"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, Suspense } from "react"
import { KeyRound, Loader2, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { useLogger } from "@/lib/logger"

function SignInPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { logEvent, logError } = useLogger("SignInPage")

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      setError("Email and password are required.")
      return
    }
    setError(null)
    setLoading(true)

    try {
      logEvent("sign_in_start")
      const result = await signIn.email(
        { email, password, callbackURL: callbackUrl },
        {
          onRequest: () => {
            logEvent("sign_in_request")
            setLoading(true)
          },
          onResponse: () => {
            logEvent("sign_in_response")
            setLoading(false)
          },
          onError: (ctx) => {
            logEvent("sign_in_error", { error: ctx.error.message })
            setError(ctx.error.message || "Unable to sign in.")
            setLoading(false)
          },
          onSuccess: () => {
            logEvent("sign_in_success")
            router.push(callbackUrl)
          },
        }
      )

      // Fallback: if onSuccess doesn't trigger, check result and redirect manually
      if (result && !result.error) {
        logEvent("sign_in_redirect")
        setTimeout(() => {
          router.push(callbackUrl)
        }, 100)
      } else if (result?.error) {
        logEvent("sign_in_failed", { error: result.error.message })
        setError(result.error.message || "Sign in failed")
        setLoading(false)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logError("Sign in exception", error)
      setError("An unexpected error occurred.")
      setLoading(false)
    }
  }

  const handleSocialSignIn = async (provider: "google") => {
    setError(null)
    await signIn.social(
      {
        provider,
        callbackURL: "/dashboard",
      },
      {
        onRequest: () => setLoading(true),
        onResponse: () => setLoading(false),
        onError: (ctx) => setError(ctx.error.message || "Unable to sign in."),
      }
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted px-4 py-16">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-10">
        <div className="text-center space-y-3">
          <BadgeHeroLabel />
          <h1 className="text-3xl font-semibold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground">
            Sign in to orchestrate specs, approvals, and handoffs with clarity.
          </p>
        </div>

        <Card className="w-full max-w-md border border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-xl">Sign In</CardTitle>
            <CardDescription>Enter your email to access your workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link href="#" className="ml-auto text-sm text-primary underline-offset-4 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <Label htmlFor="remember" className="text-sm text-muted-foreground">
                Remember me on this device
              </Label>
            </div>
            <Button
              className="w-full"
              disabled={loading}
              type="button"
              onClick={(e) => {
                e.preventDefault()
                handleEmailSignIn()
              }}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Sign In
            </Button>
            <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or continue with
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className={cn("w-full gap-2")}
                disabled={loading}
                type="button"
                onClick={() => handleSocialSignIn("google")}
              >
                <GoogleIcon />
                Sign in with Google
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p className="text-center">
              Need an account?{" "}
              <Link href="/sign-up" className="text-primary underline-offset-4 hover:underline">
                Create one
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}

function BadgeHeroLabel() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
      <ShieldCheck className="h-4 w-4 text-primary" />
      Secure Access
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInPageLoadingFallback />}>
      <SignInPageContent />
    </Suspense>
  )
}

function SignInPageLoadingFallback() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted px-4 py-16">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
            Loading...
          </div>
        </div>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 262">
      <path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" />
      <path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" />
      <path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z" />
      <path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" />
    </svg>
  )
}
