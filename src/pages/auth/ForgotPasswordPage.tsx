import * as React from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { CheckCircle2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { AuthLayout } from "@/components/layout/AuthLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setSent(true)
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to get back in">
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="size-10 text-accent" />
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email}</span>, a
            reset link is on its way.
          </p>
          <Link to="/login" className="text-sm text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
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
          <Button type="submit" disabled={submitting} className="mt-2">
            {submitting ? "Sending..." : "Send reset link"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  )
}
