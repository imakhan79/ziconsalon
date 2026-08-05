import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { AuthLayout } from "@/components/layout/AuthLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin.demo@ziconsalon.app" },
  { role: "Manager", email: "manager.demo@ziconsalon.app" },
  { role: "Staff", email: "staff.demo@ziconsalon.app" },
  { role: "Customer", email: "customer.demo@ziconsalon.app" },
] as const
const DEMO_PASSWORD = "Demo@12345"

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [demoRole, setDemoRole] = React.useState<string | null>(null)
  const [mfaFactorId, setMfaFactorId] = React.useState<string | null>(null)
  const [mfaCode, setMfaCode] = React.useState("")

  const doSignIn = async (loginEmail: string, loginPassword: string) => {
    const { error } = await signIn(loginEmail, loginPassword)
    if (error) {
      toast.error(error)
      return
    }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.[0]
      if (totp) {
        setMfaFactorId(totp.id)
        return
      }
    }
    navigate("/dashboard")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await doSignIn(email, password)
    setSubmitting(false)
  }

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaFactorId) return
    setSubmitting(true)
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: mfaCode })
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    navigate("/dashboard")
  }

  const handleDemoLogin = async (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setDemoRole(account.role)
    await doSignIn(account.email, DEMO_PASSWORD)
    setDemoRole(null)
  }

  if (mfaFactorId) {
    return (
      <AuthLayout title="Verification required" subtitle="Enter the 6-digit code from your authenticator app">
        <form onSubmit={handleMfaVerify} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="mfa-code">Authentication code</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={submitting || mfaCode.length !== 6} className="mt-2">
            {submitting ? "Verifying..." : "Verify"}
          </Button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your salon account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="text-primary underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>

      <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        Try a demo account
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <Button
            key={account.role}
            type="button"
            variant="outline"
            size="sm"
            disabled={demoRole !== null}
            onClick={() => handleDemoLogin(account)}
          >
            {demoRole === account.role ? "Signing in..." : account.role}
          </Button>
        ))}
      </div>
    </AuthLayout>
  )
}
