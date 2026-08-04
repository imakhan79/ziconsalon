import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/contexts/AuthContext"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { Toaster } from "@/components/ui/sonner"
import DashboardLayout from "@/components/layout/DashboardLayout"

import LoginPage from "@/pages/auth/LoginPage"
import SignupPage from "@/pages/auth/SignupPage"
import OverviewPage from "@/pages/dashboard/OverviewPage"
import AppointmentsPage from "@/pages/dashboard/AppointmentsPage"
import CustomersPage from "@/pages/dashboard/CustomersPage"
import StaffPage from "@/pages/dashboard/StaffPage"
import ServicesPage from "@/pages/dashboard/ServicesPage"
import BillingPage from "@/pages/dashboard/BillingPage"
import InventoryPage from "@/pages/dashboard/InventoryPage"
import FinancePage from "@/pages/dashboard/FinancePage"
import MarketingPage from "@/pages/dashboard/MarketingPage"
import SettingsPage from "@/pages/dashboard/SettingsPage"

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<OverviewPage />} />
                <Route path="/dashboard/appointments" element={<AppointmentsPage />} />
                <Route path="/dashboard/settings" element={<SettingsPage />} />

                <Route element={<ProtectedRoute allowedRoles={["admin", "manager", "staff"]} />}>
                  <Route path="/dashboard/customers" element={<CustomersPage />} />
                  <Route path="/dashboard/billing" element={<BillingPage />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={["admin", "manager"]} />}>
                  <Route path="/dashboard/staff" element={<StaffPage />} />
                  <Route path="/dashboard/services" element={<ServicesPage />} />
                  <Route path="/dashboard/inventory" element={<InventoryPage />} />
                  <Route path="/dashboard/finance" element={<FinancePage />} />
                  <Route path="/dashboard/marketing" element={<MarketingPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
