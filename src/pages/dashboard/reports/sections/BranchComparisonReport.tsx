import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ExportCsvButton } from "@/components/reports/ExportCsvButton"
import type { ReportFilters } from "@/pages/dashboard/reports/types"
import { rangeISO, money } from "@/pages/dashboard/reports/utils"

export default function BranchComparisonReport({ filters }: { filters: ReportFilters }) {
  const { fromISO, toISO } = rangeISO(filters)

  const { data, isLoading } = useQuery({
    queryKey: ["report-branch-comparison", filters.from, filters.to],
    queryFn: async () => {
      const [{ data: branches, error: bErr }, { data: invoices, error: iErr }, { data: appts, error: aErr }] =
        await Promise.all([
          supabase.from("branches").select("id, name"),
          supabase
            .from("invoices")
            .select("branch_id, total, status, created_at")
            .eq("status", "paid")
            .gte("created_at", fromISO)
            .lte("created_at", toISO),
          supabase.from("appointments").select("branch_id, start_time").gte("start_time", fromISO).lte("start_time", toISO),
        ])
      if (bErr) throw bErr
      if (iErr) throw iErr
      if (aErr) throw aErr

      const revenueByBranch = new Map<string, number>()
      const invoiceCountByBranch = new Map<string, number>()
      for (const inv of invoices ?? []) {
        const key = inv.branch_id ?? "—"
        revenueByBranch.set(key, (revenueByBranch.get(key) ?? 0) + Number(inv.total))
        invoiceCountByBranch.set(key, (invoiceCountByBranch.get(key) ?? 0) + 1)
      }
      const apptCountByBranch = new Map<string, number>()
      for (const a of appts ?? []) {
        const key = a.branch_id ?? "—"
        apptCountByBranch.set(key, (apptCountByBranch.get(key) ?? 0) + 1)
      }

      return (branches ?? [])
        .map((b) => {
          const revenue = revenueByBranch.get(b.id) ?? 0
          const invoiceCount = invoiceCountByBranch.get(b.id) ?? 0
          return {
            name: b.name,
            revenue,
            appointments: apptCountByBranch.get(b.id) ?? 0,
            avg_ticket: invoiceCount ? revenue / invoiceCount : 0,
          }
        })
        .sort((a, b) => b.revenue - a.revenue)
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Branch comparison — {filters.from} to {filters.to}</CardTitle>
        <ExportCsvButton
          rows={data}
          filename={`branch-comparison-${filters.from}-to-${filters.to}`}
          columns={[
            { key: "name", header: "Branch" },
            { key: "revenue", header: "Revenue" },
            { key: "appointments", header: "Appointments" },
            { key: "avg_ticket", header: "Avg ticket" },
          ]}
        />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Appointments</TableHead>
              <TableHead>Avg. ticket</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No branches found.
                </TableCell>
              </TableRow>
            )}
            {data.map((r, idx) => (
              <TableRow key={r.name + idx}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{money(r.revenue)}</TableCell>
                <TableCell>{r.appointments}</TableCell>
                <TableCell>{money(r.avg_ticket)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
