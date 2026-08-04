import * as React from "react"
import { Link } from "react-router-dom"
import { Sparkles } from "lucide-react"
import zicon from "@/assets/zicon-logo.jpeg"

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-svh md:grid-cols-2">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_20%_0%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent),radial-gradient(ellipse_50%_40%_at_100%_100%,color-mix(in_oklch,var(--gold)_12%,transparent),transparent)]" />

      <div className="gradient-luxury relative hidden flex-col justify-between overflow-hidden p-10 text-primary-foreground md:flex">
        <div className="bg-noise absolute inset-0 opacity-[0.06]" />
        <Link to="/" className="relative z-10 flex items-center gap-3">
          <img src={zicon} alt="Zicon" className="h-11 w-auto rounded-lg bg-white/90 p-1" />
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg font-semibold">Ziconsalon</span>
            <span className="text-[10px] tracking-[0.25em] text-primary-foreground/70 uppercase">
              Salon Suite
            </span>
          </div>
        </Link>

        <div className="relative z-10 flex flex-col gap-6">
          <Sparkles className="size-8 text-gold" />
          <h1 className="font-display max-w-md text-4xl leading-tight font-semibold">
            Elevate every appointment into an experience.
          </h1>
          <p className="max-w-sm text-sm text-primary-foreground/80">
            Bookings, staff, billing, and inventory — orchestrated in one refined workspace built
            for modern salons.
          </p>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Ziconsalon. Crafted for beautiful business.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="glass-card w-full max-w-sm rounded-2xl p-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center md:hidden">
            <img src={zicon} alt="Zicon" className="h-10 w-auto rounded-md" />
          </div>
          <div className="mb-6 flex flex-col gap-1">
            <h2 className="font-display text-2xl font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
