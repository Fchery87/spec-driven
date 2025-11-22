"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Loader2, ShieldPlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn, signUp } from "@/lib/auth-client"

export default function SignUpPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSignUp = async () => {
    if (!firstName || !lastName || !email || !password) {
      setError("Please complete all required fields.")
      return
    }
    if (password !== passwordConfirmation) {
      setError("Passwords do not match.")
      return
    }
    setError(null)
    const imagePayload = image ? await convertImageToBase64(image) : undefined
    await signUp.email(
      {
        email,
        password,
        name: `${firstName} ${lastName}`.trim(),
        ...(imagePayload ? { image: imagePayload } : {}),
        callbackURL: "/dashboard",
      },
      {
        onRequest: () => setLoading(true),
        onResponse: () => setLoading(false),
        onError: (ctx) => {
          setError(ctx.error.message || "Unable to create account.")
          setLoading(false)
        },
        onSuccess: () => router.push("/dashboard"),
      }
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted px-4 py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10">
        <div className="text-center space-y-3">
          <BadgeCreateLabel />
          <h1 className="text-3xl font-semibold text-foreground">Create your workspace</h1>
          <p className="text-muted-foreground">
            Join the Spec-Driven Platform to generate secure specs and guided handoffs.
          </p>
        </div>

        <Card className="w-full max-w-lg border border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-xl">Sign Up</CardTitle>
            <CardDescription>Enter your details to create an account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="first-name">First name</Label>
                <Input
                  id="first-name"
                  placeholder="Jordan"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last-name">Last name</Label>
                <Input
                  id="last-name"
                  placeholder="Sloan"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password_confirmation">Confirm password</Label>
              <Input
                id="password_confirmation"
                type="password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="image">Profile image (optional)</Label>
              <div className="flex items-center gap-4">
                {imagePreview && (
                  <div className="relative h-16 w-16 overflow-hidden rounded-full border border-border/70">
                    <Image src={imagePreview} alt="Profile preview" fill className="object-cover" />
                  </div>
                )}
                <div className="flex flex-1 items-center gap-2">
                  <Input id="image" type="file" accept="image/*" onChange={handleImageChange} />
                  {imagePreview && (
                    <button
                      type="button"
                      aria-label="Remove image"
                      className="rounded-full border border-border p-1 text-muted-foreground"
                      onClick={() => {
                        setImage(null)
                        setImagePreview(null)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <Button className="w-full" disabled={loading} type="button" onClick={handleSignUp}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create account
            </Button>
            <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or continue with
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full gap-2"
                disabled={loading}
                type="button"
                onClick={() =>
                  signIn.social(
                    { provider: "google", callbackURL: "/dashboard" },
                    {
                      onRequest: () => setLoading(true),
                      onResponse: () => setLoading(false),
                      onError: (ctx) => setError(ctx.error.message || "Unable to authenticate."),
                    }
                  )
                }
              >
                <GoogleIcon />
                Continue with Google
              </Button>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/sign-in" className="text-primary underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function BadgeCreateLabel() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
      <ShieldPlus className="h-4 w-4 text-primary" />
      New Profile
    </div>
  )
}

function convertImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
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
