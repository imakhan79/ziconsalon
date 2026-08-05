import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format } from "date-fns"
import { Link } from "react-router-dom"
import {
  ShieldCheck,
  Smartphone,
  ScrollText,
  Clock,
  Database,
  Cloud,
  LifeBuoy,
  UserX,
  Download,
  KeyRound,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { AuditLog } from "@/types"

export default function SecurityPage() {
  const { user, profile } = useAuth()
  const canManage = profile && ["admin", "manager"].includes(profile.role)
  const queryClient = useQueryClient()

  // ---- MFA ----
  const { data: factors, isLoading: factorsLoading } = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      return data.totp
    },
  })
  const [enrolling, setEnrolling] = React.useState(false)
  const [enrollData, setEnrollData] = React.useState<{ factorId: string; qr: string } | null>(null)
  const [verifyCode, setVerifyCode] = React.useState("")

  const startEnroll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      setEnrollData({ factorId: data.id, qr: data.totp.qr_code })
      setEnrolling(true)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const confirmEnroll = useMutation({
    mutationFn: async () => {
      if (!enrollData) return
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollData.factorId,
      })
      if (challengeError) throw challengeError
      const { error } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: challenge.id,
        code: verifyCode,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Two-factor authentication enabled")
      setEnrolling(false)
      setEnrollData(null)
      setVerifyCode("")
      queryClient.invalidateQueries({ queryKey: ["mfa-factors"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const unenroll = useMutation({
    mutationFn: async (factorId: string) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Two-factor authentication disabled")
      queryClient.invalidateQueries({ queryKey: ["mfa-factors"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ---- Account deletion request ----
  const requestDeletion = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_account_deletion")
      if (error) throw error
    },
    onSuccess: () => toast.success("Deletion request sent to administrators"),
    onError: (e: Error) => toast.error(e.message),
  })

  // ---- Admin: session timeout ----
  const { data: settings } = useQuery({
    queryKey: ["business-settings"],
    enabled: !!canManage,
    queryFn: async () => {
      const { data, error } = await supabase.from("business_settings").select("session_timeout_minutes").eq("id", 1).single()
      if (error) throw error
      return data
    },
  })
  const [timeoutMinutes, setTimeoutMinutes] = React.useState(30)
  React.useEffect(() => {
    if (settings) setTimeoutMinutes(settings.session_timeout_minutes)
  }, [settings])

  const saveTimeout = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("business_settings")
        .update({ session_timeout_minutes: timeoutMinutes })
        .eq("id", 1)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Session timeout updated")
      queryClient.invalidateQueries({ queryKey: ["business-settings"] })
      queryClient.invalidateQueries({ queryKey: ["session-timeout-minutes"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ---- Admin: audit log ----
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["security-audit-logs"],
    enabled: !!canManage,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, actor:profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(30)
      if (error) throw error
      return data as unknown as AuditLog[]
    },
  })

  const hasMfa = (factors?.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Security</h1>
        <p className="text-sm text-muted-foreground">Account protection, activity, and compliance.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="gradient-gold rounded-xl p-2.5">
                <Smartphone className="size-5 text-accent-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Two-factor authentication</CardTitle>
                <CardDescription>Optional — adds an authenticator-app code at sign-in.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!factorsLoading && !enrolling && (
              <div className="flex items-center justify-between">
                <Badge variant={hasMfa ? "success" : "outline"}>
                  <ShieldCheck className="size-3" /> {hasMfa ? "Enabled" : "Not enabled"}
                </Badge>
                {hasMfa ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={unenroll.isPending}
                    onClick={() => unenroll.mutate(factors![0].id)}
                  >
                    Disable
                  </Button>
                ) : (
                  <Button size="sm" disabled={startEnroll.isPending} onClick={() => startEnroll.mutate()}>
                    Enable
                  </Button>
                )}
              </div>
            )}
            {enrolling && enrollData && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 p-4">
                <img src={enrollData.qr} alt="Scan with your authenticator app" className="size-40" />
                <p className="text-center text-xs text-muted-foreground">
                  Scan with Google Authenticator / Authy, then enter the 6-digit code.
                </p>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  className="w-32 text-center"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={confirmEnroll.isPending || verifyCode.length !== 6}
                    onClick={() => confirmEnroll.mutate()}
                  >
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEnrolling(false); setEnrollData(null) }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="gradient-luxury rounded-xl p-2.5">
                <Clock className="size-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Account activity</CardTitle>
                <CardDescription>This device's session.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last sign-in</span>
              <span>{user?.last_sign_in_at ? format(new Date(user.last_sign_in_at), "PPp") : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{user?.email}</span>
            </div>
            <Button asChild size="sm" variant="outline" className="mt-1 self-start">
              <Link to="/dashboard/profile">
                <KeyRound className="size-4" /> Change password
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="gradient-gold rounded-xl p-2.5">
                <UserX className="size-5 text-accent-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Your data</CardTitle>
                <CardDescription>Export or request removal of your data.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {profile?.role === "customer" && (
              <Button asChild size="sm" variant="outline">
                <Link to="/dashboard">
                  <Download className="size-4" /> Export my data
                </Link>
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline">
                  Request account deletion
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Request account deletion</AlertDialogTitle>
                  <AlertDialogDescription>
                    This notifies our administrators to review and process the removal of your account and
                    personal data. It isn't instant — an admin will follow up.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => requestDeletion.mutate()}>Send request</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="gradient-luxury rounded-xl p-2.5">
                <ShieldCheck className="size-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Platform security</CardTitle>
                <CardDescription>Enforced automatically, not configurable.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Password hashing</span>
              <Badge variant="success"><ShieldCheck className="size-3" /> Enforced</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Encrypted in transit (TLS)</span>
              <Badge variant="success"><ShieldCheck className="size-3" /> Enforced</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Row-level access control</span>
              <Badge variant="success"><ShieldCheck className="size-3" /> Enforced</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {canManage && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="gradient-gold rounded-xl p-2.5">
                    <Clock className="size-5 text-accent-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Session timeout</CardTitle>
                    <CardDescription>Auto sign-out after inactivity, app-wide.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-end gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="timeout-minutes">Minutes of inactivity</Label>
                  <Input
                    id="timeout-minutes"
                    type="number"
                    min={5}
                    max={240}
                    className="w-32"
                    value={timeoutMinutes}
                    onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
                  />
                </div>
                <Button size="sm" disabled={saveTimeout.isPending} onClick={() => saveTimeout.mutate()}>
                  Save
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="gradient-luxury rounded-xl p-2.5">
                    <ShieldCheck className="size-5 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Role-based permissions</CardTitle>
                    <CardDescription>Who can access what, by role.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild size="sm" variant="outline">
                  <Link to="/dashboard/admin/permissions">Open permissions matrix</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="gradient-luxury rounded-xl p-2.5">
                  <ScrollText className="size-5 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Audit log</CardTitle>
                  <CardDescription>Most recent 30 actions across the system.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!logsLoading && logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No activity logged yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "PPp")}
                      </TableCell>
                      <TableCell>{log.actor?.full_name ?? "System"}</TableCell>
                      <TableCell className="capitalize">{log.action.replace(/\./g, " ")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.entity_type ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="gradient-gold rounded-xl p-2.5">
                  <Database className="size-5 text-accent-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Infrastructure &amp; compliance</CardTitle>
                  <CardDescription>Provided by the underlying Supabase/Postgres platform.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <div className="flex items-start gap-2">
                <Database className="mt-0.5 size-4 shrink-0" />
                <span>Data is stored in a managed Postgres database with automatic backups; exact retention depends on your Supabase plan.</span>
              </div>
              <div className="flex items-start gap-2">
                <Cloud className="mt-0.5 size-4 shrink-0" />
                <span>File uploads (avatars, receipts) are served from Supabase Storage, a cloud object store.</span>
              </div>
              <div className="flex items-start gap-2">
                <LifeBuoy className="mt-0.5 size-4 shrink-0" />
                <span>Point-in-time recovery and disaster-recovery guarantees are set by your Supabase plan tier — check your project's backup settings to confirm coverage.</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
