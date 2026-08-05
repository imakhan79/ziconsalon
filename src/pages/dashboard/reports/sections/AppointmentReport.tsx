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
import { rangeISO, pct } from "@/pages/dashboard/reports/utils"
import { CalendarDays, UserX, CalendarX, CheckCircle2 } from "lucide-react"

const STATUS_VARIANT: Record<string, "outline" | "success" | "destructive" | "secondary"> = {
  pending: "outline",
  confirmed: "secondary",
  completed: "success",
  cancelled: "destructive",
  no_show: "destructive",
}

export default function AppointmentReport({ filters }: { filters: ReportFilters }) {
  const { fromISO, toISO } = rangeISO(filters)

  const { data, isLoading } = useQuery({
    queryKey: ["report-appointments", filters],
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select(
          "start_time, status, customer:profiles!appointments_customer_id_fkey(full_name), staff:staff(profile:profiles!staff_id_fkey(full_name)), appointment_items(service:services(name))"
        )
        .gte("start_time", fromISO)
        .lte("start_time", toISO)
        .order("start_time", { ascending: false })
      if (filters.branchId) q = q.eq("branch_id", filters.branchId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((a) => ({
        date: format(new Date(a.start_time), "PPp"),
        customer: (a.customer as unknown as { full_name: string } | null)?.full_name ?? "—",
        staff:
          (a.staff as unknown as { profile: { full_name: string } | null } | null)?.profile?.full_name ?? "Unassigned",
        services: (a.appointment_items ?? [])
          .map((i) => (i.service as unknown as { name: string } | null)?.name)
          .filter(Boolean)
          .join(", "),
        status: a.status,
      }))
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  const total = data.length || 1
  const completedPct = pct(data.filter((a) => a.status === "completed").length, total)
  const noShowPct = pct(data.filter((a) => a.status === "no_show").length, total)
  const cancelledPct = pct(data.filter((a) => a.status === "cancelled").length, total)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={CalendarDays} label="Total appointments" value={String(data.length)} accent="gold" />
        <Stat icon={CheckCircle2} label="Completed" value={`${completedPct.toFixed(1)}%`} />
        <Stat icon={UserX} label="No-show" value={`${noShowPct.toFixed(1)}%`} />
        <Stat icon={CalendarX} label="Cancelled" value={`${cancelledPct.toFixed(1)}%`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Appointments — {filters.from} to {filters.to}</CardTitle>
          <ExportCsvButton
            rows={data}
            filename={`appointment-report-${filters.from}-to-${filters.to}`}
            columns={[
              { key: "date", header: "Date" },
              { key: "customer", header: "Customer" },
              { key: "staff", header: "Staff" },
              { key: "services", header: "Services" },
              { key: "status", header: "Status" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No appointments in this period.
                  </TableCell>
                </TableRow>
              )}
              {data.map((a, idx) => (
                <TableRow key={a.date + idx}>
                  <TableCell>{a.date}</TableCell>
                  <TableCell>{a.customer}</TableCell>
                  <TableCell>{a.staff}</TableCell>
                  <TableCell className="max-w-64 truncate">{a.services || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[a.status]} className="capitalize">
                      {a.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
