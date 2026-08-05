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
import { BadgePercent, Receipt } from "lucide-react"

export default function DiscountReport({ filters }: { filters: ReportFilters }) {
  const { fromISO, toISO } = rangeISO(filters)

  const { data, isLoading } = useQuery({
    queryKey: ["report-discounts", filters],
    queryFn: async () => {
      let q = supabase
        .from("invoices")
        .select(
          "invoice_number, created_at, subtotal, discount, total, walk_in_name, customer:profiles!invoices_customer_id_fkey(full_name)"
        )
        .eq("status", "paid")
        .gt("discount", 0)
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .order("discount", { ascending: false })
      if (filters.branchId) q = q.eq("branch_id", filters.branchId)
      const { data: invoiceRows, error } = await q
      if (error) throw error

      const { data: promotions } = await supabase
        .from("promotions")
        .select("code, discount_type, discount_value, usage_count, usage_limit, is_active")
        .order("usage_count", { ascending: false })

      return {
        invoices: (invoiceRows ?? []).map((inv) => ({
          invoice_number: inv.invoice_number,
          date: format(new Date(inv.created_at), "PP"),
          customer:
            (inv.customer as unknown as { full_name: string } | null)?.full_name ?? inv.walk_in_name ?? "Walk-in",
          subtotal: Number(inv.subtotal),
          discount: Number(inv.discount),
          total: Number(inv.total),
        })),
        promotions: promotions ?? [],
      }
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  const totalDiscount = data.invoices.reduce((s, r) => s + r.discount, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Stat icon={BadgePercent} label="Total discounted" value={money(totalDiscount)} accent="gold" />
        <Stat icon={Receipt} label="Discounted invoices" value={String(data.invoices.length)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Discounted sales — {filters.from} to {filters.to}</CardTitle>
          <ExportCsvButton
            rows={data.invoices}
            filename={`discount-report-${filters.from}-to-${filters.to}`}
            columns={[
              { key: "invoice_number", header: "Invoice #" },
              { key: "date", header: "Date" },
              { key: "customer", header: "Customer" },
              { key: "subtotal", header: "Subtotal" },
              { key: "discount", header: "Discount" },
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
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No discounted invoices in this period.
                  </TableCell>
                </TableRow>
              )}
              {data.invoices.map((r) => (
                <TableRow key={r.invoice_number}>
                  <TableCell className="font-medium">{r.invoice_number}</TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell>{r.customer}</TableCell>
                  <TableCell>{money(r.subtotal)}</TableCell>
                  <TableCell>{money(r.discount)}</TableCell>
                  <TableCell>{money(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coupon usage (lifetime — not period-bound)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.promotions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No coupon codes yet.
                  </TableCell>
                </TableRow>
              )}
              {data.promotions.map((p) => (
                <TableRow key={p.code}>
                  <TableCell className="font-medium">{p.code}</TableCell>
                  <TableCell className="capitalize">{p.discount_type}</TableCell>
                  <TableCell>{p.discount_type === "percent" ? `${p.discount_value}%` : money(Number(p.discount_value))}</TableCell>
                  <TableCell>{p.usage_count}</TableCell>
                  <TableCell>{p.usage_limit ?? "∞"}</TableCell>
                  <TableCell>{p.is_active ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
