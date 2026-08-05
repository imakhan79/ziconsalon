import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ExportCsvButton } from "@/components/reports/ExportCsvButton"
import type { ReportFilters } from "@/pages/dashboard/reports/types"
import { rangeISO, money } from "@/pages/dashboard/reports/utils"

export default function ServicePopularityReport({ filters }: { filters: ReportFilters }) {
  const { fromISO, toISO } = rangeISO(filters)

  const { data, isLoading } = useQuery({
    queryKey: ["report-service-popularity", filters],
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("start_time, appointment_items(price, duration_minutes, service:services(name))")
        .gte("start_time", fromISO)
        .lte("start_time", toISO)
      if (filters.branchId) q = q.eq("branch_id", filters.branchId)
      const { data, error } = await q
      if (error) throw error

      const byService = new Map<string, { bookings: number; revenue: number; minutes: number }>()
      for (const a of data ?? []) {
        for (const item of a.appointment_items ?? []) {
          const name = (item.service as unknown as { name: string } | null)?.name ?? "Unknown"
          const cur = byService.get(name) ?? { bookings: 0, revenue: 0, minutes: 0 }
          cur.bookings += 1
          cur.revenue += Number(item.price)
          cur.minutes += item.duration_minutes
          byService.set(name, cur)
        }
      }
      return [...byService.entries()]
        .map(([name, v]) => ({
          name,
          bookings: v.bookings,
          revenue: v.revenue,
          avg_duration: Math.round(v.minutes / v.bookings),
        }))
        .sort((a, b) => b.bookings - a.bookings)
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Service popularity — {filters.from} to {filters.to}</CardTitle>
        <ExportCsvButton
          rows={data}
          filename={`service-popularity-${filters.from}-to-${filters.to}`}
          columns={[
            { key: "name", header: "Service" },
            { key: "bookings", header: "Bookings" },
            { key: "revenue", header: "Revenue" },
            { key: "avg_duration", header: "Avg duration (min)" },
          ]}
        />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Bookings</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Avg. duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No services booked in this period.
                </TableCell>
              </TableRow>
            )}
            {data.map((s) => (
              <TableRow key={s.name}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.bookings}</TableCell>
                <TableCell>{money(s.revenue)}</TableCell>
                <TableCell>{s.avg_duration} min</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
