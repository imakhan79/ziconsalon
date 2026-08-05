import * as React from "react"
import type { ComponentType } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format, startOfDay, addDays, subDays } from "date-fns"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CalendarDays,
  DollarSign,
  Users,
  AlertTriangle,
  UserCheck,
  Receipt,
  CheckCircle2,
  XCircle,
  Plus,
  Boxes,
  UserRound,
  BarChart3,
  Building2,
  ArrowRight,
  ClipboardList,
  UserPlus,
  LogIn,
  CalendarClock,
  Award,
  Crown,
  Tag,
  Star,
  History,
  Sparkles,
  Gift,
  PartyPopper,
  Trophy,
  RotateCcw,
  Download,
  Phone,
  MapPin,
  HeartHandshake,
  Mail,
  ClipboardCheck,
  Copy,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type {
  AppointmentStatus,
  InvoiceStatus,
  CustomerMembership,
  MembershipPlan,
  Promotion,
  Branch,
  RewardCatalogItem,
  Invoice,
  Referral,
  Survey,
} from "@/types"

const STATUS_VARIANT: Record<AppointmentStatus, "default" | "success" | "warning" | "destructive" | "outline"> = {
  pending: "warning",
  confirmed: "default",
  completed: "success",
  cancelled: "outline",
  no_show: "destructive",
}

export default function OverviewPage() {
  const { profile } = useAuth()

  if (profile?.role === "manager") return <BranchAdminDashboard />
  if (profile?.role === "staff") return <ReceptionistDashboard />
  if (profile?.role === "admin") return <StaffOverview />
  return <CustomerOverview />
}

const INVOICE_VARIANT: Record<InvoiceStatus, "default" | "success" | "warning" | "destructive" | "outline"> = {
  unpaid: "warning",
  partial: "default",
  paid: "success",
  refunded: "outline",
  void: "destructive",
}

function CustomerOverview() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [reviewTarget, setReviewTarget] = React.useState<{ id: string; staffId: string | null } | null>(null)
  const [rating, setRating] = React.useState(5)
  const [comment, setComment] = React.useState("")
  const [contactOpen, setContactOpen] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["overview-customer", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const nowIso = new Date().toISOString()

      const [
        { data: upcoming },
        { data: history },
        { data: invoices },
        { data: loyaltyTx },
        { data: membership },
        { data: plans },
        { data: offers },
        { data: myReviews },
        { data: favorites },
        { data: rewards },
        { data: branches },
      ] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, start_time, status, staff:staff(*, profile:profiles(full_name)), items:appointment_items(price, service:services(name))"
          )
          .eq("customer_id", profile!.id)
          .gte("start_time", nowIso)
          .order("start_time", { ascending: true }),
        supabase
          .from("appointments")
          .select(
            "id, start_time, status, staff_id, staff:staff(*, profile:profiles(full_name)), items:appointment_items(price, service:services(name))"
          )
          .eq("customer_id", profile!.id)
          .lt("start_time", nowIso)
          .order("start_time", { ascending: false })
          .limit(10),
        supabase
          .from("invoices")
          .select("*, payments:payments(*)")
          .eq("customer_id", profile!.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("loyalty_transactions")
          .select("*")
          .eq("customer_id", profile!.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("customer_memberships")
          .select("*, plan:membership_plans(*)")
          .eq("customer_id", profile!.id)
          .eq("status", "active")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("membership_plans").select("*").eq("is_active", true).order("price"),
        supabase
          .from("promotions")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase.from("reviews").select("appointment_id").eq("customer_id", profile!.id),
        supabase
          .from("customer_favorites")
          .select("*, staff:staff(*, profile:profiles(full_name)), service:services(name)")
          .eq("customer_id", profile!.id),
        supabase.from("reward_catalog").select("*").eq("is_active", true).order("points_cost"),
        supabase.from("branches").select("*").eq("is_active", true).order("name"),
      ])

      const serviceCounts: Record<string, number> = {}
      for (const a of [...(upcoming ?? []), ...(history ?? [])]) {
        for (const item of a.items ?? []) {
          const name = (item.service as unknown as { name: string } | null)?.name
          if (name) serviceCounts[name] = (serviceCounts[name] ?? 0) + 1
        }
      }
      const topServices = Object.entries(serviceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name)

      const loyaltyBalance = (loyaltyTx ?? []).reduce((s, t) => s + t.points, 0)
      const reviewedAppointmentIds = new Set((myReviews ?? []).map((r) => r.appointment_id))
      const lifetimeSpent = (invoices ?? [])
        .filter((i) => i.status === "paid")
        .reduce((s, i) => s + Number(i.total), 0)
      const activeOffers = (offers ?? []).filter((p: Promotion) => {
        if (p.ends_at && new Date(p.ends_at) < new Date()) return false
        if (p.starts_at && new Date(p.starts_at) > new Date()) return false
        return true
      })

      const lastCompleted = (history ?? []).find((a) => a.status === "completed") ?? null

      return {
        upcoming: upcoming ?? [],
        history: history ?? [],
        invoices: invoices ?? [],
        loyaltyTx: loyaltyTx ?? [],
        loyaltyBalance,
        membership: membership as (CustomerMembership & { plan: MembershipPlan }) | null,
        plans: (plans ?? []) as MembershipPlan[],
        activeOffers,
        topServices,
        reviewedAppointmentIds,
        lifetimeSpent,
        favorites: favorites ?? [],
        rewards: (rewards ?? []) as RewardCatalogItem[],
        branches: (branches ?? []) as Branch[],
        lastCompletedId: lastCompleted?.id ?? null,
      }
    },
  })

  const joinMembership = useMutation({
    mutationFn: async (plan: MembershipPlan) => {
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + plan.duration_months)
      const { error } = await supabase.from("customer_memberships").insert({
        customer_id: profile!.id,
        plan_id: plan.id,
        expires_at: expiresAt.toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overview-customer"] })
      toast.success("Membership activated — visit the front desk to settle payment.")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleFavoriteStaff = useMutation({
    mutationFn: async ({ staffId, isFav }: { staffId: string; isFav: boolean }) => {
      if (isFav) {
        const { error } = await supabase
          .from("customer_favorites")
          .delete()
          .eq("customer_id", profile!.id)
          .eq("staff_id", staffId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("customer_favorites")
          .insert({ customer_id: profile!.id, staff_id: staffId })
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["overview-customer"] }),
    onError: (e: Error) => toast.error(e.message),
  })

  const redeemReward = useMutation({
    mutationFn: async (rewardId: string) => {
      const { error } = await supabase.rpc("redeem_reward", { p_reward_id: rewardId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overview-customer"] })
      toast.success("Reward redeemed! Show this at the front desk.")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const claimBirthday = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("claim_birthday_bonus")
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overview-customer"] })
      toast.success("Happy birthday! 200 bonus points added.")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const { data: myReferral } = useQuery({
    queryKey: ["my-referral", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", profile!.id)
        .maybeSingle()
      if (error) throw error
      return data as Referral | null
    },
  })

  const { data: wasReferred } = useQuery({
    queryKey: ["was-referred", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("id")
        .eq("referred_customer_id", profile!.id)
        .maybeSingle()
      if (error) throw error
      return !!data
    },
  })

  const createMyReferral = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("referrals").insert({ referrer_id: profile!.id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-referral"] }),
  })

  React.useEffect(() => {
    if (profile && myReferral === null && !createMyReferral.isPending) {
      createMyReferral.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, myReferral])

  const [referralCodeInput, setReferralCodeInput] = React.useState("")
  const redeemReferral = useMutation({
    mutationFn: async () => {
      if (!referralCodeInput.trim()) throw new Error("Enter a referral code")
      const { error } = await supabase.rpc("redeem_referral_code", { p_code: referralCodeInput.trim().toUpperCase() })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["was-referred"] })
      queryClient.invalidateQueries({ queryKey: ["overview-customer"] })
      setReferralCodeInput("")
      toast.success("Referral applied! Bonus points added.")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const { data: activeSurveys = [] } = useQuery({
    queryKey: ["active-surveys", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const [{ data: surveys }, { data: myResponses }] = await Promise.all([
        supabase.from("surveys").select("*").eq("is_active", true),
        supabase.from("survey_responses").select("survey_id").eq("customer_id", profile!.id),
      ])
      const answeredIds = new Set((myResponses ?? []).map((r) => r.survey_id))
      return ((surveys ?? []) as Survey[]).filter((s) => !answeredIds.has(s.id))
    },
  })

  const [surveyAnswers, setSurveyAnswers] = React.useState<Record<string, Record<string, string | number>>>({})
  const submitSurvey = useMutation({
    mutationFn: async (survey: Survey) => {
      const answers = surveyAnswers[survey.id] ?? {}
      const { error } = await supabase.from("survey_responses").insert({
        survey_id: survey.id,
        customer_id: profile!.id,
        answers,
      })
      if (error) throw error
    },
    onSuccess: (_data, survey) => {
      queryClient.invalidateQueries({ queryKey: ["active-surveys"] })
      setSurveyAnswers((a) => ({ ...a, [survey.id]: {} }))
      toast.success("Thanks for your feedback!")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const exportData = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify({ profile, ...data }, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "my-ziconsalon-data.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadInvoice = (inv: Invoice) => {
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`
      <html><head><title>${inv.invoice_number}</title></head>
      <body style="font-family: sans-serif; padding: 40px;">
        <h1>Ziconsalon</h1>
        <h2>Invoice ${inv.invoice_number}</h2>
        <p>Date: ${format(new Date(inv.created_at), "PPP")}</p>
        <p>Status: ${inv.status}</p>
        <hr />
        <p>Subtotal: Rs ${Number(inv.subtotal).toFixed(2)}</p>
        <p>Discount: -Rs ${Number(inv.discount).toFixed(2)}</p>
        <p>Tax: +Rs ${Number(inv.tax).toFixed(2)}</p>
        <h3>Total: Rs ${Number(inv.total).toFixed(2)}</h3>
      </body></html>
    `)
    w.document.close()
    w.print()
  }

  const isBirthdayToday =
    !!profile?.date_of_birth &&
    (() => {
      const d = new Date(profile.date_of_birth!)
      const t = new Date()
      return d.getUTCMonth() === t.getUTCMonth() && d.getUTCDate() === t.getUTCDate()
    })()

  const rewardTier = data
    ? data.loyaltyBalance >= 500
      ? "Gold"
      : data.loyaltyBalance >= 100
        ? "Silver"
        : "Bronze"
    : "Bronze"

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!reviewTarget) return
      const { error } = await supabase.from("reviews").insert({
        customer_id: profile!.id,
        appointment_id: reviewTarget.id,
        staff_id: reviewTarget.staffId,
        rating,
        comment: comment || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overview-customer"] })
      setReviewTarget(null)
      setRating(5)
      setComment("")
      toast.success("Thanks for your feedback!")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-5">
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Welcome, <span className="text-gradient-luxury">{profile?.full_name}</span>
          </h1>
          <p className="text-sm text-muted-foreground">Here's what's coming up for you.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/dashboard/appointments">
              <Plus className="size-4" /> Book appointment
            </Link>
          </Button>
          {data.lastCompletedId && (
            <Button asChild size="sm" variant="outline">
              <Link to={`/dashboard/appointments?rebook=${data.lastCompletedId}`}>
                <RotateCcw className="size-4" /> Rebook last visit
              </Link>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={exportData}>
            <Download className="size-4" /> Export my data
          </Button>
          <Button size="sm" variant="outline" onClick={() => setContactOpen(true)}>
            <Phone className="size-4" /> Contact salon
          </Button>
        </div>
      </div>

      {isBirthdayToday && (
        <div className="gradient-gold flex items-center justify-between rounded-xl p-4 text-accent-foreground">
          <div className="flex items-center gap-2">
            <PartyPopper className="size-5" />
            <span className="font-medium">Happy birthday! Claim your bonus points on us.</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => claimBirthday.mutate()} disabled={claimBirthday.isPending}>
            Claim 200 points
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gift className="size-4 text-accent" />
              <CardTitle className="text-base">Refer a friend</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {myReferral && (
              <div className="flex items-center gap-2">
                <Input readOnly value={myReferral.referral_code} className="font-mono" />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(myReferral.referral_code)
                    toast.success("Code copied")
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Share your code — you both get {myReferral?.reward_points ?? 100} bonus points when a friend redeems it.
            </p>
            {!wasReferred && (
              <form
                className="flex items-center gap-2 border-t border-border/60 pt-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  redeemReferral.mutate()
                }}
              >
                <Input
                  placeholder="Have a code? Enter it here"
                  value={referralCodeInput}
                  onChange={(e) => setReferralCodeInput(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={redeemReferral.isPending}>
                  Redeem
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {activeSurveys.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="size-4 text-accent" />
                <CardTitle className="text-base">Quick feedback</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {activeSurveys.map((s) => (
                <form
                  key={s.id}
                  className="flex flex-col gap-2 border-b border-border/60 pb-4 last:border-0 last:pb-0"
                  onSubmit={(e) => {
                    e.preventDefault()
                    submitSurvey.mutate(s)
                  }}
                >
                  <p className="text-sm font-medium">{s.title}</p>
                  {s.questions.map((q) => (
                    <div key={q.id} className="flex flex-col gap-1">
                      <Label className="text-xs">{q.text}</Label>
                      {q.type === "rating" ? (
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() =>
                                setSurveyAnswers((a) => ({ ...a, [s.id]: { ...(a[s.id] ?? {}), [q.id]: n } }))
                              }
                            >
                              <Star
                                className={`size-5 ${
                                  Number(surveyAnswers[s.id]?.[q.id] ?? 0) >= n
                                    ? "fill-accent text-accent"
                                    : "text-muted-foreground/30"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Input
                          value={(surveyAnswers[s.id]?.[q.id] as string) ?? ""}
                          onChange={(e) =>
                            setSurveyAnswers((a) => ({ ...a, [s.id]: { ...(a[s.id] ?? {}), [q.id]: e.target.value } }))
                          }
                        />
                      )}
                    </div>
                  ))}
                  <Button type="submit" size="sm" className="w-fit" disabled={submitSurvey.isPending}>
                    Submit
                  </Button>
                </form>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Upcoming appointments" value={data.upcoming.length} />
        <StatCard icon={Award} label={`Loyalty points · ${rewardTier}`} value={data.loyaltyBalance} accent="gold" />
        <StatCard icon={Crown} label="Membership" value={data.membership?.plan.name ?? "None"} />
        <StatCard icon={DollarSign} label="Lifetime spent" value={`Rs ${data.lifetimeSpent.toFixed(2)}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming appointments</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No appointments yet. Book one from the Appointments tab.
            </p>
          ) : (
            data.upcoming.map((a) => {
              const staffId = (a.staff as unknown as { id: string } | null)?.id
              const staffName = (a.staff as unknown as { profile: { full_name: string } } | null)?.profile
                ?.full_name
              const isFav = staffId ? data.favorites.some((f) => f.staff_id === staffId) : false
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3 text-sm transition-colors hover:bg-accent/5"
                >
                  <div className="flex flex-col">
                    <span>{format(new Date(a.start_time), "PPp")}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {staffName ?? "No preference"}
                      {staffId && (
                        <button
                          type="button"
                          onClick={() => toggleFavoriteStaff.mutate({ staffId, isFav })}
                          title={isFav ? "Remove favorite" : "Save as favorite"}
                        >
                          <Star className={`size-3 ${isFav ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                        </button>
                      )}
                    </span>
                  </div>
                  <Badge variant={STATUS_VARIANT[a.status as AppointmentStatus]} className="capitalize">
                    {a.status.replace("_", " ")}
                  </Badge>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="size-4 text-accent" />
              <CardTitle className="text-base">Appointment history</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.history.length === 0 && <p className="text-sm text-muted-foreground">No past visits yet.</p>}
            {data.history.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <div className="flex flex-col">
                  <span>{format(new Date(a.start_time), "PP")}</span>
                  <span className="text-xs text-muted-foreground">
                    {(a.items ?? [])
                      .map((i) => (i.service as unknown as { name: string } | null)?.name)
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[a.status as AppointmentStatus]} className="capitalize">
                    {a.status.replace("_", " ")}
                  </Badge>
                  {a.status === "completed" && !data.reviewedAppointmentIds.has(a.id) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReviewTarget({ id: a.id, staffId: a.staff_id })}
                    >
                      <Star className="size-4" /> Review
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoices &amp; payments</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
            {data.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{inv.invoice_number}</span>
                <div className="flex items-center gap-2">
                  <span>Rs {Number(inv.total).toFixed(2)}</span>
                  <Badge variant={INVOICE_VARIANT[inv.status as InvoiceStatus]} className="capitalize">
                    {inv.status}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => downloadInvoice(inv)} title="Download invoice">
                    <Download className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" />
              <CardTitle className="text-base">For you</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.topServices.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Your favorites</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.topServices.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase">
                <Tag className="size-3" /> Current offers
              </p>
              {data.activeOffers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active promotions right now.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data.activeOffers.map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-sm">
                      <span>{o.name}</span>
                      <span className="font-medium text-accent">
                        {o.discount_type === "percent" ? `${o.discount_value}% off` : `Rs ${o.discount_value} off`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="size-4 text-accent" />
              <CardTitle className="text-base">Loyalty activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.loyaltyTx.length === 0 && (
              <p className="text-sm text-muted-foreground">Earn points every time you pay for a visit.</p>
            )}
            {data.loyaltyTx.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.reason ?? t.type}</span>
                <span className={t.points >= 0 ? "text-accent" : "text-destructive"}>
                  {t.points >= 0 ? "+" : ""}
                  {t.points}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HeartHandshake className="size-4 text-accent" />
              <CardTitle className="text-base">My favorites</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.favorites.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Tap the star next to a stylist to save them as a favorite.
              </p>
            )}
            {data.favorites.map((f) => {
              const name =
                (f.staff as unknown as { profile: { full_name: string } } | null)?.profile?.full_name ??
                (f.service as unknown as { name: string } | null)?.name ??
                "—"
              return (
                <div key={f.id} className="flex items-center justify-between text-sm">
                  <span>{name}</span>
                  <Badge variant="outline">{f.staff_id ? "Stylist" : "Service"}</Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-accent" />
              <CardTitle className="text-base">Redeem rewards</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.rewards.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <div className="flex flex-col">
                  <span>{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r.points_cost} points</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={data.loyaltyBalance < r.points_cost || redeemReward.isPending}
                  onClick={() => redeemReward.mutate(r.id)}
                >
                  <Gift className="size-3.5" /> Redeem
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Crown className="size-4 text-accent" />
            <CardTitle className="text-base">Membership plans</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {data.plans.map((p) => {
            const isCurrent = data.membership?.plan_id === p.id
            return (
              <div
                key={p.id}
                className={`flex flex-col gap-2 rounded-xl border p-4 ${
                  isCurrent ? "border-accent bg-accent/5" : "border-border/60 bg-background/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-semibold">{p.name}</span>
                  {isCurrent && <Badge variant="success">Active</Badge>}
                </div>
                <span className="text-2xl font-semibold">
                  Rs {Number(p.price).toFixed(0)}
                  <span className="text-sm font-normal text-muted-foreground">/{p.duration_months}mo</span>
                </span>
                <p className="text-sm text-muted-foreground">{p.benefits}</p>
                {!isCurrent && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-auto"
                    onClick={() => joinMembership.mutate(p)}
                    disabled={joinMembership.isPending || !!data.membership}
                  >
                    Join
                  </Button>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Dialog open={!!reviewTarget} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate your visit</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)}>
                  <Star className={`size-6 ${n <= rating ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Tell us about your experience (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <DialogFooter>
              <Button onClick={() => submitReview.mutate()} disabled={submitReview.isPending}>
                Submit review
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact us</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {data.branches.length === 0 && (
              <p className="text-sm text-muted-foreground">No branch contact details available yet.</p>
            )}
            {data.branches.map((b) => (
              <div key={b.id} className="flex flex-col gap-1 rounded-lg border border-border/60 p-3 text-sm">
                <span className="font-medium">{b.name}</span>
                {b.phone && (
                  <a href={`tel:${b.phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <Phone className="size-3.5" /> {b.phone}
                  </a>
                )}
                {b.email && (
                  <a href={`mailto:${b.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                    <Mail className="size-3.5" /> {b.email}
                  </a>
                )}
                {b.address && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="size-3.5" /> {b.address}
                  </span>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StaffOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["overview-staff"],
    queryFn: async () => {
      const monthStart = startOfDay(new Date())
      monthStart.setDate(1)
      const monthStartIso = monthStart.toISOString()
      const [{ count: apptCount }, { data: invoices }, { count: customerCount }, { data: lowStock }] =
        await Promise.all([
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .gte("start_time", monthStartIso),
          supabase.from("invoices").select("total, status, created_at").gte("created_at", monthStartIso),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "customer"),
          supabase
            .from("products")
            .select("id, name, stock_qty, reorder_level")
            .order("stock_qty", { ascending: true })
            .limit(5),
        ])

      const revenue = (invoices ?? [])
        .filter((i) => i.status === "paid")
        .reduce((sum, i) => sum + Number(i.total), 0)

      const revenueByDay: Record<string, number> = {}
      for (const inv of invoices ?? []) {
        if (inv.status !== "paid") continue
        const day = format(new Date(inv.created_at), "MMM d")
        revenueByDay[day] = (revenueByDay[day] ?? 0) + Number(inv.total)
      }
      const chartData = Object.entries(revenueByDay).map(([day, total]) => ({ day, total }))

      return {
        apptCount: apptCount ?? 0,
        revenue,
        customerCount: customerCount ?? 0,
        lowStock: (lowStock ?? []).filter((p) => Number(p.stock_qty) <= Number(p.reorder_level)),
        chartData,
      }
    },
  })

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Business overview</h1>
        <p className="text-sm text-muted-foreground">Your salon's performance at a glance.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Appointments this month" value={data.apptCount} />
        <StatCard icon={DollarSign} label="Revenue this month" value={`Rs ${data.revenue.toFixed(2)}`} accent="gold" />
        <StatCard icon={Users} label="Total customers" value={data.customerCount} />
        <StatCard icon={AlertTriangle} label="Low stock items" value={data.lowStock.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue this month</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <RevenueChart data={data.chartData} gradientId="revenueGradientStaff" />
        </CardContent>
      </Card>

      {data.lowStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Low stock alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {data.lowStock.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                >
                  <span>{p.name}</span>
                  <span className="text-destructive font-medium">{p.stock_qty} left</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ReceptionistDashboard() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["overview-receptionist", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const todayStart = startOfDay(new Date())
      const todayStartIso = todayStart.toISOString()
      const tomorrowIso = addDays(todayStart, 1).toISOString()

      const [{ data: todaysAppts }, { data: duePayments }, { count: newCustomersToday }] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, start_time, status, customer:profiles!appointments_customer_id_fkey(full_name, phone), staff:staff(*, profile:profiles(full_name))"
          )
          .gte("start_time", todayStartIso)
          .lt("start_time", tomorrowIso)
          .order("start_time", { ascending: true }),
        supabase
          .from("invoices")
          .select("id, invoice_number, total, status, customer:profiles!invoices_customer_id_fkey(full_name)")
          .in("status", ["unpaid", "partial"])
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "customer")
          .gte("created_at", todayStartIso),
      ])

      const appts = todaysAppts ?? []
      return {
        appts,
        pendingCheckIn: appts.filter((a) => a.status === "pending").length,
        checkedIn: appts.filter((a) => a.status === "confirmed").length,
        completedToday: appts.filter((a) => a.status === "completed").length,
        duePayments: duePayments ?? [],
        duePaymentsTotal: (duePayments ?? []).reduce((s, i) => s + Number(i.total), 0),
        newCustomersToday: newCustomersToday ?? 0,
      }
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overview-receptionist"] })
      toast.success("Status updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="gradient-luxury rounded-xl p-3">
            <ClipboardList className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">Front Desk</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {profile?.full_name} — {format(new Date(), "EEEE, MMMM d")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/dashboard/appointments">
              <Plus className="size-4" /> Book / walk-in
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/billing">
              <Receipt className="size-4" /> POS billing
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/signup" target="_blank" rel="noopener noreferrer">
              <UserPlus className="size-4" /> Register customer
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/customers">
              <Users className="size-4" /> Customers
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Today's appointments" value={data.appts.length} />
        <StatCard icon={CalendarClock} label="Awaiting check-in" value={data.pendingCheckIn} />
        <StatCard icon={LogIn} label="Checked in" value={data.checkedIn} accent="gold" />
        <StatCard icon={CheckCircle2} label="Completed today" value={data.completedToday} />
        <StatCard icon={Receipt} label="Payments due" value={`Rs ${data.duePaymentsTotal.toFixed(2)}`} />
        <StatCard icon={UserPlus} label="New customers today" value={data.newCustomersToday} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Front desk queue — today</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.appts.length === 0 && (
              <p className="text-sm text-muted-foreground">No appointments scheduled today.</p>
            )}
            {data.appts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{format(new Date(a.start_time), "p")}</span>
                  <span className="text-xs text-muted-foreground">
                    {(a.customer as unknown as { full_name: string } | null)?.full_name ?? "—"} ·{" "}
                    {(a.staff as unknown as { profile: { full_name: string } } | null)?.profile?.full_name ??
                      "Unassigned"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[a.status as AppointmentStatus]} className="capitalize">
                    {a.status.replace("_", " ")}
                  </Badge>
                  {a.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus.mutate({ id: a.id, status: "confirmed" })}
                    >
                      Check in
                    </Button>
                  )}
                  {a.status === "confirmed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus.mutate({ id: a.id, status: "completed" })}
                    >
                      Check out
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Payments due</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard/billing">
                  Open billing <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.duePayments.length === 0 && (
              <p className="text-sm text-muted-foreground">No outstanding payments.</p>
            )}
            {data.duePayments.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{inv.invoice_number}</span>
                  <span className="text-xs text-muted-foreground">
                    {(inv.customer as unknown as { full_name: string } | null)?.full_name ?? "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Rs {Number(inv.total).toFixed(2)}</span>
                  <Badge variant="warning" className="capitalize">
                    {inv.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function BranchAdminDashboard() {
  const { profile } = useAuth()
  const branchId = profile?.branch_id ?? null
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["overview-branch-admin", branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const todayStart = startOfDay(new Date())
      const todayStartIso = todayStart.toISOString()
      const tomorrowIso = addDays(todayStart, 1).toISOString()
      const weekAgoIso = subDays(todayStart, 6).toISOString()

      const [
        { data: branch },
        { data: todaysAppts },
        { count: weekApptCount },
        { data: activeStaff },
        { data: todayInvoices },
        { data: pendingInvoices },
        { data: lowStockRaw },
        { data: recentInvoices },
        { data: weekInvoices },
        { data: pendingLeave },
      ] = await Promise.all([
        supabase.from("branches").select("*").eq("id", branchId!).single(),
        supabase
          .from("appointments")
          .select(
            "id, start_time, status, customer:profiles!appointments_customer_id_fkey(full_name), staff:staff(*, profile:profiles(full_name))"
          )
          .eq("branch_id", branchId!)
          .gte("start_time", todayStartIso)
          .lt("start_time", tomorrowIso)
          .order("start_time", { ascending: true }),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("branch_id", branchId!)
          .gte("start_time", weekAgoIso),
        supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("branch_id", branchId!)
          .in("role", ["staff", "manager"])
          .eq("is_active", true),
        supabase
          .from("invoices")
          .select("total, status")
          .eq("branch_id", branchId!)
          .gte("created_at", todayStartIso)
          .lt("created_at", tomorrowIso),
        supabase
          .from("invoices")
          .select("total, status")
          .eq("branch_id", branchId!)
          .in("status", ["unpaid", "partial"]),
        supabase
          .from("products")
          .select("id, name, stock_qty, reorder_level")
          .eq("branch_id", branchId!)
          .order("stock_qty", { ascending: true })
          .limit(20),
        supabase
          .from("invoices")
          .select("id, invoice_number, total, status, created_at, customer:profiles!invoices_customer_id_fkey(full_name)")
          .eq("branch_id", branchId!)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("invoices")
          .select("total, status, created_at")
          .eq("branch_id", branchId!)
          .eq("status", "paid")
          .gte("created_at", weekAgoIso),
        supabase
          .from("leave_requests")
          .select("*, staff:profiles!leave_requests_staff_id_fkey(full_name)")
          .eq("branch_id", branchId!)
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
      ])

      const todaysApptList = todaysAppts ?? []
      const todaysRevenue = (todayInvoices ?? [])
        .filter((i) => i.status === "paid")
        .reduce((s, i) => s + Number(i.total), 0)
      const pendingTotal = (pendingInvoices ?? []).reduce((s, i) => s + Number(i.total), 0)
      const lowStock = (lowStockRaw ?? []).filter((p) => Number(p.stock_qty) <= Number(p.reorder_level))

      const revenueByDay: Record<string, number> = {}
      for (let i = 6; i >= 0; i--) {
        revenueByDay[format(subDays(new Date(), i), "MMM d")] = 0
      }
      for (const inv of weekInvoices ?? []) {
        const day = format(new Date(inv.created_at), "MMM d")
        if (day in revenueByDay) revenueByDay[day] += Number(inv.total)
      }
      const chartData = Object.entries(revenueByDay).map(([day, total]) => ({ day, total }))

      return {
        branchName: branch?.name ?? "Your branch",
        todaysAppts: todaysApptList,
        completedToday: todaysApptList.filter((a) => a.status === "completed").length,
        cancelledToday: todaysApptList.filter((a) => ["cancelled", "no_show"].includes(a.status)).length,
        weekApptCount: weekApptCount ?? 0,
        activeStaff: activeStaff ?? [],
        todaysRevenue,
        pendingTotal,
        pendingCount: (pendingInvoices ?? []).length,
        lowStock,
        recentInvoices: recentInvoices ?? [],
        chartData,
        pendingLeave: pendingLeave ?? [],
      }
    },
  })

  const reviewLeave = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("leave_requests")
        .update({ status, reviewed_by: profile!.id })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overview-branch-admin"] })
      toast.success("Leave request updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="gradient-luxury rounded-xl p-3">
            <Building2 className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">{data.branchName}</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {profile?.full_name} — Branch Administrator
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/dashboard/appointments">
              <Plus className="size-4" /> Book appointment
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/billing">
              <Plus className="size-4" /> Create invoice
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/inventory">
              <Boxes className="size-4" /> Add product
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/staff">
              <UserRound className="size-4" /> Staff
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard/reports">
              <BarChart3 className="size-4" /> Reports
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Today's appointments" value={data.todaysAppts.length} />
        <StatCard icon={UserCheck} label="Active staff" value={data.activeStaff.length} />
        <StatCard icon={DollarSign} label="Today's revenue" value={`Rs ${data.todaysRevenue.toFixed(2)}`} accent="gold" />
        <StatCard icon={Receipt} label="Pending payments" value={`Rs ${data.pendingTotal.toFixed(2)}`} />
        <StatCard icon={CheckCircle2} label="Completed today" value={data.completedToday} />
        <StatCard icon={XCircle} label="Cancelled / no-show today" value={data.cancelledToday} />
        <StatCard icon={CalendarDays} label="Appointments this week" value={data.weekApptCount} />
        <StatCard icon={AlertTriangle} label="Low stock items" value={data.lowStock.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today's appointment timeline</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.todaysAppts.length === 0 && (
              <p className="text-sm text-muted-foreground">No appointments scheduled today.</p>
            )}
            {data.todaysAppts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{format(new Date(a.start_time), "p")}</span>
                  <span className="text-xs text-muted-foreground">
                    {(a.customer as unknown as { full_name: string } | null)?.full_name ?? "—"} ·{" "}
                    {(a.staff as unknown as { profile: { full_name: string } } | null)?.profile?.full_name ??
                      "Unassigned"}
                  </span>
                </div>
                <Badge variant={STATUS_VARIANT[a.status as AppointmentStatus]} className="capitalize">
                  {a.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue — last 7 days</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <RevenueChart data={data.chartData} gradientId="revenueGradientBranch" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Staff on duty</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard/staff">
                  View all <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.activeStaff.length === 0 && (
              <p className="text-sm text-muted-foreground">No active staff assigned to this branch yet.</p>
            )}
            {data.activeStaff.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span>{s.full_name}</span>
                <Badge variant="secondary" className="capitalize">
                  {s.role}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent transactions</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard/billing">
                  View all <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.recentInvoices.length === 0 && (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            )}
            {data.recentInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{inv.invoice_number}</span>
                  <span className="text-xs text-muted-foreground">
                    {(inv.customer as unknown as { full_name: string } | null)?.full_name ?? "—"}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span>Rs {Number(inv.total).toFixed(2)}</span>
                  <Badge variant={STATUS_VARIANT[inv.status as keyof typeof STATUS_VARIANT] ?? "outline"} className="capitalize">
                    {inv.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {data.pendingLeave.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending leave requests</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.pendingLeave.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {(r.staff as unknown as { full_name: string } | null)?.full_name ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(r.start_date), "PP")} → {format(new Date(r.end_date), "PP")}
                    {r.reason ? ` · ${r.reason}` : ""}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => reviewLeave.mutate({ id: r.id, status: "approved" })}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reviewLeave.mutate({ id: r.id, status: "rejected" })}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.lowStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low stock alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {data.lowStock.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                >
                  <span>{p.name}</span>
                  <span className="text-destructive font-medium">{p.stock_qty} left</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function RevenueChart({ data, gradientId }: { data: { day: string; total: number }[]; gradientId: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.95} />
            <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0.85} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
        <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
          }}
        />
        <Bar dataKey="total" fill={`url(#${gradientId})`} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = "primary",
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string | number
  accent?: "primary" | "gold"
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className={accent === "gold" ? "gradient-gold rounded-xl p-3" : "gradient-luxury rounded-xl p-3"}>
          <Icon className={accent === "gold" ? "size-5 text-accent-foreground" : "size-5 text-primary-foreground"} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
