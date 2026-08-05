import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ExportCsvButton } from "@/components/reports/ExportCsvButton"
import { Stat } from "@/pages/dashboard/reports/Stat"
import type { ReportFilters } from "@/pages/dashboard/reports/types"
import { pct } from "@/pages/dashboard/reports/utils"
import { CalendarCheck, UserX } from "lucide-react"

const STATUS_VARIANT: Record<string, "outline" | "success" | "destructive" | "secondary"> = {
  present: "success",
  absent: "destructive",
  late: "outline",
  half_day: "secondary",
  overtime: "secondary",
  leave: "outline",
}

export default function AttendanceReport({ filters }: { filters: ReportFilters }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-attendance", filters],
    queryFn: async () => {
      let q = supabase
        .from("attendance_records")
        .select("work_date, status, check_in_time, check_out_time, staff:profiles!attendance_records_staff_id_fkey(full_name)")
        .gte("work_date", filters.from)
        .lte("work_date", filters.to)
        .order("work_date", { ascending: false })
      if (filters.branchId) q = q.eq("branch_id", filters.branchId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((r) => ({
        staff: (r.staff as unknown as { full_name: string } | null)?.full_name ?? "Staff",
        date: format(new Date(r.work_date), "PP"),
        status: r.status,
        check_in: r.check_in_time ?? "—",
        check_out: r.check_out_time ?? "—",
      }))
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  const total = data.length || 1
  const presentPct = pct(data.filter((r) => r.status === "present" || r.status === "overtime").length, total)
  const absentPct = pct(data.filter((r) => r.status === "absent").length, total)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Stat icon={CalendarCheck} label="Present rate" value={`${presentPct.toFixed(1)}%`} accent="gold" />
        <Stat icon={UserX} label="Absent rate" value={`${absentPct.toFixed(1)}%`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Attendance — {filters.from} to {filters.to}</CardTitle>
          <ExportCsvButton
            rows={data}
            filename={`attendance-report-${filters.from}-to-${filters.to}`}
            columns={[
              { key: "staff", header: "Staff" },
              { key: "date", header: "Date" },
              { key: "status", header: "Status" },
              { key: "check_in", header: "Check-in" },
              { key: "check_out", header: "Check-out" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No attendance records in this period.
                  </TableCell>
                </TableRow>
              )}
              {data.map((r, idx) => (
                <TableRow key={r.staff + r.date + idx}>
                  <TableCell className="font-medium">{r.staff}</TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">
                      {r.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.check_in}</TableCell>
                  <TableCell>{r.check_out}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
