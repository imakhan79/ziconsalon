import { Suspense, lazy } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/contexts/AuthContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { Toaster } from "@/components/ui/sonner"
import DashboardLayout from "@/components/layout/DashboardLayout"

const HomePage = lazy(() => import("@/pages/marketing/HomePage"))
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"))
const SignupPage = lazy(() => import("@/pages/auth/SignupPage"))
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage"))
const OverviewPage = lazy(() => import("@/pages/dashboard/OverviewPage"))
const AppointmentsPage = lazy(() => import("@/pages/dashboard/AppointmentsPage"))
const CustomersPage = lazy(() => import("@/pages/dashboard/CustomersPage"))
const StaffPage = lazy(() => import("@/pages/dashboard/StaffPage"))
const ServicesPage = lazy(() => import("@/pages/dashboard/ServicesPage"))
const BillingPage = lazy(() => import("@/pages/dashboard/BillingPage"))
const InventoryPage = lazy(() => import("@/pages/dashboard/InventoryPage"))
const FinancePage = lazy(() => import("@/pages/dashboard/FinancePage"))
const MarketingPage = lazy(() => import("@/pages/dashboard/MarketingPage"))
const ReportsPage = lazy(() => import("@/pages/dashboard/ReportsPage"))
const SettingsPage = lazy(() => import("@/pages/dashboard/SettingsPage"))
const ProfilePage = lazy(() => import("@/pages/dashboard/ProfilePage"))
const MyWorkPage = lazy(() => import("@/pages/dashboard/MyWorkPage"))
const StaffHRPage = lazy(() => import("@/pages/dashboard/StaffHRPage"))
const POSPage = lazy(() => import("@/pages/dashboard/POSPage"))
const RefundsPage = lazy(() => import("@/pages/dashboard/RefundsPage"))
const CashClosingPage = lazy(() => import("@/pages/dashboard/CashClosingPage"))
const VendorsPage = lazy(() => import("@/pages/dashboard/VendorsPage"))
const NotificationsPage = lazy(() => import("@/pages/dashboard/NotificationsPage"))
const SecurityPage = lazy(() => import("@/pages/dashboard/SecurityPage"))
const PurchaseOrdersPage = lazy(() => import("@/pages/dashboard/PurchaseOrdersPage"))
const StockTransfersPage = lazy(() => import("@/pages/dashboard/StockTransfersPage"))
const CampaignsPage = lazy(() => import("@/pages/dashboard/CampaignsPage"))
const ReferralsPage = lazy(() => import("@/pages/dashboard/ReferralsPage"))
const SurveysPage = lazy(() => import("@/pages/dashboard/SurveysPage"))
const ReviewsPage = lazy(() => import("@/pages/dashboard/ReviewsPage"))
const AdminOverviewPage = lazy(() => import("@/pages/admin/OverviewPage"))
const BranchesPage = lazy(() => import("@/pages/admin/BranchesPage"))
const UsersPage = lazy(() => import("@/pages/admin/UsersPage"))
const AdminPricingPage = lazy(() => import("@/pages/admin/PricingPage"))
const PermissionsPage = lazy(() => import("@/pages/admin/PermissionsPage"))
const IntegrationsPage = lazy(() => import("@/pages/admin/IntegrationsPage"))
const SystemPage = lazy(() => import("@/pages/admin/SystemPage"))

const queryClient = new QueryClient()

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading...</div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                <Route element={<ProtectedRoute />}>
                  <Route element={<DashboardLayout />}>
                    <Route path="/dashboard" element={<OverviewPage />} />
                    <Route path="/dashboard/appointments" element={<AppointmentsPage />} />
                    <Route path="/dashboard/profile" element={<ProfilePage />} />
                    <Route path="/dashboard/settings" element={<SettingsPage />} />
                    <Route path="/dashboard/security" element={<SecurityPage />} />

                    <Route element={<ProtectedRoute allowedRoles={["admin", "manager", "staff"]} />}>
                      <Route path="/dashboard/customers" element={<CustomersPage />} />
                      <Route path="/dashboard/billing" element={<BillingPage />} />
                      <Route path="/dashboard/my-work" element={<MyWorkPage />} />
                      <Route path="/dashboard/pos" element={<POSPage />} />
                      <Route path="/dashboard/cash-closing" element={<CashClosingPage />} />
                    </Route>

                    <Route element={<ProtectedRoute allowedRoles={["admin", "manager"]} />}>
                      <Route path="/dashboard/staff" element={<StaffPage />} />
                      <Route path="/dashboard/staff-hr" element={<StaffHRPage />} />
                      <Route path="/dashboard/services" element={<ServicesPage />} />
                      <Route path="/dashboard/inventory" element={<InventoryPage />} />
                      <Route path="/dashboard/inventory/vendors" element={<VendorsPage />} />
                      <Route path="/dashboard/inventory/purchase-orders" element={<PurchaseOrdersPage />} />
                      <Route path="/dashboard/inventory/transfers" element={<StockTransfersPage />} />
                      <Route path="/dashboard/finance" element={<FinancePage />} />
                      <Route path="/dashboard/refunds" element={<RefundsPage />} />
                      <Route path="/dashboard/marketing" element={<MarketingPage />} />
                      <Route path="/dashboard/marketing/campaigns" element={<CampaignsPage />} />
                      <Route path="/dashboard/marketing/referrals" element={<ReferralsPage />} />
                      <Route path="/dashboard/marketing/surveys" element={<SurveysPage />} />
                      <Route path="/dashboard/marketing/reviews" element={<ReviewsPage />} />
                      <Route path="/dashboard/reports" element={<ReportsPage />} />
                      <Route path="/dashboard/notifications" element={<NotificationsPage />} />
                    </Route>

                    <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                      <Route path="/dashboard/admin" element={<AdminOverviewPage />} />
                      <Route path="/dashboard/admin/branches" element={<BranchesPage />} />
                      <Route path="/dashboard/admin/users" element={<UsersPage />} />
                      <Route path="/dashboard/admin/pricing" element={<AdminPricingPage />} />
                      <Route path="/dashboard/admin/permissions" element={<PermissionsPage />} />
                      <Route path="/dashboard/admin/integrations" element={<IntegrationsPage />} />
                      <Route path="/dashboard/admin/system" element={<SystemPage />} />
                    </Route>
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
