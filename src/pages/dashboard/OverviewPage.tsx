import { useQuery } from "@tanstack/react-query"
import { format, startOfMonth } from "date-fns"
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
import { CalendarDays, DollarSign, Users, AlertTriangle } from "lucide-react"

export default function OverviewPage() {
  const { profile } = useAuth()
  const isStaffOrAbove = profile && ["admin", "manager", "staff"].includes(profile.role)

  const { data, isLoading } = useQuery({
    queryKey: ["overview-stats", profile?.id, profile?.role],
    enabled: !!profile,
    queryFn: async () => {
      if (!isStaffOrAbove) {
        const { data: myAppts } = await supabase
          .from("appointments")
          .select("id, start_time, status")
          .eq("customer_id", profile!.id)
          .order("start_time", { ascending: true })
        return { myAppointments: myAppts ?? [] }
      }

      const monthStart = startOfMonth(new Date()).toISOString()
      const [{ count: apptCount }, { data: invoices }, { count: customerCount }, { data: lowStock }] =
        await Promise.all([
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .gte("start_time", monthStart),
          supabase.from("invoices").select("total, status, created_at").gte("created_at", monthStart),
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

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  if (!isStaffOrAbove) {
    const myAppointments = (data as { myAppointments: { id: string; start_time: string; status: string }[] })
      ?.myAppointments ?? []
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

  const stats = data as {
    apptCount: number
    revenue: number
    customerCount: number
    lowStock: { id: string; name: string; stock_qty: number }[]
    chartData: { day: string; total: number }[]
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Business overview</h1>
        <p className="text-sm text-muted-foreground">Your salon's performance at a glance.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Appointments this month" value={stats.apptCount} />
        <StatCard icon={DollarSign} label="Revenue this month" value={`$${stats.revenue.toFixed(2)}`} accent="gold" />
        <StatCard icon={Users} label="Total customers" value={stats.customerCount} />
        <StatCard icon={AlertTriangle} label="Low stock items" value={stats.lowStock.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue this month</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chartData}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
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
              <Bar dataKey="total" fill="url(#revenueGradient)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {stats.lowStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Low stock alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {stats.lowStock.map((p) => (
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

function StatCard({
  icon: Icon,
  label,
  value,
  accent = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>
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
