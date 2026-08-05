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
import { Undo2, Receipt } from "lucide-react"

const STATUS_VARIANT: Record<string, "outline" | "success" | "destructive"> = {
  pending: "outline",
  approved: "success",
  rejected: "destructive",
}

export default function RefundReport({ filters }: { filters: ReportFilters }) {
  const { fromISO, toISO } = rangeISO(filters)

  const { data, isLoading } = useQuery({
    queryKey: ["report-refunds", filters],
    queryFn: async () => {
      let q = supabase
        .from("refunds")
        .select("amount, type, status, refund_method, created_at, invoice:invoices(invoice_number)")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .order("created_at", { ascending: false })
      if (filters.branchId) q = q.eq("branch_id", filters.branchId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((r) => ({
        invoice_number: (r.invoice as unknown as { invoice_number: string } | null)?.invoice_number ?? "—",
        date: format(new Date(r.created_at), "PP"),
        amount: Number(r.amount),
        type: r.type,
        status: r.status,
        refund_method: r.refund_method,
      }))
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  const approved = data.filter((r) => r.status === "approved")
  const totalRefunded = approved.reduce((s, r) => s + r.amount, 0)
  const approvalRate = pct(approved.length, data.length)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={Undo2} label="Total refunded" value={money(totalRefunded)} accent="gold" />
        <Stat icon={Receipt} label="Refund requests" value={String(data.length)} />
        <Stat icon={Receipt} label="Approval rate" value={`${approvalRate.toFixed(1)}%`} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Refunds — {filters.from} to {filters.to}</CardTitle>
          <ExportCsvButton
            rows={data}
            filename={`refund-report-${filters.from}-to-${filters.to}`}
            columns={[
              { key: "invoice_number", header: "Invoice #" },
              { key: "date", header: "Date" },
              { key: "amount", header: "Amount" },
              { key: "type", header: "Type" },
              { key: "status", header: "Status" },
              { key: "refund_method", header: "Method" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No refunds in this period.
                  </TableCell>
                </TableRow>
              )}
              {data.map((r, idx) => (
                <TableRow key={r.invoice_number + idx}>
                  <TableCell className="font-medium">{r.invoice_number}</TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell>{money(r.amount)}</TableCell>
                  <TableCell className="capitalize">{r.type}</TableCell>
                  <TableCell className="capitalize">{r.refund_method.replace("_", " ")}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">
                      {r.status}
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
