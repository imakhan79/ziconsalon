import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ExportCsvButton } from "@/components/reports/ExportCsvButton"
import { Stat } from "@/pages/dashboard/reports/Stat"
import type { ReportFilters } from "@/pages/dashboard/reports/types"
import { rangeISO, money, pct } from "@/pages/dashboard/reports/utils"
import { FileText, Wallet } from "lucide-react"

export default function TaxReport({ filters }: { filters: ReportFilters }) {
  const { fromISO, toISO } = rangeISO(filters)

  const { data, isLoading } = useQuery({
    queryKey: ["report-tax", filters],
    queryFn: async () => {
      let q = supabase
        .from("invoices")
        .select("invoice_number, created_at, subtotal, tax, total")
        .eq("status", "paid")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .order("created_at", { ascending: false })
      if (filters.branchId) q = q.eq("branch_id", filters.branchId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((inv) => ({
        invoice_number: inv.invoice_number,
        date: format(new Date(inv.created_at), "PP"),
        subtotal: Number(inv.subtotal),
        tax: Number(inv.tax),
        rate: pct(Number(inv.tax), Number(inv.subtotal)),
        total: Number(inv.total),
      }))
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  const totalTax = data.reduce((s, r) => s + r.tax, 0)
  const totalSubtotal = data.reduce((s, r) => s + r.subtotal, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Stat icon={FileText} label="Total tax collected" value={money(totalTax)} accent="gold" />
        <Stat icon={Wallet} label="Effective rate" value={`${pct(totalTax, totalSubtotal).toFixed(1)}%`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Tax — {filters.from} to {filters.to}</CardTitle>
          <ExportCsvButton
            rows={data}
            filename={`tax-report-${filters.from}-to-${filters.to}`}
            columns={[
              { key: "invoice_number", header: "Invoice #" },
              { key: "date", header: "Date" },
              { key: "subtotal", header: "Subtotal" },
              { key: "tax", header: "Tax" },
              { key: "rate", header: "Rate %" },
              { key: "total", header: "Total" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No paid invoices in this period.
                  </TableCell>
                </TableRow>
              )}
              {data.map((r) => (
                <TableRow key={r.invoice_number}>
                  <TableCell className="font-medium">{r.invoice_number}</TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell>{money(r.subtotal)}</TableCell>
                  <TableCell>{money(r.tax)}</TableCell>
                  <TableCell>{r.rate.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
