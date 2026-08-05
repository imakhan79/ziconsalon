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
import { Receipt, Wallet, Percent } from "lucide-react"

export default function SalesReport({ filters }: { filters: ReportFilters }) {
  const { fromISO, toISO } = rangeISO(filters)

  const { data, isLoading } = useQuery({
    queryKey: ["report-sales", filters],
    queryFn: async () => {
      let q = supabase
        .from("invoices")
        .select(
          "id, invoice_number, created_at, subtotal, discount, tax, service_charge, total, walk_in_name, customer:profiles!invoices_customer_id_fkey(full_name)"
        )
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
        customer: (inv.customer as unknown as { full_name: string } | null)?.full_name ?? inv.walk_in_name ?? "Walk-in",
        subtotal: Number(inv.subtotal),
        discount: Number(inv.discount),
        tax: Number(inv.tax),
        service_charge: Number(inv.service_charge),
        total: Number(inv.total),
      }))
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  const totalRevenue = data.reduce((s, r) => s + r.total, 0)
  const avgTicket = data.length ? totalRevenue / data.length : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={Wallet} label="Total revenue" value={money(totalRevenue)} accent="gold" />
        <Stat icon={Receipt} label="Paid invoices" value={String(data.length)} />
        <Stat icon={Percent} label="Average ticket size" value={money(avgTicket)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Sales — {filters.from} to {filters.to}</CardTitle>
          <ExportCsvButton
            rows={data}
            filename={`sales-report-${filters.from}-to-${filters.to}`}
            columns={[
              { key: "invoice_number", header: "Invoice #" },
              { key: "date", header: "Date" },
              { key: "customer", header: "Customer" },
              { key: "subtotal", header: "Subtotal" },
              { key: "discount", header: "Discount" },
              { key: "tax", header: "Tax" },
              { key: "service_charge", header: "Service charge" },
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
                <TableHead>Customer</TableHead>
                <TableHead>Subtotal</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No paid invoices in this period.
                  </TableCell>
                </TableRow>
              )}
              {data.map((r) => (
                <TableRow key={r.invoice_number}>
                  <TableCell className="font-medium">{r.invoice_number}</TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell>{r.customer}</TableCell>
                  <TableCell>{money(r.subtotal)}</TableCell>
                  <TableCell>{money(r.discount)}</TableCell>
                  <TableCell>{money(r.tax)}</TableCell>
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
