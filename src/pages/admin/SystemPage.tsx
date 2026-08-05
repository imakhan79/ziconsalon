import { Link } from "react-router-dom"
import { Settings2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SystemPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold">System Configuration</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="gradient-luxury rounded-xl p-2.5">
                <Settings2 className="size-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">General settings</CardTitle>
                <CardDescription>Business profile, tax, currency, hours.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/settings">Open general settings</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="gradient-gold rounded-xl p-2.5">
                <Lock className="size-5 text-accent-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Security</CardTitle>
                <CardDescription>MFA, session timeout, audit log, and compliance.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/security">Open Security hub</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
