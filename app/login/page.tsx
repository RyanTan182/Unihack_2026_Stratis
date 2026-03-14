"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Zap, Loader2 } from "lucide-react"
import { setAuthenticated, validateCredentials } from "@/app/lib/auth"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (validateCredentials(username, password)) {
      setIsTransitioning(true)
      setAuthenticated(true)
      setTimeout(() => {
        router.push("/")
      }, 1200)
    } else {
      setError("Invalid credentials. Try stratis / supplychain")
    }
  }

  if (isTransitioning) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Signing you in...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-6"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground">Stratis</h1>
            <p className="text-sm text-muted-foreground">
              Supply chain intelligence
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Username
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="stratis"
              className="bg-muted/30"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="bg-muted/30"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button type="submit" className="w-full">
          Sign in
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Demo: stratis / supplychain
        </p>
      </form>
    </div>
  )
}
