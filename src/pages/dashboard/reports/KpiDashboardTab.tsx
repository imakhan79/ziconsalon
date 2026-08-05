import { useQuery } from "@tanstack/react-query"
import { startOfDay, startOfWeek, startOfMonth, startOfYear, subMonths, addDays, eachDayOfInterval } from "date-fns"
import {
  DollarSign,
  CalendarDays,
  TrendingUp,
  Users,
  Repeat,
  Receipt,
  Clock,
  UserX,
  CalendarX,
  Globe,
  Footprints,
  Gauge,
  Building2,
  Scissors,
  UserCog,
  ShoppingBag,
  Trophy,
  Wallet,
  PackageSearch,
  CreditCard,
  Gift,
  Heart,
  Megaphone,
  PiggyBank,
  Percent,
  FileText,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Stat } from "@/pages/dashboard/reports/Stat"

const money = (n: number) => `Rs ${n.toFixed(2)}`
const pct = (a: number, b: number) => (b === 0 ? 0 : (a / b) * 100)
const fmtPct = (n: number) => `${n.toFixed(1)}%`

function timeStrToMinutes(t: string | null): number {
  if (!t) return 0
  const [h, m] = t.split(":").map(Number)
  return h * 60 + (m || 0)
}

export default function KpiDashboardTab({ branchId }: { branchId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-kpis", branchId],
    queryFn: async () => {
      const now = new Date()
      const dayStart = startOfDay(now).toISOString()
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString()
      const monthStart = startOfMonth(now).toISOString()
      const yearStart = startOfYear(now).toISOString()
      const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString()

      let invoiceQuery = supabase
        .from("invoices")
        .select("id, total, tax, status, created_at, customer_id, branch_id, appointment_id")
        .gte("created_at", yearStart)
      let apptQuery = supabase
        .from("appointments")
        .select(
          "id, status, start_time, staff_id, branch_id, created_by, creator:profiles!appointments_created_by_fkey(role), appointment_items(duration_minutes)"
        )
        .gte("start_time", yearStart)
      let expenseQuery = supabase
        .from("expenses")
        .select("amount, expense_date, branch_id")
        .gte("expense_date", monthStart)
      let giftCardQuery = supabase
        .from("gift_cards")
        .select("initial_value, created_at, branch_id")
        .gte("created_at", monthStart)
      let campaignQuery = supabase
        .from("campaigns")
        .select("id, sent_at, budget_cost, branch_id, status")
        .eq("status", "sent")
        .not("budget_cost", "is", null)
        .gte("sent_at", yearStart)
      let outstandingQuery = supabase.from("invoices").select("total, status, branch_id").in("status", ["unpaid", "partial"])
      let paymentQuery = supabase.from("payments").select("amount, method, paid_at, invoice:invoices(branch_id)").gte("paid_at", monthStart)

      if (branchId) {
        invoiceQuery = invoiceQuery.eq("branch_id", branchId)
        apptQuery = apptQuery.eq("branch_id", branchId)
        expenseQuery = expenseQuery.eq("branch_id", branchId)
        giftCardQuery = giftCardQuery.eq("branch_id", branchId)
        campaignQuery = campaignQuery.eq("branch_id", branchId)
        outstandingQuery = outstandingQuery.eq("branch_id", branchId)
      }

      const [
        { data: invoices },
        { data: appointments },
        { data: invoiceItems },
        { data: expenses },
        { data: memberships },
        { data: giftCards },
        { data: campaigns },
        { data: customers },
        { data: allTimePaid },
        { data: valuationRows },
        { data: shifts },
        { data: branches },
        { data: staffList },
        { data: outstandingInvoices },
        { data: payments },
      ] = await Promise.all([
        invoiceQuery,
        apptQuery,
        supabase
          .from("invoice_items")
          .select(
            "invoice_id, line_total, quantity, service_id, product_id, service:services(name), product:products(name, cost_price), invoice:invoices(created_at, status, branch_id, appointment_id)"
          ),
        expenseQuery,
        supabase.from("customer_memberships").select("customer_id, started_at, plan:membership_plans(price)").gte("started_at", monthStart),
        giftCardQuery,
        campaignQuery,
        supabase.from("profiles").select("id, full_name, created_at, branch_id").eq("role", "customer"),
        supabase.from("invoices").select("customer_id, total").eq("status", "paid"),
        supabase.from("inventory_valuation").select("branch_id, total_value"),
        supabase.from("shifts").select("staff_id, branch_id, start_time, end_time, days_of_week"),
        supabase.from("branches").select("id, name"),
        supabase.from("staff").select("id, profile:profiles!staff_id_fkey(full_name)"),
        outstandingQuery,
        paymentQuery,
      ])

      const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]))
      const staffName = new Map(
        (staffList ?? []).map((s) => [s.id, (s.profile as unknown as { full_name: string } | null)?.full_name ?? "Staff"])
      )
      const apptStaffOf = new Map((appointments ?? []).map((a) => [a.id, a.staff_id]))

      // ---- Revenue windows ----
      const paidThisYear = (invoices ?? []).filter((i) => i.status === "paid")
      const revenueIn = (from: string) => paidThisYear.filter((i) => i.created_at >= from).reduce((s, i) => s + Number(i.total), 0)
      const todayRevenue = revenueIn(dayStart)
      const weekRevenue = revenueIn(weekStart)
      const monthRevenue = revenueIn(monthStart)
      const yearRevenue = revenueIn(yearStart)
      const paidThisMonth = paidThisYear.filter((i) => i.created_at >= monthStart)

      // ---- Appointments this month ----
      const apptsThisMonth = (appointments ?? []).filter((a) => a.start_time >= monthStart)
      const todayAppointments = (appointments ?? []).filter((a) => a.start_time >= dayStart).length
      const noShowPct = pct(apptsThisMonth.filter((a) => a.status === "no_show").length, apptsThisMonth.length)
      const cancellationPct = pct(apptsThisMonth.filter((a) => a.status === "cancelled").length, apptsThisMonth.length)
      const withCreator = apptsThisMonth.filter((a) => a.created_by)
      const onlineCount = withCreator.filter(
        (a) => (a.creator as unknown as { role: string } | null)?.role === "customer"
      ).length
      const walkInCount = withCreator.filter(
        (a) => (a.creator as unknown as { role: string } | null)?.role !== "customer"
      ).length
      const onlinePct = pct(onlineCount, withCreator.length)
      const walkInPct = pct(walkInCount, withCreator.length)

      const allDurations = apptsThisMonth.flatMap((a) => (a.appointment_items ?? []).map((i) => i.duration_minutes))
      const avgServiceDuration = allDurations.length
        ? allDurations.reduce((s, d) => s + d, 0) / allDurations.length
        : 0

      // ---- Staff utilization (this month to date) ----
      const daysThisMonth = eachDayOfInterval({ start: new Date(monthStart), end: now })
      const bookedByStaff = new Map<string, number>()
      for (const a of apptsThisMonth) {
        if (!a.staff_id || !["completed", "confirmed"].includes(a.status)) continue
        const mins = (a.appointment_items ?? []).reduce((s, i) => s + i.duration_minutes, 0)
        bookedByStaff.set(a.staff_id, (bookedByStaff.get(a.staff_id) ?? 0) + mins)
      }
      const availableByStaff = new Map<string, number>()
      for (const shift of shifts ?? []) {
        const shiftMinutes = timeStrToMinutes(shift.end_time) - timeStrToMinutes(shift.start_time)
        if (shiftMinutes <= 0) continue
        const daysHit = daysThisMonth.filter((d) => (shift.days_of_week ?? []).includes(d.getDay())).length
        availableByStaff.set(shift.staff_id, (availableByStaff.get(shift.staff_id) ?? 0) + shiftMinutes * daysHit)
      }
      const utilizations = [...availableByStaff.entries()]
        .filter(([, avail]) => avail > 0)
        .map(([staffId, avail]) => pct(bookedByStaff.get(staffId) ?? 0, avail))
      const staffUtilization = utilizations.length ? utilizations.reduce((s, u) => s + u, 0) / utilizations.length : 0

      // ---- Customer growth & repeat ----
      const newThisMonth = (customers ?? []).filter((c) => c.created_at >= monthStart).length
      const newLastMonth = (customers ?? []).filter((c) => c.created_at >= lastMonthStart && c.created_at < monthStart).length
      const customerGrowthPct = newLastMonth === 0 ? (newThisMonth > 0 ? 100 : 0) : pct(newThisMonth - newLastMonth, newLastMonth)

      const paidCountByCustomer = new Map<string, number>()
      const lifetimeSpendByCustomer = new Map<string, number>()
      for (const inv of allTimePaid ?? []) {
        paidCountByCustomer.set(inv.customer_id, (paidCountByCustomer.get(inv.customer_id) ?? 0) + 1)
        lifetimeSpendByCustomer.set(inv.customer_id, (lifetimeSpendByCustomer.get(inv.customer_id) ?? 0) + Number(inv.total))
      }
      const activeThisMonth = new Set(paidThisMonth.map((i) => i.customer_id))
      const repeatCount = [...activeThisMonth].filter((id) => (paidCountByCustomer.get(id) ?? 0) > 1).length
      const repeatPct = pct(repeatCount, activeThisMonth.size)
      const clvValues = [...lifetimeSpendByCustomer.values()]
      const avgClv = clvValues.length ? clvValues.reduce((s, v) => s + v, 0) / clvValues.length : 0

      const avgTicket = paidThisMonth.length ? monthRevenue / paidThisMonth.length : 0

      // ---- Revenue breakdowns (this month, from invoice_items) ----
      const itemsThisMonth = (invoiceItems ?? []).filter((it) => {
        const inv = it.invoice as unknown as { created_at: string; status: string; branch_id: string | null; appointment_id: string | null } | null
        if (!inv || inv.status !== "paid" || inv.created_at < monthStart) return false
        if (branchId && inv.branch_id !== branchId) return false
        return true
      })

      const byService = new Map<string, number>()
      const byProductRevenue = new Map<string, number>()
      const byProductQty = new Map<string, number>()
      for (const it of itemsThisMonth) {
        const svcName = (it.service as unknown as { name: string } | null)?.name
        if (svcName) byService.set(svcName, (byService.get(svcName) ?? 0) + Number(it.line_total))
        const prodName = (it.product as unknown as { name: string } | null)?.name
        if (prodName) {
          byProductRevenue.set(prodName, (byProductRevenue.get(prodName) ?? 0) + Number(it.line_total))
          byProductQty.set(prodName, (byProductQty.get(prodName) ?? 0) + Number(it.quantity))
        }
      }
      const topN = (m: Map<string, number>, n = 5) =>
        [...m.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, n)

      const byBranch = new Map<string, number>()
      const byStaff = new Map<string, number>()
      for (const inv of paidThisMonth) {
        byBranch.set(inv.branch_id ?? "—", (byBranch.get(inv.branch_id ?? "—") ?? 0) + Number(inv.total))
        const staffId = inv.appointment_id ? apptStaffOf.get(inv.appointment_id) : null
        if (staffId) byStaff.set(staffId, (byStaff.get(staffId) ?? 0) + Number(inv.total))
      }
      const revenueByBranch = [...byBranch.entries()]
        .map(([id, total]) => ({ name: branchName.get(id) ?? "Unassigned", total }))
        .sort((a, b) => b.total - a.total)
      const revenueByStaff = [...byStaff.entries()]
        .map(([id, total]) => ({ name: staffName.get(id) ?? "Staff", total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)

      const customerName = new Map((customers ?? []).map((c) => [c.id, c.full_name]))
      const spendByCustomer = new Map<string, number>()
      for (const inv of paidThisMonth) {
        spendByCustomer.set(inv.customer_id, (spendByCustomer.get(inv.customer_id) ?? 0) + Number(inv.total))
      }
      const topCustomers = [...spendByCustomer.entries()]
        .map(([id, total]) => ({ name: customerName.get(id) ?? "Unknown", total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)

      // ---- Inventory & outstanding ----
      const inventoryValue = (valuationRows ?? [])
        .filter((r) => !branchId || r.branch_id === branchId)
        .reduce((s, r) => s + Number(r.total_value), 0)
      const outstanding = (outstandingInvoices ?? []).reduce((s, i) => s + Number(i.total), 0)

      // ---- Cash vs digital (this month) ----
      const scopedPayments = (payments ?? []).filter((p) => {
        if (!branchId) return true
        const inv = p.invoice as unknown as { branch_id: string | null } | null
        return inv?.branch_id === branchId
      })
      const cashTotal = scopedPayments.filter((p) => p.method === "cash").reduce((s, p) => s + Number(p.amount), 0)
      const digitalTotal = scopedPayments.filter((p) => p.method !== "cash").reduce((s, p) => s + Number(p.amount), 0)

      // ---- Membership & gift card sales ----
      const membershipSales = (memberships ?? []).reduce(
        (s, m) => s + Number((m.plan as unknown as { price: number } | null)?.price ?? 0),
        0
      )
      const giftCardSales = (giftCards ?? []).reduce((s, g) => s + Number(g.initial_value), 0)

      // ---- Campaign ROI (aggregate, this year) ----
      let campaignRoiPct: number | null = null
      if (campaigns && campaigns.length > 0) {
        const campaignIds = campaigns.map((c) => c.id)
        const { data: recipients } = await supabase
          .from("campaign_recipients")
          .select("campaign_id, customer_id")
          .in("campaign_id", campaignIds)
        const recipientsByCampaign = new Map<string, Set<string>>()
        for (const r of recipients ?? []) {
          if (!recipientsByCampaign.has(r.campaign_id)) recipientsByCampaign.set(r.campaign_id, new Set())
          recipientsByCampaign.get(r.campaign_id)!.add(r.customer_id)
        }
        let attributedRevenue = 0
        let totalCost = 0
        for (const c of campaigns) {
          totalCost += Number(c.budget_cost)
          if (!c.sent_at) continue
          const custIds = recipientsByCampaign.get(c.id) ?? new Set()
          const windowEnd = addDays(new Date(c.sent_at), 30).toISOString()
          attributedRevenue += paidThisYear
            .filter((inv) => custIds.has(inv.customer_id) && inv.created_at >= c.sent_at! && inv.created_at <= windowEnd)
            .reduce((s, inv) => s + Number(inv.total), 0)
        }
        campaignRoiPct = totalCost > 0 ? pct(attributedRevenue - totalCost, totalCost) : null
      }

      // ---- Profit margin / net income / tax (this month) ----
      const cogs = itemsThisMonth
        .filter((it) => it.product_id)
        .reduce((s, it) => s + Number(it.quantity) * Number((it.product as unknown as { cost_price: number } | null)?.cost_price ?? 0), 0)
      const expenseTotal = (expenses ?? [])
        .filter((e) => !branchId || e.branch_id === branchId)
        .reduce((s, e) => s + Number(e.amount), 0)
      const netIncome = monthRevenue - cogs - expenseTotal
      const profitMarginPct = pct(netIncome, monthRevenue)
      const taxCollected = paidThisMonth.reduce((s, i) => s + Number(i.tax), 0)

      return {
        todayAppointments,
        todayRevenue,
        weekRevenue,
        monthRevenue,
        yearRevenue,
        customerGrowthPct,
        repeatPct,
        avgTicket,
        avgServiceDuration,
        noShowPct,
        cancellationPct,
        onlinePct,
        walkInPct,
        staffUtilization,
        revenueByBranch,
        topServices: topN(byService),
        revenueByStaff,
        revenueByProduct: topN(byProductRevenue),
        topCustomers,
        topSellingProducts: [...byProductQty.entries()]
          .map(([name, qty]) => ({ name, qty }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5),
        inventoryValue,
        outstanding,
        cashTotal,
        digitalTotal,
        membershipSales,
        giftCardSales,
        avgClv,
        campaignRoiPct,
        profitMarginPct,
        netIncome,
        taxCollected,
      }
    },
  })

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  const paymentTotal = data.cashTotal + data.digitalTotal || 1

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Fixed-period figures (today / week / month / year) are always current. Breakdown lists reflect the current
        calendar month to date.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={CalendarDays} label="Today's appointments" value={String(data.todayAppointments)} />
        <Stat icon={DollarSign} label="Today's revenue" value={money(data.todayRevenue)} accent="gold" />
        <Stat icon={Wallet} label="This week's revenue" value={money(data.weekRevenue)} />
        <Stat icon={TrendingUp} label="This month's revenue" value={money(data.monthRevenue)} accent="gold" />
        <Stat icon={PiggyBank} label="This year's revenue" value={money(data.yearRevenue)} />
        <Stat icon={Users} label="Customer growth (MoM)" value={fmtPct(data.customerGrowthPct)} />
        <Stat icon={Repeat} label="Repeat customers" value={fmtPct(data.repeatPct)} />
        <Stat icon={Receipt} label="Average ticket size" value={money(data.avgTicket)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Clock} label="Avg. service duration" value={`${data.avgServiceDuration.toFixed(0)} min`} />
        <Stat icon={UserX} label="No-show rate" value={fmtPct(data.noShowPct)} />
        <Stat icon={CalendarX} label="Cancellation rate" value={fmtPct(data.cancellationPct)} />
        <Stat icon={Globe} label="Online bookings" value={fmtPct(data.onlinePct)} />
        <Stat icon={Footprints} label="Walk-in bookings" value={fmtPct(data.walkInPct)} />
        <Stat icon={Gauge} label="Staff utilization" value={fmtPct(data.staffUtilization)} />
        <Stat icon={PackageSearch} label="Inventory value" value={money(data.inventoryValue)} />
        <Stat icon={Receipt} label="Outstanding payments" value={money(data.outstanding)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Heart} label="Membership sales (month)" value={money(data.membershipSales)} />
        <Stat icon={Gift} label="Gift card sales (month)" value={money(data.giftCardSales)} />
        <Stat icon={Users} label="Avg. customer lifetime value" value={money(data.avgClv)} />
        <Stat
          icon={Megaphone}
          label="Campaign ROI (year)"
          value={data.campaignRoiPct === null ? "N/A" : fmtPct(data.campaignRoiPct)}
        />
        <Stat icon={Percent} label="Profit margin (month)" value={fmtPct(data.profitMarginPct)} accent="gold" />
        <Stat icon={DollarSign} label="Net income (month)" value={money(data.netIncome)} />
        <Stat icon={FileText} label="Tax collected (month)" value={money(data.taxCollected)} />
        <Stat icon={CreditCard} label="Cash share of payments" value={fmtPct((data.cashTotal / paymentTotal) * 100)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-accent" />
              <CardTitle className="text-base">Revenue by branch — this month</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.revenueByBranch.length === 0 && <p className="text-sm text-muted-foreground">No revenue yet.</p>}
            {data.revenueByBranch.map((b, idx) => (
              <RankRow key={b.name + idx} idx={idx} label={b.name} value={money(b.total)} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCog className="size-4 text-accent" />
              <CardTitle className="text-base">Revenue by staff — this month</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.revenueByStaff.length === 0 && <p className="text-sm text-muted-foreground">No attributed revenue yet.</p>}
            {data.revenueByStaff.map((s, idx) => (
              <RankRow key={s.name + idx} idx={idx} label={s.name} value={money(s.total)} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Scissors className="size-4 text-accent" />
              <CardTitle className="text-base">Top services by revenue — this month</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.topServices.length === 0 && <p className="text-sm text-muted-foreground">No billed services this period.</p>}
            {data.topServices.map((s, idx) => (
              <RankRow key={s.name + idx} idx={idx} label={s.name} value={money(s.total)} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-accent" />
              <CardTitle className="text-base">Top customers by spend — this month</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.topCustomers.length === 0 && <p className="text-sm text-muted-foreground">No paid invoices yet.</p>}
            {data.topCustomers.map((c, idx) => (
              <RankRow key={c.name + idx} idx={idx} label={c.name} value={money(c.total)} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShoppingBag className="size-4 text-accent" />
              <CardTitle className="text-base">Revenue by product — this month</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.revenueByProduct.length === 0 && <p className="text-sm text-muted-foreground">No product sales this period.</p>}
            {data.revenueByProduct.map((p, idx) => (
              <RankRow key={p.name + idx} idx={idx} label={p.name} value={money(p.total)} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-accent" />
              <CardTitle className="text-base">Top selling products (qty) — this month</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.topSellingProducts.length === 0 && <p className="text-sm text-muted-foreground">No product sales this period.</p>}
            {data.topSellingProducts.map((p, idx) => (
              <RankRow key={p.name + idx} idx={idx} label={p.name} value={String(p.qty)} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cash vs digital — this month</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Cash</span>
              <span className="font-medium">{money(data.cashTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Digital</span>
              <span className="font-medium">{money(data.digitalTotal)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="gradient-gold h-full" style={{ width: `${(data.cashTotal / paymentTotal) * 100}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function RankRow({ idx, label, value }: { idx: number; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 truncate">
        <Badge variant="outline" className="w-6 shrink-0 justify-center">
          {idx + 1}
        </Badge>
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 font-medium">{value}</span>
    </div>
  )
}
