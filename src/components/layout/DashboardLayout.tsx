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
  Settings,
  LogOut,
  Menu,
  Wallet,
  Megaphone,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types"

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: LineChart, roles: ["admin", "manager", "staff", "customer"] },
  { to: "/dashboard/appointments", label: "Appointments", icon: CalendarDays, roles: ["admin", "manager", "staff", "customer"] },
  { to: "/dashboard/customers", label: "Customers", icon: Users, roles: ["admin", "manager", "staff"] },
  { to: "/dashboard/staff", label: "Staff", icon: UserRound, roles: ["admin", "manager"] },
  { to: "/dashboard/services", label: "Services", icon: Scissors, roles: ["admin", "manager"] },
  { to: "/dashboard/billing", label: "Billing", icon: Receipt, roles: ["admin", "manager", "staff"] },
  { to: "/dashboard/inventory", label: "Inventory", icon: Boxes, roles: ["admin", "manager"] },
  { to: "/dashboard/finance", label: "Finance", icon: Wallet, roles: ["admin", "manager"] },
  { to: "/dashboard/marketing", label: "Marketing", icon: Megaphone, roles: ["admin", "manager"] },
  { to: "/dashboard/settings", label: "Settings", icon: Settings, roles: ["admin", "manager", "staff", "customer"] },
]

export default function DashboardLayout() {
  const { profile, signOut } = useAuth()
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
    <div className="flex min-h-svh">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Scissors className="size-5 text-primary" />
          <Link to="/dashboard" className="font-semibold">
            Ziconsalon
          </Link>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-h-svh flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background px-4">
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
            <span className="text-sm text-muted-foreground capitalize">{role}</span>
            <Avatar className="size-8">
              <AvatarFallback>{initials}</AvatarFallback>
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
