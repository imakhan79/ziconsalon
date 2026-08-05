export interface ReportFilters {
  /** yyyy-MM-dd */
  from: string
  /** yyyy-MM-dd */
  to: string
  /** "" = all branches (admin only; RLS scopes manager/staff regardless) */
  branchId: string
}
