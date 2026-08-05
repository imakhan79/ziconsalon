import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  CalendarDays,
  Sparkles,
  Users,
  Receipt,
  Boxes,
  BarChart3,
  Megaphone,
  ArrowRight,
  Moon,
  Sun,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Service } from "@/types"
import zicon from "@/assets/zicon-logo.jpeg"

const HUBS = [
  { icon: CalendarDays, title: "Booking Hub", desc: "Online booking, calendar views, reminders and waitlists." },
  { icon: Users, title: "Customer Hub", desc: "Rich profiles, visit history and preferences in one place." },
  { icon: Sparkles, title: "Staff Hub", desc: "Schedules, commissions and performance for every stylist." },
  { icon: Receipt, title: "Finance Hub", desc: "POS billing, invoices, payments and daily reconciliation." },
  { icon: Boxes, title: "Inventory Hub", desc: "Stock levels, purchase tracking and low-stock alerts." },
  { icon: Megaphone, title: "Marketing Hub", desc: "Promotions and coupons to keep chairs full." },
  { icon: BarChart3, title: "Reports Hub", desc: "Real-time revenue, staff and service performance insights." },
]

export default function HomePage() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const { data: services = [] } = useQuery({
    queryKey: ["public-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: false })
        .limit(6)
      if (error) throw error
      return data as Service[]
    },
  })

  return (
    <div className="relative min-h-svh overflow-x-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_60%_45%_at_15%_-5%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent),radial-gradient(ellipse_55%_45%_at_100%_15%,color-mix(in_oklch,var(--gold)_14%,transparent),transparent)]" />

      <header className="sticky top-0 z-30 bg-background/70 backdrop-blur-xl saturate-150 border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={zicon} alt="Zicon" className="h-9 w-auto rounded-md object-contain" />
            <span className="font-display text-lg font-semibold text-gradient-luxury">Ziconsalon</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            {user ? (
              <Button asChild size="sm">
                <Link to="/dashboard">
                  Go to dashboard <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/signup">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 pt-20 pb-16 text-center md:px-6 md:pt-28">
        <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-accent" /> Luxury salon operations, refined
        </span>
        <h1 className="font-display max-w-3xl text-4xl leading-tight font-semibold md:text-6xl">
          Run an <span className="text-gradient-luxury">extraordinary</span> salon business
        </h1>
        <p className="max-w-xl text-balance text-muted-foreground md:text-lg">
          Appointments, staff, billing, and inventory — orchestrated in one elegant workspace
          built for modern beauty businesses.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/signup">
              Book an appointment <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/login">Staff sign in</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <h2 className="font-display text-2xl font-semibold md:text-3xl">One suite, every hub</h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            Everything your front desk, stylists, and management team need — under one roof.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HUBS.map((hub) => (
            <Card key={hub.title} className="group">
              <CardContent className="flex flex-col gap-3">
                <div className="gradient-luxury flex size-10 items-center justify-center rounded-lg text-primary-foreground shadow-sm transition-transform group-hover:scale-110">
                  <hub.icon className="size-5" />
                </div>
                <h3 className="font-medium">{hub.title}</h3>
                <p className="text-sm text-muted-foreground">{hub.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {services.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
          <div className="mb-8 flex flex-col items-center gap-2 text-center">
            <h2 className="font-display text-2xl font-semibold md:text-3xl">Signature services</h2>
            <p className="max-w-lg text-sm text-muted-foreground">
              A glimpse of what our chairs are booked for.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-medium">{s.name}</h3>
                    <p className="text-xs text-muted-foreground">{s.duration_minutes} min</p>
                  </div>
                  <span className="font-display text-lg font-semibold text-gradient-luxury">
                    Rs {Number(s.price).toFixed(0)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
        <div className="gradient-luxury relative overflow-hidden rounded-2xl p-10 text-center text-primary-foreground md:p-16">
          <div className="bg-noise absolute inset-0 opacity-[0.06]" />
          <div className="relative z-10 flex flex-col items-center gap-4">
            <h2 className="font-display text-2xl font-semibold md:text-3xl">
              Ready to elevate your salon?
            </h2>
            <p className="max-w-md text-sm text-primary-foreground/80">
              Create your account and book your first appointment in minutes.
            </p>
            <Button asChild size="lg" variant="gold">
              <Link to="/signup">
                Get started <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 px-4 py-8 text-center text-xs text-muted-foreground md:px-6">
        © {new Date().getFullYear()} Ziconsalon. All rights reserved.
      </footer>
    </div>
  )
}
