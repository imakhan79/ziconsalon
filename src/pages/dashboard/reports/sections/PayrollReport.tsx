import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ExportCsvButton } from "@/components/reports/ExportCsvButton"
import { Stat } from "@/pages/dashboard/reports/Stat"
import type { ReportFilters } from "@/pages/dashboard/reports/types"
import { rangeISO, money } from "@/pages/dashboard/reports/utils"
import { Wallet, HandCoins } from "lucide-react"

export default function PayrollReport({ filters }: { filters: ReportFilters }) {
  const { fromISO, toISO } = rangeISO(filters)

  const { data, isLoading } = useQuery({
    queryKey: ["report-payroll", filters],
    queryFn: async () => {
      const { data: staffRows, error: staffErr } = await supabase
        .from("staff")
        .select("id, profile:profiles!staff_id_fkey(full_name), commission_rate, compensation:staff_compensation(salary)")
      if (staffErr) throw staffErr

      let apptQ = supabase
        .from("appointments")
        .select("staff_id, status, start_time, appointment_items(price, service:services(commission_override))")
        .eq("status", "completed")
        .not("staff_id", "is", null)
        .gte("start_time", fromISO)
        .lte("start_time", toISO)
      if (filters.branchId) apptQ = apptQ.eq("branch_id", filters.branchId)
      const { data: appts, error: apptErr } = await apptQ
      if (apptErr) throw apptErr

      const commissionByStaff = new Map<string, number>()
      const rateByStaff = new Map((staffRows ?? []).map((s) => [s.id, s.commission_rate]))
      for (const a of appts ?? []) {
        if (!a.staff_id) continue
        const baseRate = rateByStaff.get(a.staff_id) ?? 0
        for (const item of a.appointment_items ?? []) {
          const override = (item.service as unknown as { commission_override: number | null } | null)?.commission_override
          const rate = override ?? baseRate
          commissionByStaff.set(a.staff_id, (commissionByStaff.get(a.staff_id) ?? 0) + (Number(item.price) * rate) / 100)
        }
      }

      return (staffRows ?? [])
        .map((s) => {
          const salary = (s.compensation as unknown as { salary: number | null } | null)?.salary ?? 0
          const commission = commissionByStaff.get(s.id) ?? 0
          return {
            name: (s.profile as unknown as { full_name: string } | null)?.full_name ?? "Staff",
            salary: Number(salary),
            commission,
            total: Number(salary) + commission,
          }
        })
        .sort((a, b) => b.total - a.total)
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  const totalSalary = data.reduce((s, r) => s + r.salary, 0)
  const totalCommission = data.reduce((s, r) => s + r.commission, 0)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Salary shown is the staff member's current base salary (not prorated). Commission reflects completed
        appointments within the selected period.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Stat icon={Wallet} label="Total base salary" value={money(totalSalary)} accent="gold" />
        <Stat icon={HandCoins} label="Total commission (period)" value={money(totalCommission)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Payroll — {filters.from} to {filters.to}</CardTitle>
          <ExportCsvButton
            rows={data}
            filename={`payroll-report-${filters.from}-to-${filters.to}`}
            columns={[
              { key: "name", header: "Staff" },
              { key: "salary", header: "Base salary" },
              { key: "commission", header: "Commission" },
              { key: "total", header: "Total payout" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Base salary</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Total payout</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No staff records found.
                  </TableCell>
                </TableRow>
              )}
              {data.map((r, idx) => (
                <TableRow key={r.name + idx}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{money(r.salary)}</TableCell>
                  <TableCell>{money(r.commission)}</TableCell>
                  <TableCell className="font-medium">{money(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
