import type { ComponentType } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, startOfMonth, startOfDay, subMonths } from "date-fns"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { DollarSign, Users, PackageSearch, Receipt, Trophy, Wallet } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const today = startOfDay(new Date()).toISOString()
      const monthStart = startOfMonth(new Date()).toISOString()
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5)).toISOString()

      const [
        { data: recentInvoices },
        { data: statusCounts },
        { data: invoiceItems },
        { data: appointments },
        { data: products },
        { data: outstandingInvoices },
        { data: recentPayments },
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select("total, status, created_at, customer_id, customer:profiles!invoices_customer_id_fkey(full_name)")
          .gte("created_at", sixMonthsAgo),
        supabase.from("appointments").select("status").gte("start_time", monthStart),
        supabase
          .from("invoice_items")
          .select("description, line_total, service_id, service:services(name), invoice:invoices(created_at)"),
        supabase.from("appointments").select("id, staff_id").gte("start_time", monthStart),
        supabase.from("products").select("stock_qty, cost_price"),
        supabase.from("invoices").select("total, status").in("status", ["unpaid", "partial"]),
        supabase.from("payments").select("amount, method").gte("paid_at", monthStart),
      ])

      const paid = (recentInvoices ?? []).filter((i) => i.status === "paid")
      const todayRevenue = paid
        .filter((i) => i.created_at >= today)
        .reduce((s, i) => s + Number(i.total), 0)
      const monthRevenue = paid
        .filter((i) => i.created_at >= monthStart)
        .reduce((s, i) => s + Number(i.total), 0)

      const revenueByMonth: Record<string, number> = {}
      for (const inv of paid) {
        const key = format(new Date(inv.created_at), "MMM yyyy")
        revenueByMonth[key] = (revenueByMonth[key] ?? 0) + Number(inv.total)
      }
      const trend = Object.entries(revenueByMonth).map(([month, total]) => ({ month, total }))

      const statusBreakdown: Record<string, number> = {}
      for (const a of statusCounts ?? []) {
        statusBreakdown[a.status] = (statusBreakdown[a.status] ?? 0) + 1
      }

      const spendByCustomer: Record<string, { name: string; total: number }> = {}
      for (const inv of paid) {
        const name = (inv.customer as unknown as { full_name: string } | null)?.full_name ?? "Unknown"
        const key = inv.customer_id
        if (!spendByCustomer[key]) spendByCustomer[key] = { name, total: 0 }
        spendByCustomer[key].total += Number(inv.total)
      }
      const topCustomers = Object.values(spendByCustomer)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)

      const revenueByService: Record<string, number> = {}
      for (const item of invoiceItems ?? []) {
        const createdAt = (item.invoice as unknown as { created_at: string } | null)?.created_at
        if (!createdAt || createdAt < monthStart) continue
        const name =
          (item.service as unknown as { name: string } | null)?.name ?? item.description ?? "Other"
        revenueByService[name] = (revenueByService[name] ?? 0) + Number(item.line_total)
      }
      const topServices = Object.entries(revenueByService)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)

      const inventoryValue = (products ?? []).reduce(
        (s, p) => s + Number(p.stock_qty) * Number(p.cost_price),
        0
      )

      const outstanding = (outstandingInvoices ?? []).reduce((s, i) => s + Number(i.total), 0)

      const cashTotal = (recentPayments ?? [])
        .filter((p) => p.method === "cash")
        .reduce((s, p) => s + Number(p.amount), 0)
      const digitalTotal = (recentPayments ?? [])
        .filter((p) => p.method !== "cash")
        .reduce((s, p) => s + Number(p.amount), 0)

      return {
        todayRevenue,
        monthRevenue,
        trend,
        statusBreakdown,
        totalAppointments: (appointments ?? []).length,
        topCustomers,
        topServices,
        inventoryValue,
        outstanding,
        cashTotal,
        digitalTotal,
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

  const statusOrder: [string, string][] = [
    ["pending", "Pending"],
    ["confirmed", "Confirmed"],
    ["completed", "Completed"],
    ["cancelled", "Cancelled"],
    ["no_show", "No show"],
  ]
  const totalStatus = Object.values(data.statusBreakdown).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Reports &amp; Analytics</h1>
        <p className="text-sm text-muted-foreground">Business insights across the last 6 months.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={DollarSign} label="Today's revenue" value={`$${data.todayRevenue.toFixed(2)}`} accent="gold" />
        <Stat icon={Wallet} label="Revenue this month" value={`$${data.monthRevenue.toFixed(2)}`} />
        <Stat icon={Receipt} label="Outstanding payments" value={`$${data.outstanding.toFixed(2)}`} />
        <Stat icon={PackageSearch} label="Inventory value" value={`$${data.inventoryValue.toFixed(2)}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue trend (6 months)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.trend}>
              <defs>
                <linearGradient id="reportsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0.85} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "0.75rem" }}
              />
              <Bar dataKey="total" fill="url(#reportsGradient)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appointment funnel — this month</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {statusOrder.map(([key, label]) => {
              const count = data.statusBreakdown[key] ?? 0
              const pct = Math.round((count / totalStatus) * 100)
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{label}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="gradient-luxury h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cash vs digital — this month</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Cash</span>
              <span className="font-medium">${data.cashTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Digital</span>
              <span className="font-medium">${data.digitalTotal.toFixed(2)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="gradient-gold h-full"
                style={{
                  width: `${
                    data.cashTotal + data.digitalTotal === 0
                      ? 0
                      : (data.cashTotal / (data.cashTotal + data.digitalTotal)) * 100
                  }%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-accent" />
              <CardTitle className="text-base">Top services by revenue</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.topServices.length === 0 && (
              <p className="text-sm text-muted-foreground">No billed services this period.</p>
            )}
            {data.topServices.map((s, idx) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="w-6 justify-center">
                    {idx + 1}
                  </Badge>
                  {s.name}
                </span>
                <span className="font-medium">${s.total.toFixed(2)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-accent" />
              <CardTitle className="text-base">Top customers by spend</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.topCustomers.length === 0 && (
              <p className="text-sm text-muted-foreground">No paid invoices yet.</p>
            )}
            {data.topCustomers.map((c, idx) => (
              <div key={c.name + idx} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="w-6 justify-center">
                    {idx + 1}
                  </Badge>
                  {c.name}
                </span>
                <span className="font-medium">${c.total.toFixed(2)}</span>
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
  value: string
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
