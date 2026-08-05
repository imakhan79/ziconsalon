import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ExportCsvButton } from "@/components/reports/ExportCsvButton"
import type { ReportFilters } from "@/pages/dashboard/reports/types"
import { rangeISO, money } from "@/pages/dashboard/reports/utils"

export default function StaffPerformanceReport({ filters }: { filters: ReportFilters }) {
  const { fromISO, toISO } = rangeISO(filters)

  const { data, isLoading } = useQuery({
    queryKey: ["report-staff-performance", filters],
    queryFn: async () => {
      let apptQ = supabase
        .from("appointments")
        .select("staff_id, status, start_time, staff:staff(profile:profiles!staff_id_fkey(full_name)), appointment_items(price)")
        .eq("status", "completed")
        .not("staff_id", "is", null)
        .gte("start_time", fromISO)
        .lte("start_time", toISO)
      if (filters.branchId) apptQ = apptQ.eq("branch_id", filters.branchId)

      const [{ data: appts, error: apptErr }, { data: reviews, error: revErr }] = await Promise.all([
        apptQ,
        supabase
          .from("reviews")
          .select("staff_id, rating, created_at")
          .not("staff_id", "is", null)
          .gte("created_at", fromISO)
          .lte("created_at", toISO),
      ])
      if (apptErr) throw apptErr
      if (revErr) throw revErr

      const byStaff = new Map<string, { name: string; appointments: number; revenue: number }>()
      for (const a of appts ?? []) {
        if (!a.staff_id) continue
        const name = (a.staff as unknown as { profile: { full_name: string } | null } | null)?.profile?.full_name ?? "Staff"
        const cur = byStaff.get(a.staff_id) ?? { name, appointments: 0, revenue: 0 }
        cur.appointments += 1
        cur.revenue += (a.appointment_items ?? []).reduce((s, i) => s + Number(i.price), 0)
        byStaff.set(a.staff_id, cur)
      }
      const ratingByStaff = new Map<string, { sum: number; count: number }>()
      for (const r of reviews ?? []) {
        if (!r.staff_id) continue
        const cur = ratingByStaff.get(r.staff_id) ?? { sum: 0, count: 0 }
        cur.sum += r.rating
        cur.count += 1
        ratingByStaff.set(r.staff_id, cur)
      }

      return [...byStaff.entries()]
        .map(([id, v]) => {
          const rating = ratingByStaff.get(id)
          return {
            name: v.name,
            appointments: v.appointments,
            revenue: v.revenue,
            avg_ticket: v.appointments ? v.revenue / v.appointments : 0,
            avg_rating: rating ? rating.sum / rating.count : null,
          }
        })
        .sort((a, b) => b.revenue - a.revenue)
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Staff performance — {filters.from} to {filters.to}</CardTitle>
        <ExportCsvButton
          rows={data}
          filename={`staff-performance-${filters.from}-to-${filters.to}`}
          columns={[
            { key: "name", header: "Staff" },
            { key: "appointments", header: "Appointments" },
            { key: "revenue", header: "Revenue" },
            { key: "avg_ticket", header: "Avg ticket" },
            { key: "avg_rating", header: "Avg rating" },
          ]}
        />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Appointments</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Avg. ticket</TableHead>
              <TableHead>Avg. rating</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No completed appointments in this period.
                </TableCell>
              </TableRow>
            )}
            {data.map((r, idx) => (
              <TableRow key={r.name + idx}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.appointments}</TableCell>
                <TableCell>{money(r.revenue)}</TableCell>
                <TableCell>{money(r.avg_ticket)}</TableCell>
                <TableCell>{r.avg_rating !== null ? `${r.avg_rating.toFixed(1)} ★` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
