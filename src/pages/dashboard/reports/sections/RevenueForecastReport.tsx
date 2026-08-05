import { useQuery } from "@tanstack/react-query"
import { format, startOfMonth, subMonths } from "date-fns"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ExportCsvButton } from "@/components/reports/ExportCsvButton"
import type { ReportFilters } from "@/pages/dashboard/reports/types"
import { linearForecast } from "@/lib/forecast"

const PERIODS_AHEAD = 3
const HISTORY_MONTHS = 6

export default function RevenueForecastReport({ filters }: { filters: ReportFilters }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-forecast", filters.branchId],
    queryFn: async () => {
      const start = startOfMonth(subMonths(new Date(), HISTORY_MONTHS - 1)).toISOString()
      let q = supabase.from("invoices").select("total, status, created_at, branch_id").eq("status", "paid").gte("created_at", start)
      if (filters.branchId) q = q.eq("branch_id", filters.branchId)
      const { data, error } = await q
      if (error) throw error

      const byMonth = new Map<string, number>()
      for (const inv of data ?? []) {
        const key = format(new Date(inv.created_at), "MMM yyyy")
        byMonth.set(key, (byMonth.get(key) ?? 0) + Number(inv.total))
      }
      const months: string[] = []
      for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
        months.push(format(subMonths(new Date(), i), "MMM yyyy"))
      }
      const actuals = months.map((m) => byMonth.get(m) ?? 0)
      const forecast = linearForecast(actuals, PERIODS_AHEAD)
      const forecastMonths = Array.from({ length: PERIODS_AHEAD }, (_, i) =>
        format(new Date(new Date().getFullYear(), new Date().getMonth() + i + 1, 1), "MMM yyyy")
      )

      const chartRows = [
        ...months.map((m, i) => ({ month: m, actual: actuals[i], projected: null as number | null })),
        ...forecastMonths.map((m, i) => ({ month: m, actual: null as number | null, projected: forecast[i] })),
      ]
      return { chartRows, csvRows: chartRows.map((r) => ({ month: r.month, actual: r.actual ?? "", projected: r.projected ?? "" })) }
    },
  })

  if (isLoading || !data) return <Skeleton className="h-72" />

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Revenue forecast — next {PERIODS_AHEAD} months</CardTitle>
        <ExportCsvButton
          rows={data.csvRows}
          filename="revenue-forecast"
          columns={[
            { key: "month", header: "Month" },
            { key: "actual", header: "Actual" },
            { key: "projected", header: "Projected" },
          ]}
        />
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.chartRows}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "0.75rem" }}
            />
            <Legend />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="var(--color-primary)" strokeWidth={2} connectNulls={false} />
            <Line
              type="monotone"
              dataKey="projected"
              name="Projected"
              stroke="var(--color-gold)"
              strokeWidth={2}
              strokeDasharray="5 5"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
