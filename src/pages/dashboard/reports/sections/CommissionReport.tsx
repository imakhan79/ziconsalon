import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ExportCsvButton } from "@/components/reports/ExportCsvButton"
import { Stat } from "@/pages/dashboard/reports/Stat"
import type { ReportFilters } from "@/pages/dashboard/reports/types"
import { rangeISO, money } from "@/pages/dashboard/reports/utils"
import { HandCoins, Wallet } from "lucide-react"

export default function CommissionReport({ filters }: { filters: ReportFilters }) {
  const { fromISO, toISO } = rangeISO(filters)

  const { data, isLoading } = useQuery({
    queryKey: ["report-commission", filters],
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select(
          "staff_id, status, start_time, staff:staff(commission_rate, profile:profiles!staff_id_fkey(full_name)), appointment_items(price, service:services(commission_override))"
        )
        .eq("status", "completed")
        .not("staff_id", "is", null)
        .gte("start_time", fromISO)
        .lte("start_time", toISO)
      if (filters.branchId) q = q.eq("branch_id", filters.branchId)
      const { data, error } = await q
      if (error) throw error

      const byStaff = new Map<string, { name: string; revenue: number; commission: number }>()
      for (const a of data ?? []) {
        if (!a.staff_id) continue
        const staffInfo = a.staff as unknown as {
          commission_rate: number
          profile: { full_name: string } | null
        } | null
        const name = staffInfo?.profile?.full_name ?? "Staff"
        const cur = byStaff.get(a.staff_id) ?? { name, revenue: 0, commission: 0 }
        for (const item of a.appointment_items ?? []) {
          const svcOverride = (item.service as unknown as { commission_override: number | null } | null)
            ?.commission_override
          const rate = svcOverride ?? staffInfo?.commission_rate ?? 0
          cur.revenue += Number(item.price)
          cur.commission += (Number(item.price) * rate) / 100
        }
        byStaff.set(a.staff_id, cur)
      }
      return [...byStaff.values()].sort((a, b) => b.commission - a.commission)
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  const totalCommission = data.reduce((s, r) => s + r.commission, 0)
  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Stat icon={HandCoins} label="Total commission owed" value={money(totalCommission)} accent="gold" />
        <Stat icon={Wallet} label="Attributed revenue" value={money(totalRevenue)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Commission — {filters.from} to {filters.to}</CardTitle>
          <ExportCsvButton
            rows={data}
            filename={`commission-report-${filters.from}-to-${filters.to}`}
            columns={[
              { key: "name", header: "Staff" },
              { key: "revenue", header: "Revenue" },
              { key: "commission", header: "Commission" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No completed appointments in this period.
                  </TableCell>
                </TableRow>
              )}
              {data.map((r, idx) => (
                <TableRow key={r.name + idx}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{money(r.revenue)}</TableCell>
                  <TableCell>{money(r.commission)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
