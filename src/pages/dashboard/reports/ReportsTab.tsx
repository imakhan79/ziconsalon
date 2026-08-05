import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ReportFilters } from "@/pages/dashboard/reports/types"
import SalesReport from "@/pages/dashboard/reports/sections/SalesReport"
import TaxReport from "@/pages/dashboard/reports/sections/TaxReport"
import RefundReport from "@/pages/dashboard/reports/sections/RefundReport"
import DiscountReport from "@/pages/dashboard/reports/sections/DiscountReport"
import CommissionReport from "@/pages/dashboard/reports/sections/CommissionReport"
import AppointmentReport from "@/pages/dashboard/reports/sections/AppointmentReport"
import ServicePopularityReport from "@/pages/dashboard/reports/sections/ServicePopularityReport"
import PeakHoursReport from "@/pages/dashboard/reports/sections/PeakHoursReport"
import CustomerRetentionReport from "@/pages/dashboard/reports/sections/CustomerRetentionReport"
import RevenueForecastReport from "@/pages/dashboard/reports/sections/RevenueForecastReport"
import AttendanceReport from "@/pages/dashboard/reports/sections/AttendanceReport"
import PayrollReport from "@/pages/dashboard/reports/sections/PayrollReport"
import StaffPerformanceReport from "@/pages/dashboard/reports/sections/StaffPerformanceReport"
import InventoryReport from "@/pages/dashboard/reports/sections/InventoryReport"
import BranchComparisonReport from "@/pages/dashboard/reports/sections/BranchComparisonReport"
import CustomerReport from "@/pages/dashboard/reports/sections/CustomerReport"

interface ReportSection {
  label: string
  reports: { id: string; label: string; component: React.ComponentType<{ filters: ReportFilters }> }[]
}

const SECTIONS: ReportSection[] = [
  {
    label: "Sales & finance",
    reports: [
      { id: "sales", label: "Sales", component: SalesReport },
      { id: "tax", label: "Tax", component: TaxReport },
      { id: "refunds", label: "Refunds", component: RefundReport },
      { id: "discounts", label: "Discounts", component: DiscountReport },
      { id: "commission", label: "Commission", component: CommissionReport },
    ],
  },
  {
    label: "Appointments & customers",
    reports: [
      { id: "appointments", label: "Appointments", component: AppointmentReport },
      { id: "service-popularity", label: "Service popularity", component: ServicePopularityReport },
      { id: "peak-hours", label: "Peak hours", component: PeakHoursReport },
      { id: "retention", label: "Customer retention", component: CustomerRetentionReport },
      { id: "forecast", label: "Revenue forecasting", component: RevenueForecastReport },
    ],
  },
  {
    label: "Staff & operations",
    reports: [
      { id: "attendance", label: "Attendance", component: AttendanceReport },
      { id: "payroll", label: "Payroll", component: PayrollReport },
      { id: "staff-performance", label: "Staff performance", component: StaffPerformanceReport },
    ],
  },
  {
    label: "Inventory & branches",
    reports: [
      { id: "inventory", label: "Inventory", component: InventoryReport },
      { id: "branch-comparison", label: "Branch comparison", component: BranchComparisonReport },
      { id: "customers", label: "Customer", component: CustomerReport },
    ],
  },
]

export default function ReportsTab({ filters }: { filters: ReportFilters }) {
  return (
    <Tabs defaultValue="sales" orientation="vertical" className="flex-row items-start gap-4">
      <TabsList className="h-auto w-56 shrink-0 flex-col items-stretch gap-1 bg-transparent p-0">
        {SECTIONS.map((section) => (
          <div key={section.label} className="flex flex-col gap-1">
            <p className="mt-3 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase first:mt-0">
              {section.label}
            </p>
            {section.reports.map((r) => (
              <TabsTrigger
                key={r.id}
                value={r.id}
                className="justify-start data-[state=active]:shadow-none"
              >
                {r.label}
              </TabsTrigger>
            ))}
          </div>
        ))}
      </TabsList>

      <div className="min-w-0 flex-1">
        {SECTIONS.flatMap((s) => s.reports).map((r) => {
          const Report = r.component
          return (
            <TabsContent key={r.id} value={r.id} className="mt-0">
              <Report filters={filters} />
            </TabsContent>
          )
        })}
      </div>
    </Tabs>
  )
}
