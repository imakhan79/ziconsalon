import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ExportCsvButton } from "@/components/reports/ExportCsvButton"
import { Stat } from "@/pages/dashboard/reports/Stat"
import type { ReportFilters } from "@/pages/dashboard/reports/types"
import { money } from "@/pages/dashboard/reports/utils"
import { PackageSearch, AlertTriangle } from "lucide-react"

export default function InventoryReport({ filters }: { filters: ReportFilters }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-inventory", filters.branchId],
    queryFn: async () => {
      let valuationQ = supabase.from("inventory_valuation").select("branch_id, category, total_value, total_qty")
      let lowStockQ = supabase.from("low_stock_products").select("name, sku, stock_qty, reorder_level, branch_id")
      if (filters.branchId) {
        valuationQ = valuationQ.eq("branch_id", filters.branchId)
        lowStockQ = lowStockQ.eq("branch_id", filters.branchId)
      }
      const [{ data: valuation, error: valErr }, { data: lowStock, error: lowErr }] = await Promise.all([
        valuationQ,
        lowStockQ,
      ])
      if (valErr) throw valErr
      if (lowErr) throw lowErr
      return {
        valuation: (valuation ?? []).map((v) => ({
          category: v.category ?? "Uncategorized",
          total_value: Number(v.total_value),
          total_qty: Number(v.total_qty),
        })),
        lowStock: lowStock ?? [],
      }
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  const totalValue = data.valuation.reduce((s, r) => s + r.total_value, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Stat icon={PackageSearch} label="Total inventory value" value={money(totalValue)} accent="gold" />
        <Stat icon={AlertTriangle} label="Low stock items" value={String(data.lowStock.length)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Inventory value by category</CardTitle>
          <ExportCsvButton
            rows={data.valuation}
            filename="inventory-valuation"
            columns={[
              { key: "category", header: "Category" },
              { key: "total_qty", header: "Qty on hand" },
              { key: "total_value", header: "Value" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Qty on hand</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.valuation.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No inventory recorded.
                  </TableCell>
                </TableRow>
              )}
              {data.valuation.map((r, idx) => (
                <TableRow key={r.category + idx}>
                  <TableCell className="font-medium">{r.category}</TableCell>
                  <TableCell>{r.total_qty}</TableCell>
                  <TableCell>{money(r.total_value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Low stock alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Reorder level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lowStock.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No low-stock items.
                  </TableCell>
                </TableRow>
              )}
              {data.lowStock.map((p, idx) => (
                <TableRow key={(p.sku ?? p.name) + idx}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.sku ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">{p.stock_qty}</Badge>
                  </TableCell>
                  <TableCell>{p.reorder_level}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
