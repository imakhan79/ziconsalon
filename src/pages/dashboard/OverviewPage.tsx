import type { ComponentType } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { format, startOfDay, addDays, subDays } from "date-fns"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CalendarDays,
  DollarSign,
  Users,
  AlertTriangle,
  UserCheck,
  Receipt,
  CheckCircle2,
  XCircle,
  Plus,
  Boxes,
  UserRound,
  BarChart3,
  Building2,
  ArrowRight,
} from "lucide-react"
import type { AppointmentStatus } from "@/types"

const STATUS_VARIANT: Record<AppointmentStatus, "default" | "success" | "warning" | "destructive" | "outline"> = {
  pending: "warning",
  confirmed: "default",
  completed: "success",
  cancelled: "outline",
  no_show: "destructive",
}

export default function OverviewPage() {
  const { profile } = useAuth()

  if (profile?.role === "manager") return <BranchAdminDashboard />
  if (profile && ["admin", "staff"].includes(profile.role)) return <StaffOverview />
  return <CustomerOverview />
}

function CustomerOverview() {
  const { profile } = useAuth()

  const { data: myAppointments = [], isLoading } = useQuery({
    queryKey: ["overview-customer", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, start_time, status")
        .eq("customer_id", profile!.id)
        .order("start_time", { ascending: true })
      if (error) throw error
      return data as { id: string; start_time: string; status: string }[]
    },
  })

  if (isLoading) {
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
      <div>
        <h1 className="font-display text-2xl font-semibold">
          Welcome, <span className="text-gradient-luxury">{profile?.full_name}</span>
        </h1>
        <p className="text-sm text-muted-foreground">Here's what's coming up for you.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your upcoming appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {myAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No appointments yet. Book one from the Appointments tab.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {myAppointments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3 text-sm transition-colors hover:bg-accent/5"
                >
                  <span>{format(new Date(a.start_time), "PPp")}</span>
                  <span className="capitalize text-muted-foreground">{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StaffOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["overview-staff"],
    queryFn: async () => {
      const monthStart = startOfDay(new Date())
      monthStart.setDate(1)
      const monthStartIso = monthStart.toISOString()
      const [{ count: apptCount }, { data: invoices }, { count: customerCount }, { data: lowStock }] =
        await Promise.all([
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .gte("start_time", monthStartIso),
          supabase.from("invoices").select("total, status, created_at").gte("created_at", monthStartIso),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "customer"),
          supabase
            .from("products")
            .select("id, name, stock_qty, reorder_level")
            .order("stock_qty", { ascending: true })
            .limit(5),
        ])

      const revenue = (invoices ?? [])
        .filter((i) => i.status === "paid")
        .reduce((sum, i) => sum + Number(i.total), 0)

      const revenueByDay: Record<string, number> = {}
      for (const inv of invoices ?? []) {
        if (inv.status !== "paid") continue
        const day = format(new Date(inv.created_at), "MMM d")
        revenueByDay[day] = (revenueByDay[day] ?? 0) + Number(inv.total)
      }
      const chartData = Object.entries(revenueByDay).map(([day, total]) => ({ day, total }))

      return {
        apptCount: apptCount ?? 0,
        revenue,
        customerCount: customerCount ?? 0,
        lowStock: (lowStock ?? []).filter((p) => Number(p.stock_qty) <= Number(p.reorder_level)),
        chartData,
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
      <div>
        <h1 className="font-display text-2xl font-semibold">Business overview</h1>
        <p className="text-sm text-muted-foreground">Your salon's performance at a glance.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Appointments this month" value={data.apptCount} />
        <StatCard icon={DollarSign} label="Revenue this month" value={`$${data.revenue.toFixed(2)}`} accent="gold" />
        <StatCard icon={Users} label="Total customers" value={data.customerCount} />
        <StatCard icon={AlertTriangle} label="Low stock items" value={data.lowStock.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue this month</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <RevenueChart data={data.chartData} gradientId="revenueGradientStaff" />
        </CardContent>
      </Card>

      {data.lowStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Low stock alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {data.lowStock.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                >
                  <span>{p.name}</span>
                  <span className="text-destructive font-medium">{p.stock_qty} left</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function BranchAdminDashboard() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id ?? null

  const { data, isLoading } = useQuery({
    queryKey: ["overview-branch-admin", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const todayStart = startOfDay(new Date())
      const todayStartIso = todayStart.toISOString()
      const tomorrowIso = addDays(todayStart, 1).toISOString()
      const weekAgoIso = subDays(todayStart, 6).toISOString()

      const [
        { data: branch },
        { data: todaysAppts },
        { count: weekApptCount },
        { data: activeStaff },
        { data: todayInvoices },
        { data: pendingInvoices },
        { data: lowStockRaw },
        { data: recentInvoices },
        { data: weekInvoices },
      ] = await Promise.all([
        supabase.from("branches").select("*").eq("id", branchId!).single(),
        supabase
          .from("appointments")
          .select(
            "id, start_time, status, customer:profiles!appointments_customer_id_fkey(full_name), staff:staff(*, profile:profiles(full_name))"
          )
          .eq("branch_id", branchId!)
          .gte("start_time", todayStartIso)
          .lt("start_time", tomorrowIso)
          .order("start_time", { ascending: true }),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("branch_id", branchId!)
          .gte("start_time", weekAgoIso),
        supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("branch_id", branchId!)
          .in("role", ["staff", "manager"])
          .eq("is_active", true),
        supabase
          .from("invoices")
          .select("total, status")
          .eq("branch_id", branchId!)
          .gte("created_at", todayStartIso)
          .lt("created_at", tomorrowIso),
        supabase
          .from("invoices")
          .select("total, status")
          .eq("branch_id", branchId!)
          .in("status", ["unpaid", "partial"]),
        supabase
          .from("products")
          .select("id, name, stock_qty, reorder_level")
          .eq("branch_id", branchId!)
          .order("stock_qty", { ascending: true })
          .limit(20),
        supabase
          .from("invoices")
          .select("id, invoice_number, total, status, created_at, customer:profiles!invoices_customer_id_fkey(full_name)")
          .eq("branch_id", branchId!)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("invoices")
          .select("total, status, created_at")
          .eq("branch_id", branchId!)
          .eq("status", "paid")
          .gte("created_at", weekAgoIso),
      ])

      const todaysApptList = todaysAppts ?? []
      const todaysRevenue = (todayInvoices ?? [])
        .filter((i) => i.status === "paid")
        .reduce((s, i) => s + Number(i.total), 0)
      const pendingTotal = (pendingInvoices ?? []).reduce((s, i) => s + Number(i.total), 0)
      const lowStock = (lowStockRaw ?? []).filter((p) => Number(p.stock_qty) <= Number(p.reorder_level))

      const revenueByDay: Record<string, number> = {}
      for (let i = 6; i >= 0; i--) {
        revenueByDay[format(subDays(new Date(), i), "MMM d")] = 0
      }
      for (const inv of weekInvoices ?? []) {
        const day = format(new Date(inv.created_at), "MMM d")
        if (day in revenueByDay) revenueByDay[day] += Number(inv.total)
      }
      const chartData = Object.entries(revenueByDay).map(([day, total]) => ({ day, total }))

      return {
        branchName: branch?.name ?? "Your branch",
        todaysAppts: todaysApptList,
        completedToday: todaysApptList.filter((a) => a.status === "completed").length,
        cancelledToday: todaysApptList.filter((a) => ["cancelled", "no_show"].includes(a.status)).length,
        weekApptCount: weekApptCount ?? 0,
        activeStaff: activeStaff ?? [],
        todaysRevenue,
        pendingTotal,
        pendingCount: (pendingInvoices ?? []).length,
        lowStock,
        recentInvoices: recentInvoices ?? [],
        chartData,
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
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="gradient-luxury rounded-xl p-3">
            <Building2 className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">{data.branchName}</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {profile?.full_name} — Branch Administrator
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/dashboard/appointments">
              <Plus className="size-4" /> Book appointment
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/billing">
              <Plus className="size-4" /> Create invoice
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/inventory">
              <Boxes className="size-4" /> Add product
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/staff">
              <UserRound className="size-4" /> Staff
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/reports">
              <BarChart3 className="size-4" /> Reports
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Today's appointments" value={data.todaysAppts.length} />
        <StatCard icon={UserCheck} label="Active staff" value={data.activeStaff.length} />
        <StatCard icon={DollarSign} label="Today's revenue" value={`$${data.todaysRevenue.toFixed(2)}`} accent="gold" />
        <StatCard icon={Receipt} label="Pending payments" value={`$${data.pendingTotal.toFixed(2)}`} />
        <StatCard icon={CheckCircle2} label="Completed today" value={data.completedToday} />
        <StatCard icon={XCircle} label="Cancelled / no-show today" value={data.cancelledToday} />
        <StatCard icon={CalendarDays} label="Appointments this week" value={data.weekApptCount} />
        <StatCard icon={AlertTriangle} label="Low stock items" value={data.lowStock.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today's appointment timeline</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.todaysAppts.length === 0 && (
              <p className="text-sm text-muted-foreground">No appointments scheduled today.</p>
            )}
            {data.todaysAppts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{format(new Date(a.start_time), "p")}</span>
                  <span className="text-xs text-muted-foreground">
                    {(a.customer as unknown as { full_name: string } | null)?.full_name ?? "—"} ·{" "}
                    {(a.staff as unknown as { profile: { full_name: string } } | null)?.profile?.full_name ??
                      "Unassigned"}
                  </span>
                </div>
                <Badge variant={STATUS_VARIANT[a.status as AppointmentStatus]} className="capitalize">
                  {a.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue — last 7 days</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <RevenueChart data={data.chartData} gradientId="revenueGradientBranch" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Staff on duty</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard/staff">
                  View all <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.activeStaff.length === 0 && (
              <p className="text-sm text-muted-foreground">No active staff assigned to this branch yet.</p>
            )}
            {data.activeStaff.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span>{s.full_name}</span>
                <Badge variant="secondary" className="capitalize">
                  {s.role}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent transactions</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard/billing">
                  View all <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.recentInvoices.length === 0 && (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            )}
            {data.recentInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{inv.invoice_number}</span>
                  <span className="text-xs text-muted-foreground">
                    {(inv.customer as unknown as { full_name: string } | null)?.full_name ?? "—"}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span>${Number(inv.total).toFixed(2)}</span>
                  <Badge variant={STATUS_VARIANT[inv.status as keyof typeof STATUS_VARIANT] ?? "outline"} className="capitalize">
                    {inv.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {data.lowStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low stock alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {data.lowStock.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                >
                  <span>{p.name}</span>
                  <span className="text-destructive font-medium">{p.stock_qty} left</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function RevenueChart({ data, gradientId }: { data: { day: string; total: number }[]; gradientId: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.95} />
            <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0.85} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
          }}
        />
        <Bar dataKey="total" fill={`url(#${gradientId})`} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function StatCard({
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
