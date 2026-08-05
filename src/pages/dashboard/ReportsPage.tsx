import * as React from "react"
import { format, startOfMonth } from "date-fns"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBranches } from "@/hooks/useBranches"
import KpiDashboardTab from "@/pages/dashboard/reports/KpiDashboardTab"
import ReportsTab from "@/pages/dashboard/reports/ReportsTab"
import type { ReportFilters } from "@/pages/dashboard/reports/types"

const today = format(new Date(), "yyyy-MM-dd")

export default function ReportsPage() {
  const { branches } = useBranches()
  const [filters, setFilters] = React.useState<ReportFilters>({
    from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    to: today,
    branchId: "",
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Analytics &amp; Reports</h1>
          <p className="text-sm text-muted-foreground">Business KPIs and drill-down reports.</p>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 py-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="report-from" className="text-xs">
                From
              </Label>
              <Input
                id="report-from"
                type="date"
                className="h-8 w-36"
                value={filters.from}
                max={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="report-to" className="text-xs">
                To
              </Label>
              <Input
                id="report-to"
                type="date"
                className="h-8 w-36"
                value={filters.to}
                min={filters.from}
                max={today}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              />
            </div>
            {branches.length > 1 && (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Branch</Label>
                <Select
                  value={filters.branchId || "all"}
                  onValueChange={(v) => setFilters((f) => ({ ...f, branchId: v === "all" ? "" : v }))}
                >
                  <SelectTrigger className="h-8 w-40">
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <KpiDashboardTab branchId={filters.branchId} />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportsTab filters={filters} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
