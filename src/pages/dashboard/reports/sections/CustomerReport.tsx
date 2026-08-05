import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ExportCsvButton } from "@/components/reports/ExportCsvButton"
import { Stat } from "@/pages/dashboard/reports/Stat"
import type { ReportFilters } from "@/pages/dashboard/reports/types"
import { rangeISO, money } from "@/pages/dashboard/reports/utils"
import { Users, UserPlus } from "lucide-react"

export default function CustomerReport({ filters }: { filters: ReportFilters }) {
  const { fromISO, toISO } = rangeISO(filters)

  const { data, isLoading } = useQuery({
    queryKey: ["report-customers", filters],
    queryFn: async () => {
      let customerQ = supabase
        .from("profiles")
        .select("id, full_name, created_at, branch_id")
        .eq("role", "customer")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
      if (filters.branchId) customerQ = customerQ.eq("branch_id", filters.branchId)

      let invoiceQ = supabase.from("invoices").select("customer_id, total, status").eq("status", "paid")
      if (filters.branchId) invoiceQ = invoiceQ.eq("branch_id", filters.branchId)

      const [{ data: customers, error: cErr }, { data: allPaid, error: iErr }] = await Promise.all([customerQ, invoiceQ])
      if (cErr) throw cErr
      if (iErr) throw iErr

      const spendByCustomer = new Map<string, { visits: number; spend: number }>()
      for (const inv of allPaid ?? []) {
        const cur = spendByCustomer.get(inv.customer_id) ?? { visits: 0, spend: 0 }
        cur.visits += 1
        cur.spend += Number(inv.total)
        spendByCustomer.set(inv.customer_id, cur)
      }

      return (customers ?? [])
        .map((c) => {
          const stats = spendByCustomer.get(c.id) ?? { visits: 0, spend: 0 }
          return {
            name: c.full_name,
            joined: format(new Date(c.created_at), "PP"),
            visits: stats.visits,
            spend: stats.spend,
          }
        })
        .sort((a, b) => b.spend - a.spend)
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Stat icon={UserPlus} label="New customers in period" value={String(data.length)} accent="gold" />
        <Stat icon={Users} label="Total lifetime spend (new customers)" value={money(data.reduce((s, r) => s + r.spend, 0))} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">New customers — {filters.from} to {filters.to}</CardTitle>
          <ExportCsvButton
            rows={data}
            filename={`customer-report-${filters.from}-to-${filters.to}`}
            columns={[
              { key: "name", header: "Customer" },
              { key: "joined", header: "Joined" },
              { key: "visits", header: "Lifetime visits" },
              { key: "spend", header: "Lifetime spend" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Lifetime visits</TableHead>
                <TableHead>Lifetime spend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No new customers in this period.
                  </TableCell>
                </TableRow>
              )}
              {data.map((r, idx) => (
                <TableRow key={r.name + idx}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.joined}</TableCell>
                  <TableCell>{r.visits}</TableCell>
                  <TableCell>{money(r.spend)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
