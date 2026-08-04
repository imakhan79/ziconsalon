import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { ShieldCheck, Settings2, ScrollText, Lock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AuditLog } from "@/types"

export default function SystemPage() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, actor:profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(50)
      if (error) throw error
      return data as unknown as AuditLog[]
    },
  })

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
                <CardDescription>Authentication is managed by Supabase Auth.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Password hashing</span>
              <Badge variant="success">
                <ShieldCheck className="size-3" /> Enforced
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Session-based auth</span>
              <Badge variant="success">
                <ShieldCheck className="size-3" /> Enforced
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Multi-factor authentication</span>
              <Badge variant="outline">Not configured</Badge>
            </div>
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
              <CardTitle className="text-base">Audit &amp; activity log</CardTitle>
              <CardDescription>Every branch, user, and integration change performed by admins.</CardDescription>
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
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && logs.length === 0 && (
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
    </div>
  )
}
