import * as React from "react"
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom"
import {
  CalendarDays,
  Users,
  UserRound,
  Scissors,
  Receipt,
  Boxes,
  LineChart,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Wallet,
  Megaphone,
  Moon,
  Sun,
  UserCircle,
  Crown,
  Building2,
  ShieldCheck,
  Plug,
  SlidersHorizontal,
  DollarSign,
  ClipboardCheck,
  BadgeCheck,
  ShoppingCart,
  Undo2,
  Lock,
  Truck,
  ClipboardList,
  ArrowRightLeft,
  Send,
  Gift,
  ListChecks,
  Star,
  Bell,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import { NotificationBell } from "@/components/layout/NotificationBell"
import { useIdleTimeout } from "@/hooks/useIdleTimeout"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types"
import zicon from "@/assets/zicon-logo.jpeg"

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: LineChart, roles: ["admin", "manager", "staff", "customer"] },
  { to: "/dashboard/appointments", label: "Appointments", icon: CalendarDays, roles: ["admin", "manager", "staff", "customer"] },
  { to: "/dashboard/my-work", label: "My Work", icon: ClipboardCheck, roles: ["admin", "manager", "staff"] },
  { to: "/dashboard/customers", label: "Customers", icon: Users, roles: ["admin", "manager", "staff"] },
  { to: "/dashboard/staff", label: "Staff", icon: UserRound, roles: ["admin", "manager"] },
  { to: "/dashboard/staff-hr", label: "Staff HR", icon: BadgeCheck, roles: ["admin", "manager"] },
  { to: "/dashboard/services", label: "Services", icon: Scissors, roles: ["admin", "manager"] },
  { to: "/dashboard/billing", label: "Billing", icon: Receipt, roles: ["admin", "manager", "staff"] },
  { to: "/dashboard/pos", label: "POS", icon: ShoppingCart, roles: ["admin", "manager", "staff"] },
  { to: "/dashboard/cash-closing", label: "Cash Closing", icon: Lock, roles: ["admin", "manager", "staff"] },
  { to: "/dashboard/inventory", label: "Inventory", icon: Boxes, roles: ["admin", "manager"] },
  { to: "/dashboard/inventory/vendors", label: "Vendors", icon: Truck, roles: ["admin", "manager"] },
  { to: "/dashboard/inventory/purchase-orders", label: "Purchase Orders", icon: ClipboardList, roles: ["admin", "manager"] },
  { to: "/dashboard/inventory/transfers", label: "Transfers", icon: ArrowRightLeft, roles: ["admin", "manager"] },
  { to: "/dashboard/finance", label: "Finance", icon: Wallet, roles: ["admin", "manager"] },
  { to: "/dashboard/refunds", label: "Refunds", icon: Undo2, roles: ["admin", "manager"] },
  { to: "/dashboard/marketing", label: "Marketing", icon: Megaphone, roles: ["admin", "manager"] },
  { to: "/dashboard/marketing/campaigns", label: "Campaigns", icon: Send, roles: ["admin", "manager"] },
  { to: "/dashboard/marketing/referrals", label: "Referrals", icon: Gift, roles: ["admin", "manager"] },
  { to: "/dashboard/marketing/surveys", label: "Surveys", icon: ListChecks, roles: ["admin", "manager"] },
  { to: "/dashboard/marketing/reviews", label: "Reviews", icon: Star, roles: ["admin", "manager"] },
  { to: "/dashboard/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager"] },
  { to: "/dashboard/notifications", label: "Notifications", icon: Bell, roles: ["admin", "manager"] },
  { to: "/dashboard/profile", label: "Profile", icon: UserCircle, roles: ["admin", "manager", "staff", "customer"] },
  { to: "/dashboard/settings", label: "Settings", icon: Settings, roles: ["admin", "manager", "staff", "customer"] },
  { to: "/dashboard/security", label: "Security", icon: ShieldCheck, roles: ["admin", "manager", "staff", "customer"] },
]

const ADMIN_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard/admin", label: "Executive Overview", icon: Crown, roles: ["admin"] },
  { to: "/dashboard/admin/branches", label: "Branches", icon: Building2, roles: ["admin"] },
  { to: "/dashboard/admin/users", label: "Users", icon: Users, roles: ["admin"] },
  { to: "/dashboard/admin/pricing", label: "Pricing", icon: DollarSign, roles: ["admin"] },
  { to: "/dashboard/admin/permissions", label: "Permissions", icon: ShieldCheck, roles: ["admin"] },
  { to: "/dashboard/admin/integrations", label: "Integrations", icon: Plug, roles: ["admin"] },
  { to: "/dashboard/admin/system", label: "System", icon: SlidersHorizontal, roles: ["admin"] },
]

export default function DashboardLayout() {
  useIdleTimeout()
  const { profile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const role = profile?.role ?? "customer"

  const items = NAV_ITEMS.filter((i) => i.roles.includes(role))

  const handleSignOut = async () => {
    await signOut()
    navigate("/login")
  }

  const initials = (profile?.full_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="flex min-h-svh bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_20%_0%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent),radial-gradient(ellipse_50%_40%_at_100%_20%,color-mix(in_oklch,var(--gold)_10%,transparent),transparent)]" />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar/80 backdrop-blur-xl saturate-150 transition-transform md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-border/60 px-4">
          <img src={zicon} alt="Zicon" className="h-9 w-auto rounded-md object-contain" />
          <div className="flex flex-col leading-none">
            <Link to="/dashboard" className="font-display text-base font-semibold text-gradient-luxury">
              Ziconsalon
            </Link>
            <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Salon Suite</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "gradient-luxury text-primary-foreground shadow-md shadow-primary/25"
                    : "text-sidebar-foreground/70 hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )
              }
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}

          {role === "admin" && (
            <>
              <div className="mt-4 mb-1 flex items-center gap-2 px-3">
                <Crown className="size-3 text-accent" />
                <span className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                  Super Admin
                </span>
              </div>
              {ADMIN_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/dashboard/admin"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "gradient-gold text-accent-foreground shadow-md shadow-accent/25"
                        : "text-sidebar-foreground/70 hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-border/60 p-3">
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-h-svh flex-1 flex-col">
        <header className="bg-background/70 backdrop-blur-xl saturate-150 sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/60 px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <Menu className="size-5" />
          </Button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs font-medium text-muted-foreground capitalize">
              {role}
            </span>
            <NotificationBell />
            <Avatar className="size-9 ring-2 ring-accent/40">
              <AvatarFallback className="gradient-luxury text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
