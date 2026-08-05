import { endOfDay, startOfDay } from "date-fns"
import type { ReportFilters } from "@/pages/dashboard/reports/types"

export function rangeISO(filters: ReportFilters): { fromISO: string; toISO: string } {
  return {
    fromISO: startOfDay(new Date(filters.from)).toISOString(),
    toISO: endOfDay(new Date(filters.to)).toISOString(),
  }
}

export const money = (n: number) => `Rs ${n.toFixed(2)}`
export const pct = (a: number, b: number) => (b === 0 ? 0 : (a / b) * 100)
