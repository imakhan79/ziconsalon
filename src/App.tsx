import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/contexts/AuthContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { Toaster } from "@/components/ui/sonner"
import DashboardLayout from "@/components/layout/DashboardLayout"

import HomePage from "@/pages/marketing/HomePage"
import LoginPage from "@/pages/auth/LoginPage"
import SignupPage from "@/pages/auth/SignupPage"
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage"
import OverviewPage from "@/pages/dashboard/OverviewPage"
import AppointmentsPage from "@/pages/dashboard/AppointmentsPage"
import CustomersPage from "@/pages/dashboard/CustomersPage"
import StaffPage from "@/pages/dashboard/StaffPage"
import ServicesPage from "@/pages/dashboard/ServicesPage"
import BillingPage from "@/pages/dashboard/BillingPage"
import InventoryPage from "@/pages/dashboard/InventoryPage"
import FinancePage from "@/pages/dashboard/FinancePage"
import MarketingPage from "@/pages/dashboard/MarketingPage"
import ReportsPage from "@/pages/dashboard/ReportsPage"
import SettingsPage from "@/pages/dashboard/SettingsPage"
import ProfilePage from "@/pages/dashboard/ProfilePage"
import MyWorkPage from "@/pages/dashboard/MyWorkPage"
import StaffHRPage from "@/pages/dashboard/StaffHRPage"
import POSPage from "@/pages/dashboard/POSPage"
import RefundsPage from "@/pages/dashboard/RefundsPage"
import CashClosingPage from "@/pages/dashboard/CashClosingPage"
import VendorsPage from "@/pages/dashboard/VendorsPage"
import NotificationsPage from "@/pages/dashboard/NotificationsPage"
import PurchaseOrdersPage from "@/pages/dashboard/PurchaseOrdersPage"
import StockTransfersPage from "@/pages/dashboard/StockTransfersPage"
import CampaignsPage from "@/pages/dashboard/CampaignsPage"
import ReferralsPage from "@/pages/dashboard/ReferralsPage"
import SurveysPage from "@/pages/dashboard/SurveysPage"
import ReviewsPage from "@/pages/dashboard/ReviewsPage"
import AdminOverviewPage from "@/pages/admin/OverviewPage"
import BranchesPage from "@/pages/admin/BranchesPage"
import UsersPage from "@/pages/admin/UsersPage"
import AdminPricingPage from "@/pages/admin/PricingPage"
import PermissionsPage from "@/pages/admin/PermissionsPage"
import IntegrationsPage from "@/pages/admin/IntegrationsPage"
import SystemPage from "@/pages/admin/SystemPage"

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
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
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
