import { useQuery } from "@tanstack/react-query"
import { format, startOfDay, startOfMonth } from "date-fns"
import {
  Building2,
  Users,
  UserCheck,
  Briefcase,
  CalendarClock,
  DollarSign,
  Clock3,
  Plug,
  ShieldCheck,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import type { ComponentType } from "react"

export default function AdminOverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const today = startOfDay(new Date()).toISOString()
      const monthStart = startOfMonth(new Date()).toISOString()

      const [
        { data: branches },
        { data: profiles },
        { data: todaysAppts },
        { data: pendingAppts },
        { data: monthInvoices },
        { data: activeIntegrations },
        { data: recentLogs },
      ] = await Promise.all([
        supabase.from("branches").select("id, name, is_active"),
        supabase.from("profiles").select("id, role, is_active, branch_id"),
        supabase.from("appointments").select("id, branch_id").gte("start_time", today),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase
          .from("invoices")
          .select("total, status, branch_id, created_at")
          .gte("created_at", monthStart),
        supabase.from("integrations").select("id", { count: "exact", head: true }).eq("is_enabled", true),
        supabase
          .from("audit_logs")
          .select("*, actor:profiles(full_name)")
          .order("created_at", { ascending: false })
          .limit(8),
      ])

      const paidThisMonth = (monthInvoices ?? []).filter((i) => i.status === "paid")
      const monthRevenue = paidThisMonth.reduce((s, i) => s + Number(i.total), 0)

      const branchPerf = (branches ?? []).map((b) => {
        const apptCount = (todaysAppts ?? []).filter((a) => a.branch_id === b.id).length
        const revenue = paidThisMonth
          .filter((i) => i.branch_id === b.id)
          .reduce((s, i) => s + Number(i.total), 0)
        return { id: b.id, name: b.name, isActive: b.is_active, apptCount, revenue }
      })

      return {
        branchCount: (branches ?? []).length,
        userCount: (profiles ?? []).length,
        activeCustomers: (profiles ?? []).filter((p) => p.role === "customer" && p.is_active).length,
        staffCount: (profiles ?? []).filter((p) => ["staff", "manager"].includes(p.role)).length,
        todaysApptCount: (todaysAppts ?? []).length,
        monthRevenue,
        pendingCount: (pendingAppts as unknown as { length: number })?.length ?? 0,
        activeIntegrationsCount: (activeIntegrations as unknown as { length: number })?.length ?? 0,
        branchPerf,
        recentLogs: recentLogs ?? [],
      }
    },
  })

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Executive Overview</h1>
          <p className="text-sm text-muted-foreground">Complete system control, at a glance.</p>
        </div>
        <Badge variant="warning" className="ml-auto">
          <ShieldCheck className="size-3" /> Super Administrator
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Building2} label="Total Branches" value={data.branchCount} />
        <Stat icon={Users} label="Total Users" value={data.userCount} />
        <Stat icon={UserCheck} label="Active Customers" value={data.activeCustomers} accent="gold" />
        <Stat icon={Briefcase} label="Total Staff" value={data.staffCount} />
        <Stat icon={CalendarClock} label="Today's Appointments" value={data.todaysApptCount} />
        <Stat icon={DollarSign} label="Monthly Revenue" value={`$${data.monthRevenue.toFixed(2)}`} accent="gold" />
        <Stat icon={Clock3} label="Pending Appointments" value={data.pendingCount} />
        <Stat icon={Plug} label="Active Integrations" value={data.activeIntegrationsCount} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Branch performance — today &amp; this month</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Appts today</TableHead>
                  <TableHead>Revenue (mo.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.branchPerf.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No branches yet.
                    </TableCell>
                  </TableRow>
                )}
                {data.branchPerf.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>
                      <Badge variant={b.isActive ? "success" : "outline"}>
                        {b.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{b.apptCount}</TableCell>
                    <TableCell>${b.revenue.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.recentLogs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No admin actions logged yet — activity will appear here as branches, users, and settings
                change.
              </p>
            )}
            {data.recentLogs.map((log) => (
              <div key={log.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p>
                    <span className="font-medium">
                      {(log.actor as unknown as { full_name: string } | null)?.full_name ?? "System"}
                    </span>{" "}
                    <span className="text-muted-foreground">{log.action.replace(/\./g, " ")}</span>
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(log.created_at), "MMM d, p")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  accent = "primary",
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string | number
  accent?: "primary" | "gold"
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className={accent === "gold" ? "gradient-gold rounded-xl p-3" : "gradient-luxury rounded-xl p-3"}>
          <Icon className={accent === "gold" ? "size-5 text-accent-foreground" : "size-5 text-primary-foreground"} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
