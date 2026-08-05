import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ExportCsvButton } from "@/components/reports/ExportCsvButton"
import { cn } from "@/lib/utils"
import type { ReportFilters } from "@/pages/dashboard/reports/types"
import { rangeISO } from "@/pages/dashboard/reports/utils"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function PeakHoursReport({ filters }: { filters: ReportFilters }) {
  const { fromISO, toISO } = rangeISO(filters)

  const { data, isLoading } = useQuery({
    queryKey: ["report-peak-hours", filters],
    queryFn: async () => {
      let q = supabase.from("appointments").select("start_time").gte("start_time", fromISO).lte("start_time", toISO)
      if (filters.branchId) q = q.eq("branch_id", filters.branchId)
      const { data, error } = await q
      if (error) throw error

      const matrix: number[][] = Array.from({ length: 24 }, () => Array(7).fill(0))
      for (const a of data ?? []) {
        const d = new Date(a.start_time)
        matrix[d.getHours()][d.getDay()]++
      }
      const max = Math.max(1, ...matrix.flat())
      const rows = matrix.flatMap((counts, hour) =>
        counts.map((count, weekday) => ({ hour, weekday: WEEKDAYS[weekday], count }))
      )
      return { matrix, max, rows: rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count) }
    },
  })

  if (isLoading || !data) return <Skeleton className="h-64" />

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Peak hours — {filters.from} to {filters.to}</CardTitle>
          <ExportCsvButton
            rows={data.rows}
            filename={`peak-hours-${filters.from}-to-${filters.to}`}
            columns={[
              { key: "weekday", header: "Weekday" },
              { key: "hour", header: "Hour" },
              { key: "count", header: "Appointments" },
            ]}
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="p-1 text-left text-muted-foreground">Hour</th>
                  {WEEKDAYS.map((w) => (
                    <th key={w} className="p-1 text-center text-muted-foreground">
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((counts, hour) => (
                  <tr key={hour}>
                    <td className="p-1 text-muted-foreground">{String(hour).padStart(2, "0")}:00</td>
                    {counts.map((count, weekday) => (
                      <td key={weekday} className="p-1 text-center">
                        <div
                          className={cn(
                            "mx-auto flex size-8 items-center justify-center rounded-md",
                            count === 0 && "bg-muted/40 text-muted-foreground"
                          )}
                          style={
                            count > 0
                              ? { backgroundColor: `color-mix(in oklab, var(--color-primary) ${(count / data.max) * 90 + 10}%, transparent)` }
                              : undefined
                          }
                        >
                          {count || ""}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
