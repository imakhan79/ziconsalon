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
import { rangeISO, money, pct } from "@/pages/dashboard/reports/utils"
import { Users, Repeat, UserPlus } from "lucide-react"

export default function CustomerRetentionReport({ filters }: { filters: ReportFilters }) {
  const { fromISO, toISO } = rangeISO(filters)

  const { data, isLoading } = useQuery({
    queryKey: ["report-retention", filters],
    queryFn: async () => {
      let q = supabase
        .from("invoices")
        .select("customer_id, total, created_at, customer:profiles!invoices_customer_id_fkey(full_name)")
        .eq("status", "paid")
        .not("customer_id", "is", null)
      if (filters.branchId) q = q.eq("branch_id", filters.branchId)
      const { data: allInvoices, error } = await q
      if (error) throw error

      const firstPurchase = new Map<string, string>()
      const nameOf = new Map<string, string>()
      for (const inv of allInvoices ?? []) {
        const name = (inv.customer as unknown as { full_name: string } | null)?.full_name ?? "Unknown"
        nameOf.set(inv.customer_id, name)
        const cur = firstPurchase.get(inv.customer_id)
        if (!cur || inv.created_at < cur) firstPurchase.set(inv.customer_id, inv.created_at)
      }

      const inRange = (allInvoices ?? []).filter((i) => i.created_at >= fromISO && i.created_at <= toISO)
      const byCustomer = new Map<string, { visits: number; spend: number }>()
      for (const inv of inRange) {
        const cur = byCustomer.get(inv.customer_id) ?? { visits: 0, spend: 0 }
        cur.visits += 1
        cur.spend += Number(inv.total)
        byCustomer.set(inv.customer_id, cur)
      }

      const rows = [...byCustomer.entries()].map(([id, v]) => {
        const first = firstPurchase.get(id)!
        const isNew = first >= fromISO
        return {
          customer: nameOf.get(id) ?? "Unknown",
          first_visit: format(new Date(first), "PP"),
          visits: v.visits,
          spend: v.spend,
          type: isNew ? "New" : "Returning",
        }
      })
      rows.sort((a, b) => b.spend - a.spend)
      return rows
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  const newCount = data.filter((r) => r.type === "New").length
  const returningCount = data.filter((r) => r.type === "Returning").length
  const retentionRate = pct(returningCount, data.length)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={Users} label="Active customers" value={String(data.length)} accent="gold" />
        <Stat icon={UserPlus} label="New customers" value={String(newCount)} />
        <Stat icon={Repeat} label="Retention rate" value={`${retentionRate.toFixed(1)}%`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Customer retention — {filters.from} to {filters.to}</CardTitle>
          <ExportCsvButton
            rows={data}
            filename={`customer-retention-${filters.from}-to-${filters.to}`}
            columns={[
              { key: "customer", header: "Customer" },
              { key: "first_visit", header: "First visit" },
              { key: "visits", header: "Visits in period" },
              { key: "spend", header: "Spend in period" },
              { key: "type", header: "Type" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>First visit</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead>Spend</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No customer activity in this period.
                  </TableCell>
                </TableRow>
              )}
              {data.map((r, idx) => (
                <TableRow key={r.customer + idx}>
                  <TableCell className="font-medium">{r.customer}</TableCell>
                  <TableCell>{r.first_visit}</TableCell>
                  <TableCell>{r.visits}</TableCell>
                  <TableCell>{money(r.spend)}</TableCell>
                  <TableCell>
                    <Badge variant={r.type === "New" ? "secondary" : "success"}>{r.type}</Badge>
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
